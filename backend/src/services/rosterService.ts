// Guild Roster Service
// Synchronisiert Gildenmitglieder und deren Charaktere

import prisma from '../prisma';
import { BattleNetAPIService } from './battleNetAPIService';

// Helper to process in chunks to avoid rate limits / timeouts
const chunk = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );

export class RosterService {
    // Synchronisiert den kompletten Roster einer Gilde
    static async syncRoster(guildId: number, accessToken: string): Promise<any> {
        try {
            const guild = await prisma.guild.findUnique({
                where: { id: guildId }
            });

            if (!guild) {
                throw new Error('Guild not found');
            }

            console.log(`[RosterService] Starting sync for guild: ${guild.name} (${guild.realm})`);

            const service = new BattleNetAPIService(accessToken);
            console.log(`[RosterService] Fetching roster from API...`);
            const members = await service.getGuildRoster(guild.realm, guild.name);
            console.log(`[RosterService] Fetched ${members.length} members from Battle.net API`);

            // Fetch Guild Ranks
            try {
                console.log(`[RosterService] Fetching guild ranks...`);
                const ranks = await service.getGuildRanks(guild.realm, guild.name);
                if (ranks && ranks.length > 0) {
                    console.log(`[RosterService] Updated guild ranks: ${ranks.length} found`);
                    await prisma.guild.update({
                        where: { id: guildId },
                        data: { ranks: ranks }
                    });
                } else {
                    console.log(`[RosterService] No ranks returned by API.`);
                }
            } catch (rankError) {
                console.error(`[RosterService] Failed to update ranks:`, rankError);
            }

            const syncStats = {
                total: members.length,
                updated: 0,
                created: 0,
                errors: 0
            };

            // PHASE 1: Quick Sync - Upsert all members with basic info (Rank, Class, Level)
            // Using chunks to avoid overwhelming the DB connection pool
            const PHASE1_CHUNK_SIZE = 50;
            const phase1Chunks = chunk(members, PHASE1_CHUNK_SIZE);

            console.log(`[RosterService] Phase 1: Processing ${members.length} members in ${phase1Chunks.length} chunks...`);

            for (let i = 0; i < phase1Chunks.length; i++) {
                const batch = phase1Chunks[i];
                await Promise.all(batch.map(async (member) => {
                    try {
                        const charData = member.character;
                        const rank = member.rank;

                        // Check if this character belongs to a registered user
                        const existingUserChar = await prisma.character.findFirst({
                            where: {
                                name: charData.name.toLowerCase(),
                                realm: charData.realm.slug,
                                userId: { not: null }
                            },
                            select: { userId: true }
                        });

                        const assignedUserId = existingUserChar?.userId ?? undefined;

                        await prisma.character.upsert({
                            where: {
                                name_realm: {
                                    name: charData.name.toLowerCase(),
                                    realm: charData.realm.slug,
                                }
                            },
                            update: {
                                level: charData.level,
                                guildId: guildId,
                                class: charData.playable_class?.name?.de_DE || charData.playable_class?.name || 'Unknown',
                                classId: charData.playable_class?.id || null,
                                race: charData.playable_race?.name?.de_DE || charData.playable_race?.name || 'Unknown',
                                faction: guild.faction,
                                rank: rank,
                                lastSync: new Date(),
                                userId: assignedUserId,
                            },
                            create: {
                                userId: assignedUserId,
                                battleNetId: charData.id.toString(),
                                name: charData.name.toLowerCase(),
                                realm: charData.realm.slug,
                                level: charData.level,
                                guildId: guildId,
                                class: charData.playable_class?.name?.de_DE || charData.playable_class?.name || 'Unknown',
                                classId: charData.playable_class?.id || null,
                                race: charData.playable_race?.name?.de_DE || charData.playable_race?.name || 'Unknown',
                                faction: guild.faction,
                                rank: rank,
                                averageItemLevel: 0,
                                mythicRating: 0,
                                raidProgress: '-',
                                lastSync: new Date(),
                                isActive: true,
                            }
                        });

                        syncStats.updated++;
                        syncStats.updated++;
                    } catch (err) {
                        console.error(`[RosterService] Error in Phase 1 for ${member?.character?.name}:`, err);
                        syncStats.errors++;
                    }
                }));
                // console.log(`[RosterService] Phase 1 Progress: ${Math.min((i + 1) * PHASE1_CHUNK_SIZE, members.length)}/${members.length}`);
            }

            console.log(`[RosterService] Phase 1 complete: ${syncStats.updated} updated, ${syncStats.errors} errors.`);
            console.log(`[RosterService] Phase 1 complete: ${syncStats.updated} members upserted.`);

            // PHASE 2: Detailed Stats (Background / Incremental)
            console.log(`[RosterService] Phase 2: Fetching details for ${members.length} members...`);

            const chunks = chunk(members, 5); // Process 5 at a time
            let processedCount = 0;

            for (const batch of chunks) {
                await Promise.all(batch.map(async (member) => {
                    try {
                        const charData = member.character;

                        // Fetch details
                        const details = await service.getCharacterDetails(charData.realm.slug, charData.name.toLowerCase());

                        let averageItemLevel = null;
                        let mythicRating = null;
                        let raidProgress = null;
                        let role = null;

                        if (details) {
                            averageItemLevel = details.equipped_item_level || details.average_item_level;
                            role = details.active_spec?.role?.type || null;

                            // Map role to our format
                            if (role === 'TANK') role = 'Tank';
                            else if (role === 'HEALER') role = 'Healer';
                            else if (role === 'DAMAGE') role = 'DPS';

                            // Mythic Rating
                            try {
                                const mPlus = await service.getCharacterMythicKeystone(charData.realm.slug, charData.name.toLowerCase());
                                if (mPlus && mPlus.current_mythic_rating) {
                                    mythicRating = mPlus.current_mythic_rating.rating;
                                }
                            } catch (e) { /* ignore m+ error */ }

                            // Raid Progress
                            try {
                                const raids = await service.getCharacterRaidEncounters(charData.realm.slug, charData.name.toLowerCase());
                                if (raids && raids.expansions) {
                                    // Use dynamic detection instead of hardcoded name
                                    let targetRaid = null;
                                    const latestExp = raids.expansions[raids.expansions.length - 1];
                                    if (latestExp?.instances?.length > 0) {
                                        targetRaid = latestExp.instances[latestExp.instances.length - 1];
                                    }

                                    if (targetRaid) {
                                        const modes = ['MYTHIC', 'HEROIC', 'NORMAL'];
                                        for (const mode of modes) {
                                            const modeData = targetRaid.modes.find((m: any) => m.difficulty.type === mode);
                                            if (modeData) {
                                                const diffChar = mode === 'MYTHIC' ? 'M' : mode === 'HEROIC' ? 'H' : 'N';
                                                raidProgress = `${modeData.progress.completed_count}/${modeData.progress.total_count} ${diffChar}`;
                                                break;
                                            }
                                        }
                                    }
                                }
                            } catch (e) { /* ignore raid error */ }
                        }

                        // Update detailed stats
                        const existingChar = await prisma.character.findFirst({
                            where: {
                                name: charData.name.toLowerCase(),
                                realm: charData.realm.slug,
                            }
                        });

                        await prisma.character.update({
                            where: {
                                name_realm: {
                                    name: charData.name.toLowerCase(),
                                    realm: charData.realm.slug,
                                }
                            },
                            data: {
                                averageItemLevel,
                                mythicRating,
                                raidProgress,
                                // Only update role if it's currently null or "Unknown"
                                role: (role && (!existingChar?.role || existingChar.role === 'Unknown')) ? role : undefined
                            }
                        });

                    } catch (err) {
                        // Silent fail for individual members to keep sync running
                        // console.error(`Failed individual sync for ${member.character.name}`);
                    }
                }));
                processedCount += batch.length;
                if (processedCount % 20 === 0) console.log(`[RosterService] Processed ${processedCount}/${members.length} members`);
            }
            console.log(`[RosterService] Phase 2 complete.`);

            // Update Guild Last Sync
            await prisma.guild.update({
                where: { id: guildId },
                data: { lastSync: new Date() }
            });

            console.log(`[RosterService] Sync completed successfully.`);
            return syncStats;

        } catch (error) {
            console.error("[RosterService] Fatal error:", error);
            throw error;
        }
    }

