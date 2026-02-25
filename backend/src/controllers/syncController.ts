import { Request, Response } from 'express';
import prisma from '../prisma';
import { BattleNetAPIService } from '../services/battleNetAPIService';

export class SyncController {
    /**
     * Step 1 & 2: Sync Account Data & Character/Guild Discovery
     * Fetches basic profile and all characters to identify relevant guilds.
     */
    static async syncAccount(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || !user.accessToken) {
                return res.status(401).json({ success: false, error: 'User not found or no token' });
            }

            const service = new BattleNetAPIService(user.accessToken);
            // Basic sync (discovery)
            await service.syncUserCharactersData(user.id, false);

            res.json({ success: true, message: 'Account data and character discovery successful' });
        } catch (error: any) {
            console.error('[SYNC] Step 1/2 failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Step 3: Deep Guild Sync
     * For each guild the user is in, fetch roster and deep member data (RIO, Raid, Keys).
     */
    static async syncGuilds(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { guildMemberships: { include: { guild: true } } }
            });

            if (!user || !user.accessToken) {
                return res.status(401).json({ success: false, error: 'User not found' });
            }

            const service = new BattleNetAPIService(user.accessToken);
            const guilds = user.guildMemberships.map(m => m.guild);

            console.log(`[SYNC] Deep syncing ${guilds.length} guilds for user ${user.name}`);

            for (let i = 0; i < guilds.length; i++) {
                const guild = guilds[i];
                const startTime = Date.now();
                console.log(`[SYNC] [${i + 1}/${guilds.length}] Starting deep roster sync for ${guild.name} (${guild.realm})...`);

                const memberCount = await BattleNetAPIService.syncGuildMembers(guild.id, guild.name, guild.realm, user.accessToken, true);

                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[SYNC] [${i + 1}/${guilds.length}] Completed ${guild.name} in ${duration}s. Synced ${memberCount} members.`);
            }

            res.json({ success: true, message: `Deep sync of ${guilds.length} guilds completed` });
        } catch (error: any) {
            console.error('[SYNC] Step 3 failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Sync a single guild specifically.
     */
    static async syncSingleGuild(req: any, res: Response) {
        const userId = req.user.userId;
        const guildId = parseInt(req.params.guildId);
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || !user.accessToken) {
                return res.status(401).json({ success: false, error: 'Auth failed' });
            }

            const guild = await prisma.guild.findUnique({ where: { id: guildId } });
            if (!guild) {
                return res.status(404).json({ success: false, error: 'Guild not found' });
            }

            console.log(`[SYNC] Deep syncing single guild: ${guild.name} for user ${user.name}`);
            const startTime = Date.now();
            const memberCount = await BattleNetAPIService.syncGuildMembers(guild.id, guild.name, guild.realm, user.accessToken, true);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[SYNC] Completed single guild sync for ${guild.name} in ${duration}s. Synced ${memberCount} members.`);

            res.json({ success: true, message: `Sync of ${guild.name} completed` });
        } catch (error: any) {
            console.error('[SYNC] Single guild sync failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Step 4 & 5: Finalization
     * Mark initial sync as completed.
     */
    static async finalize(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { initialSyncCompletedAt: new Date() }
            });
            res.json({ success: true, message: 'Initial sync finalized' });
        } catch (error: any) {
            console.error('[SYNC] Finalization failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Debug: Reset Initial Sync status
     */
    static async resetInitialSync(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { initialSyncCompletedAt: null }
            });
            res.json({ success: true, message: 'Initial sync status reset' });
        } catch (error: any) {
            console.error('[SYNC] Reset failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
