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

            // 1. Finde alle User-IDs, die Mitglieder dieser Gilde sind (via UserGuild)
            const memberships = await prisma.userGuild.findMany({
                where: { guildId },
                select: { userId: true }
            });
            const memberUserIds = memberships.map(m => m.userId).filter(id => id !== null) as number[];

            // 2. Hole ALLE Charaktere dieser User + alle Charaktere, die direkt der Gilde zugeordnet sind
            const characters = await prisma.character.findMany({
                where: {
                    OR: [
                        { guildId: guildId },
                        { userId: { in: memberUserIds } }
                    ],
                    isActive: true
                },
                include: {
                    mythicKeys: {
                        orderBy: { level: 'desc' }
                    },
                    mythicSignups: {
                        include: {
                            character: true
                        }
                    }
                }
            });

            console.log(`[MythicPlusService] Found ${characters.length} characters related to guild ${guildId}.`);

            // 3. Gruppierung nach Usern (da wir Alts unter Mains zeigen wollen)
            // Wir brauchen eine Liste von Usern, die Charaktere in dieser Gilde haben
            const usersWithChars = [...new Set(characters.map(c => c.userId).filter(id => id !== null))] as number[];

            // 4. Baue das Ergebnis auf
            // Wir zeigen pro User einen "Main" Eintrag. 
            // Wenn ein User mehrere Chars hat, nehmen wir den mit isMain=true als Kopf, sonst den ersten.
            const result = [];
            const processedUserIds = new Set<number>();

            for (const char of characters) {
                if (!char.userId) {
                    // Charaktere ohne User (nur im Roster) zeigen wir als eigene Einträge
                    result.push({
                        ...char,
                        alts: [],
                        keys: char.mythicKeys,
                        signups: char.mythicSignups || []
                    });
                    continue;
                }

                if (processedUserIds.has(char.userId)) continue;

                // Alle Chars dieses Users finden
                const userChars = characters.filter(c => c.userId === char.userId);

                // Haupt-Charakter für diesen User finden (bevorzugt isMain)
                const mainChar = userChars.find(c => c.isMain) || userChars[0];
                const alts = userChars.filter(c => c.id !== mainChar.id);

                result.push({
                    ...mainChar,
                    alts: alts.map(alt => ({
                        ...alt,
                        keys: alt.mythicKeys
                    })),
                    keys: mainChar.mythicKeys,
                    signups: mainChar.mythicSignups || []
                });

                processedUserIds.add(char.userId);
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
    static async signupForKey(keyId: number, characterId: number, message?: string) {
        return await (prisma as any).mythicKeySignup.create({
            data: {
                keyId,
                characterId,
                message,
                status: 'pending'
            }
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