    // Synchronisiert einen einzelnen Charakter (auch Gildenextern)
    static async syncSingleCharacter(realm: string, name: string, accessToken: string): Promise<any> {
        try {
            const service = new BattleNetAPIService(accessToken);
            console.log(`[RosterService] Syncing single character: ${name}-${realm}`);

            const details = await service.getCharacterDetails(realm, name.toLowerCase());
            if (!details) return null;

            // Detect if character belongs to a known guild
            let detectedGuildId: number | undefined = undefined;
            if (details.guild) {
                const bnetGuildId = details.guild.id;
                // Try to find the guild in our DB by name and realm (or better, we should have bnetId but we don't sync that for guilds yet)
                // For now, let's match by name and realm slug
                const dbGuild = await prisma.guild.findFirst({
                    where: {
                        name: details.guild.name,
                        realm: {
                            contains: details.guild.realm.slug,
                            mode: 'insensitive'
                        }
                    }
                });
                if (dbGuild) {
                    detectedGuildId = dbGuild.id;
                }
            }

            let averageItemLevel = details.equipped_item_level || details.average_item_level;
            let role = details.active_spec?.role?.type || null;

            // Map role
            if (role === 'TANK') role = 'Tank';
            else if (role === 'HEALER') role = 'Healer';
            else if (role === 'DAMAGE') role = 'DPS';

            let mythicRating = 0;
            try {
                const mPlus = await service.getCharacterMythicKeystone(realm, name.toLowerCase());
                if (mPlus && mPlus.current_mythic_rating) {
                    mythicRating = mPlus.current_mythic_rating.rating;
                }
            } catch (e) { /* ignore */ }

            let raidProgress = '-';
            try {
                const raids = await service.getCharacterRaidEncounters(realm, name.toLowerCase());
                if (raids && raids.expansions) {
                    const latestExp = raids.expansions[raids.expansions.length - 1];
                    const targetRaid = latestExp?.instances?.[latestExp.instances.length - 1];
                    if (targetRaid) {
                        const modes = ['MYTHIC', 'HEROIC', 'NORMAL'];
                        for (const mode of modes) {
                            const modeData = targetRaid.modes.find((m: any) => m.difficulty.type === mode);
                            if (modeData) {
                                const diffChar = mode === 'MYTHIC' ? 'M' : mode === 'HEROIC' ? 'H' : 'N';
                                raidProgress = `${modeData.progress.completed_count}/${modeData.progress.total_count} ${diffChar}`;
                                break;
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }

            const character = await prisma.character.upsert({
                where: {
                    name_realm: {
                        name: name.toLowerCase(),
                        realm: realm.toLowerCase(),
                    }
                },
                update: {
                    level: details.level,
                    class: details.character_class?.name?.de_DE || details.character_class?.name || 'Unknown',
                    classId: details.character_class?.id || null,
                    race: details.race?.name?.de_DE || details.race?.name || 'Unknown',
                    averageItemLevel,
                    mythicRating,
                    raidProgress,
                    role: role || undefined,
                    isActive: true,
                    guildId: detectedGuildId,
                    lastSync: new Date(),
                },
                create: {
                    battleNetId: details.id.toString(),
                    name: name.toLowerCase(),
                    realm: realm.toLowerCase(),
                    level: details.level,
                    class: details.character_class?.name?.de_DE || details.character_class?.name || 'Unknown',
                    classId: details.character_class?.id || null,
                    race: details.race?.name?.de_DE || details.race?.name || 'Unknown',
                    faction: details.faction?.name?.en_US || 'Unknown',
                    averageItemLevel,
                    mythicRating,
                    raidProgress,
                    role: role || 'Unknown',
                    guildId: detectedGuildId,
                    lastSync: new Date(),
                    isActive: true,
                }
            });

            return character;
        } catch (error) {
            console.error(`[RosterService] Sync single character failed for ${name}-${realm}:`, error);
            return null;
        }
    }
}
