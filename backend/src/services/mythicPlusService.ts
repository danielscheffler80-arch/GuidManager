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
            console.log(`[MythicPlusService] Fetching keys for guild ${guildId} with global alts...`);

            // 1. Get all user IDs that have at least one character in this guild
            const guildMemberUserIds = await prisma.character.findMany({
                where: { guildId: guildId, isActive: true, userId: { not: null } },
                select: { userId: true },
                distinct: ['userId']
            });

            const userIds = guildMemberUserIds.map(u => u.userId as number);

            if (userIds.length === 0) return [];

            // 2. Fetch ALL relevant characters for these users:
            // - Characters in THIS guild
            // - OR Characters where THIS guild is in their allowedGuildIds
            const allCharacters = await prisma.character.findMany({
                where: {
                    userId: { in: userIds },
                    isActive: true,
                    OR: [
                        { guildId: guildId },
                        { allowedGuildIds: { has: guildId } },
                        // Default behavior: if isFavorite and allowedGuildIds is empty, show everywhere
                        {
                            isFavorite: true,
                            allowedGuildIds: { equals: [] }
                        }
                    ]
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

            // 3. Group by User
            const result = [];

            for (const userId of userIds) {
                const userChars = allCharacters.filter(c => c.userId === userId);
                const mainChar = userChars.find(c => c.isMain);

                // No main selected = no appearance in dashboard
                if (!mainChar) continue;

                // Alts are all favorite chars (regardless of guild) + non-main chars in this guild
                const alts = userChars.filter(c => c.id !== mainChar.id);

                // Collect all incoming applications on the keys of this user
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
    static async processAddonSync(keys: any[], userId?: number) {
        console.log(`[MythicPlusService] Processing ${keys.length} keys from sync (UserId: ${userId || 'anonymous'})...`);
        const results = { matched: [] as string[], skipped: [] as string[] };

        // ... (DUNGEON_MAP remains same) ...
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
                // AUTO-LINK: If character is found but belongs to no user, link it to the sender
                if (userId && !character.userId) {
                    console.log(`[MythicPlusService] Auto-linking ${character.name} to UserID ${userId}`);
                    await prisma.character.update({
                        where: { id: character.id },
                        data: { userId }
                    });
                }

                results.matched.push(`${character.name}-${character.realm}`);
                // ... (existing key processing logic) ...
                try {
                    // Check if this character already has a bag key
                    const existingKey = await prisma.mythicKey.findFirst({
                        where: { characterId: character.id, isFromBag: true }
                    });

                    const newTimestamp = key.timestamp ? new Date(key.timestamp * 1000) : new Date();

                    if (existingKey) {
                        const existingTimestamp = existingKey.updatedAt;

                        if (key.timestamp && newTimestamp < existingTimestamp) {
                            continue;
                        }

                        if (existingKey.dungeon === dungeonName && existingKey.level === key.level) {
                            await prisma.mythicKey.update({
                                where: { id: existingKey.id },
                                data: { updatedAt: new Date() }
                            });
                            continue;
                        }

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
