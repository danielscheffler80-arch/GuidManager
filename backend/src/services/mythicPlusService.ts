// @ts-nocheck
import prisma from '../prisma';
import { BattleNetAPIService } from './battleNetAPIService';

export class MythicPlusService {
    /**
     * Get all Mythic+ keys for a guild, grouped by Main character.
     * Optimized to avoid massive join overhead.
     */
    static async getGuildKeysGrouped(guildId: number) {
        try {
            console.log(`[MythicPlusService] Fetching keys for guild ${guildId}...`);

            // 1. Hole ALLE Charaktere dieser Gilde ODER die mit der Gilde assoziiert sind
            const characters = await prisma.character.findMany({
                where: {
                    guildId: guildId,
                    isActive: true
                },
                include: {
                    mythicKeys: {
                        orderBy: { level: 'desc' },
                        include: {
                            signups: {
                                include: {
                                    character: {
                                        select: {
                                            id: true,
                                            userId: true,
                                            name: true,
                                            realm: true,
                                            class: true,
                                            classId: true,
                                            mythicRating: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            console.log(`[MythicPlusService] Found ${characters.length} characters related to guild ${guildId}.`);

            // 3. Gruppierung nach Usern (da wir Alts unter Mains zeigen wollen)
            const result = [];
            const processedUserIds = new Set<number>();

            for (const char of characters) {
                // Bedingung: "als Main können nur die angezeigt werden, die in unserer app angemeldet sind und ihren main ausgewählt haben"
                if (!char.userId) {
                    continue; // Überspringen, da nicht angemeldeter Charakter
                }

                if (processedUserIds.has(char.userId)) continue;

                // Alle Chars dieses Users finden, die in DIESER Gilde sind
                const userChars = characters.filter(c => c.userId === char.userId);

                // Haupt-Charakter für diesen User finden (zwingend isMain)
                const mainChar = userChars.find(c => c.isMain);

                // STRICT FILTERING: If the user hasn't explicitly set a main, they don't appear in M+ dashboard.
                if (!mainChar) {
                    continue;
                }

                processedUserIds.add(char.userId);

                const alts = userChars.filter(c => c.id !== mainChar.id && c.isFavorite);

                // Sammle alle eingehenden Bewerbungen auf die Keys dieses Users (Main + Alts)
                const allKeysOfUser = [...mainChar.mythicKeys, ...alts.flatMap(a => a.mythicKeys)];
                const allSignups = allKeysOfUser.flatMap(k =>
                    k.signups.map(s => ({
                        ...s,
                        key: {
                            id: k.id,
                            dungeon: k.dungeon,
                            level: k.level
                        }
                    }))
                );

                result.push({
                    ...mainChar,
                    alts: alts.map(alt => ({
                        ...alt,
                        keys: alt.mythicKeys
                    })),
                    keys: mainChar.mythicKeys,
                    signups: allSignups
                });
            }

            console.log(`[MythicPlusService] Successfully grouped ${result.length} entries.`);
            return result;
        } catch (error) {
            console.error('[MythicPlusService] Error in getGuildKeysGrouped:', error);
            throw error;
        }
    }

    /**
     * Signup for a specific key
     */
    static async signupForKey(keyId: number, characterId: number, primaryRole: string, secondaryRole?: string, message?: string) {
        try {
            console.log(`[MythicPlusService] Signing up: key=${keyId}, char=${characterId}, role=${primaryRole}`);

            // Check if key exists
            const key = await prisma.mythicKey.findUnique({ where: { id: keyId } });
            if (!key) {
                console.error(`[MythicPlusService] Key ${keyId} not found`);
                throw new Error(`Key ${keyId} not found`);
            }

            // Check if character exists
            const char = await prisma.character.findUnique({ where: { id: characterId } });
            if (!char) {
                console.error(`[MythicPlusService] Character ${characterId} not found`);
                throw new Error(`Character ${characterId} not found`);
            }

            return await (prisma as any).mythicKeySignup.upsert({
                where: {
                    keyId_characterId: {
                        keyId,
                        characterId
                    }
                },
                create: {
                    keyId,
                    characterId,
                    primaryRole,
                    secondaryRole,
                    message,
                    status: 'pending'
                },
                update: {
                    primaryRole,
                    secondaryRole,
                    message,
                }
            });
        } catch (error: any) {
            console.error(`[MythicPlusService] Signup error:`, error);
            throw error;
        }
    }

    /**
     * Update signup status (accept/decline)
     */
    static async updateSignupStatus(signupId: number, status: string) {
        return await (prisma as any).mythicKeySignup.update({
            where: { id: signupId },
            data: { status }
        });
    }

    /**
     * Remove a signup
     */
    static async removeSignup(signupId: number) {
        return await (prisma as any).mythicKeySignup.delete({
            where: { id: signupId }
        });
    }

    /**
     * Process keys from Addon/Desktop sync
     */
    static async processAddonSync(keys: any[]) {
        console.log(`[MythicPlusService] Processing ${keys.length} keys from sync...`);
        const results = { matched: [] as string[], skipped: [] as string[] };

        // Dungeon Map for resolving MapIDs
        const DUNGEON_MAP: Record<number, string> = {
            // TWW Dungeons
            501: 'The Stonevault', 502: 'City of Threads', 503: 'Ara-Kara, City of Echoes',
            504: 'Darkflame Cleft', 505: 'The Dawnbreaker', 506: 'Cinderbrew Meadery',
            507: 'Grim Batol', 499: 'Priory of the Sacred Flame', 500: 'The Rookery',
            525: 'Operation: Floodgate', 542: 'Eco-Dome Al\'dani',
            // Shadowlands
            375: 'Mists of Tirna Scithe', 376: 'The Necrotic Wake', 378: 'Halls of Atonement',
            382: 'Theater of Pain',
            // BfA
            353: 'Siege of Boralus', 247: 'The MOTHERLODE!!',
            370: 'Mechagon Workshop',
            // Shadowlands M+ returning
            391: 'Tazavesh: Streets of Wonder', 392: 'Tazavesh: So\'leah\'s Gambit',
            // Legion 
            197: 'Eye of Azshara', 198: 'Darkheart Thicket', 199: 'Black Rook Hold',
            200: 'Halls of Valor', 206: 'Neltharion\'s Lair', 207: 'Vault of the Wardens',
            208: 'Maw of Souls', 209: 'The Arcway', 210: 'Court of Stars',
            227: 'Return to Karazhan: Lower', 233: 'Cathedral of Eternal Night',
            234: 'Return to Karazhan: Upper', 239: 'Seat of the Triumvirate',
        };

        for (const key of keys) {
            const lowerName = key.name.toLowerCase();
            const lowerRealm = key.realm.toLowerCase();

            // Resolve Dungeon Name
            let dungeonName = key.dungeon;
            if (dungeonName && dungeonName.startsWith('MapID:')) {
                const mapId = parseInt(dungeonName.replace('MapID:', ''));
                dungeonName = DUNGEON_MAP[mapId] || `Dungeon (${mapId})`;
            }

            const character = await prisma.character.findUnique({
                where: { name_realm: { name: lowerName, realm: lowerRealm } }
            });

            if (character) {
                results.matched.push(`${character.name}-${character.realm}`);

                try {
                    // Check if this character already has a bag key
                    const existingKey = await prisma.mythicKey.findFirst({
                        where: { characterId: character.id, isFromBag: true }
                    });

                    // Timestamp logic: 
                    // If we have an existing key, we only update if:
                    // 1. The new key has a timestamp AND it's newer than the current updatedAt/createdAt
                    // 2. The new key is different (dungeon or level) and we want to overwrite

                    const newTimestamp = key.timestamp ? new Date(key.timestamp * 1000) : new Date();

                    if (existingKey) {
                        const existingTimestamp = existingKey.updatedAt;

                        // If new data is older than what we have, skip it
                        if (key.timestamp && newTimestamp < existingTimestamp) {
                            console.log(`[MythicPlusService] Skipping older data for ${character.name} (Source: ${key.source})`);
                            continue;
                        }

                        // If key is identical, just update timestamp to show it's still current
                        if (existingKey.dungeon === dungeonName && existingKey.level === key.level) {
                            await prisma.mythicKey.update({
                                where: { id: existingKey.id },
                                data: { updatedAt: new Date() }
                            });
                            continue;
                        }

                        // Key changed: Delete old one to ensure uniqueness and clean up signups
                        await prisma.mythicKey.delete({ where: { id: existingKey.id } });
                    }

                    // Create new key
                    const newKey = await prisma.mythicKey.create({
                        data: {
                            characterId: character.id,
                            dungeon: dungeonName,
                            level: key.level,
                            affixes: '[]',
                            isFromBag: true,
                            completed: false,
                            createdAt: newTimestamp
                        }
                    });
                    console.log(`[MythicPlusService] SUCCESS: Created key ID ${newKey.id} for ${character.name} (Lvl ${key.level} ${dungeonName}, Source: ${key.source})`);
                } catch (dbErr: any) {
                    console.error(`[MythicPlusService] DB Error for ${character.name}:`, dbErr.message);
                }
            } else {
                results.skipped.push(`${lowerName}-${lowerRealm}`);
            }
        }

        return { success: true, matchedCount: results.matched.length, results };
    }

    /**
     * Sync all Mythic+ data for characters in a guild
     */
    static async syncGuildMythicPlus(guildId: number, accessToken: string) {
        const characters = await prisma.character.findMany({
            where: { guildId, isActive: true },
        });

        for (const char of characters) {
            try {
                await BattleNetAPIService.syncMythicPlusData(char.id, char.name, char.realm, accessToken);
            } catch (error) {
                console.error(`Failed to sync M+ for ${char.name}:`, error);
            }
        }

        return { success: true, count: characters.length };
    }
}
