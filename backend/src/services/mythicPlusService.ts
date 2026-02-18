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

            // 1. Hole alle Charaktere der Gilde mit ihren Keys
            const characters = await prisma.character.findMany({
                where: { guildId, isActive: true },
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

            console.log(`[MythicPlusService] Found ${characters.length} characters in guild.`);

            // 2. Extrahiere alle User IDs, um die Twinks (Alts) zu finden
            const userIds = characters
                .map(c => c.userId)
                .filter(id => id !== null);

            // 3. Wenn User vorhanden sind, hole alle ihre Charaktere (global), um Alts zuzuordnen
            let allUserCharacters = [];
            if (userIds.length > 0) {
                allUserCharacters = await prisma.character.findMany({
                    where: {
                        userId: { in: userIds as number[] },
                        isActive: true
                    },
                    include: {
                        mythicKeys: {
                            orderBy: { level: 'desc' }
                        }
                    }
                });
            }

            // 4. Gruppierung nach Main-Charakteren
            const mains = characters.filter((c: any) => c.isMain);

            // Spezial-Logik: Falls keine Mains definiert sind ODER wir einfach alle mit Keys sehen wollen:
            // Wir nehmen alle Mains, UND alle Chars die einen Key haben aber keine Alts sind.
            let displayCharacters = [];
            if (mains.length > 0) {
                displayCharacters = mains;
            } else {
                // Wenn keine Mains da sind, zeigen wir alle an, die Keys haben 
                // oder zumindest in der Gilde sind (als Fallback)
                displayCharacters = characters.filter((c: any) => (c.mythicKeys && c.mythicKeys.length > 0) || !c.userId);
            }

            // Falls die Liste immer noch leer ist, nimm einfach alle Gilden-Chars
            if (displayCharacters.length === 0) displayCharacters = characters;

            const result = displayCharacters.map((main: any) => {
                // Alts finden: Chars desselben Users, die nicht dieser Main selbst sind
                const alts = allUserCharacters.filter(
                    (c: any) => c.userId === main.userId && c.id !== main.id
                );

                return {
                    ...main,
                    alts: alts.map((alt: any) => ({
                        ...alt,
                        keys: alt.mythicKeys
                    })),
                    keys: main.mythicKeys,
                    signups: main.mythicSignups || []
                };
            });

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
