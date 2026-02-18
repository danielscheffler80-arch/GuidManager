// @ts-nocheck
import prisma from '../prisma';
import { BattleNetAPIService } from './battleNetAPIService';

export class MythicPlusService {
    /**
     * Get all Mythic+ keys for a guild, grouped by Main character.
     * Mains without keys themselves but with alts having keys will also be shown.
     */
    static async getGuildKeysGrouped(guildId: number) {
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
                },
                user: {
                    include: {
                        characters: {
                            include: {
                                mythicKeys: {
                                    orderBy: { level: 'desc' }
                                }
                            }
                        }
                    }
                }
            }
        });

        // We only care about characters that have a user attached (to link mains/alts)
        // or characters that are specifically marked as Main.

        const mains = characters.filter((c: any) => c.isMain);
        const result = mains.map((main: any) => {
            const userCharacters = main.user?.characters || [];
            const alts = userCharacters.filter((c: any) => !c.isMain && c.guildId === guildId);

            return {
                ...main,
                alts: alts.map((alt: any) => ({
                    ...alt,
                    keys: alt.mythicKeys
                })),
                keys: main.mythicKeys,
                signups: main.mythicSignups
            };
        });

        return result;
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
