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
                                            name: true,
                                            realm: true,
                                            class: true,
                                            classId: true
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
        return await (prisma as any).mythicKeySignup.create({
            data: {
                keyId,
                characterId,
                primaryRole,
                secondaryRole,
                message,
                status: 'pending'
            }
        });
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
