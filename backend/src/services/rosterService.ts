// Guild Roster Service
// Synchronisiert Gildenmitglieder und deren Charaktere

import prisma from '../prisma';
import { BattleNetAPIService } from './battleNetAPIService';

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
            const members = await service.getGuildRoster(guild.realm, guild.name);

            console.log(`[RosterService] Fetched ${members.length} members from Battle.net API`);

            // Fetch Guild Ranks
            try {
                const ranks = await service.getGuildRanks(guild.realm, guild.name);
                if (ranks && ranks.length > 0) {
                    console.log(`[RosterService] Updated guild ranks: ${ranks.length} found`);
                    await prisma.guild.update({
                        where: { id: guildId },
                        data: { ranks: ranks }
                    });
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
            // This ensures the roster list is populated immediately even if details fail.
            const statsPromises = members.map(async (member) => {
                try {
                    const charData = member.character;
                    const rank = member.rank;

                    // Check if this character belongs to a registered user
                    const existingUserChar = await prisma.character.findFirst({
                        where: {
                            name: charData.name.toLowerCase(),
                            realm: charData.realm.slug,
                            userId: { not: null } // Only check if it has a user
                        },
                        select: { userId: true }
                    });

                    const assignedUserId = existingUserChar?.userId ?? undefined;

                    // Basic upsert without external API calls for details
                    const upsertedChar = await prisma.character.upsert({
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
                            faction: guild.faction, // Assume guild faction
                            rank: rank,
                            lastSync: new Date(),
                            userId: assignedUserId, // Keep existing user link if any
                        },
                        create: {
                            userId: assignedUserId, // Optional now!
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
                            averageItemLevel: 0, // Default
                            mythicRating: 0,     // Default
                            raidProgress: '-',   // Default
                            lastSync: new Date(),
                            isActive: true,
                        }
                    });

                    // Link to User if exists (and userId is present)
                    if (upsertedChar.userId) {
                        await prisma.userGuild.upsert({
                            where: { userId_guildId: { userId: upsertedChar.userId, guildId: guildId } },
                            update: { rank: rank },
                            create: { userId: upsertedChar.userId, guildId: guildId, rank: rank }
                        });
                    }
                    syncStats.updated++;
                } catch (err) {
                    console.error(`Error processing member ${member.character.name}:`, err);
                    syncStats.errors++;
                }
            });

            // Wait for basic sync to finish
            await Promise.all(statsPromises);
            console.log(`[RosterService] Phase 1 complete: ${syncStats.updated} members upserted.`);

            // PHASE 2: Detailed Stats (Background / Incremental)
            console.log(`[RosterService] Phase 2: Fetching details for ${members.length} members...`);

            // Helper to process in chunks to avoid rate limits / timeouts
            const chunk = <T>(arr: T[], size: number): T[][] =>
                Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                    arr.slice(i * size, i * size + size)
                );

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
                                    const CURRENT_RAID_NAME = 'Befreiung von Lorenhall'; // Should be dynamic/constant
                                    let targetRaid = null;

                                    // Find current raid
                                    for (let i = raids.expansions.length - 1; i >= 0; i--) {
                                        const exp = raids.expansions[i];
                                        if (exp.instances) {
                                            const found = exp.instances.find((inst: any) => inst.instance.name === CURRENT_RAID_NAME);
                                            if (found) { targetRaid = found; break; }
                                        }
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
                                role: role && !prisma.character.findFirst({ where: { id: charData.id, role: { not: null } } }) ? role : undefined
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
}
