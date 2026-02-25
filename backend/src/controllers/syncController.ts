import { Request, Response } from 'express';
import prisma from '../prisma';
import { BattleNetAPIService } from '../services/battleNetAPIService';
import { SyncLogService, SyncCategory } from '../services/syncLogService';
import { MythicPlusService } from '../services/mythicPlusService';

export class SyncController {
    /**
     * Phase 1: Sync Account Data (Check Battle.net ID)
     */
    static async syncAccount(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await SyncLogService.clearLogs(userId);
            await SyncLogService.log(userId, 1, SyncCategory.SYSTEM, 'Starting Phase 1: Account Sync');

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.accessToken === null) {
                await SyncLogService.log(userId, 1, SyncCategory.ERROR, 'User or token missing');
                return res.status(401).json({ success: false, error: 'User not found or no token' });
            }

            await SyncLogService.log(userId, 1, SyncCategory.BNET_API_INPUT, `Checking account for Battle.net ID: ${user.battleNetId}`);

            // Phase 1 is basically just verifying the profile
            await SyncLogService.log(userId, 1, SyncCategory.CLOUD_DB_OUTPUT, `Verified account for user ${user.name}`);

            res.json({ success: true, message: 'Phase 1: Account sync successful' });
        } catch (error: any) {
            await SyncLogService.log(userId, 1, SyncCategory.ERROR, `Phase 1 failed: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Phase 2: Character & Guild Discovery
     */
    static async discoverCharacters(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await SyncLogService.log(userId, 2, SyncCategory.SYSTEM, 'Starting Phase 2: Character & Guild Discovery');

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.accessToken === null) {
                return res.status(401).json({ success: false, error: 'User not found' });
            }

            const service = new BattleNetAPIService(user.accessToken);
            await service.syncUserCharactersData(user.id, false);

            await SyncLogService.log(userId, 2, SyncCategory.SYSTEM, 'Phase 2: Discovery completed');
            res.json({ success: true, message: 'Phase 2: Character and guild discovery successful' });
        } catch (error: any) {
            await SyncLogService.log(userId, 2, SyncCategory.ERROR, `Phase 2 failed: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Phase 3: Deep Guild Sync
     */
    static async syncGuilds(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, 'Starting Phase 3: Deep Guild Sync');

            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { guildMemberships: { include: { guild: true } } }
            });

            if (!user || user.accessToken === null) {
                return res.status(401).json({ success: false, error: 'User not found' });
            }

            const guilds = user.guildMemberships.map(m => m.guild);
            await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, `Found ${guilds.length} guilds to deep sync`);

            for (let i = 0; i < guilds.length; i++) {
                const guild = guilds[i];
                await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, `Syncing guild ${i + 1}/${guilds.length}: ${guild.name}`);

                await BattleNetAPIService.syncGuildMembers(userId, guild.id, guild.name, guild.realm, user.accessToken, true);
            }

            await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, 'Phase 3: Deep sync completed');
            res.json({ success: true, message: `Deep sync of ${guilds.length} guilds completed` });
        } catch (error: any) {
            await SyncLogService.log(userId, 3, SyncCategory.ERROR, `Phase 3 failed: ${error.message}`);
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
            const memberCount = await BattleNetAPIService.syncGuildMembers(userId, guild.id, guild.name, guild.realm, user.accessToken, true);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[SYNC] Completed single guild sync for ${guild.name} in ${duration}s. Synced ${memberCount} members.`);

            res.json({ success: true, message: `Sync of ${guild.name} completed` });
        } catch (error: any) {
            console.error('[SYNC] Single guild sync failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Phase 4: Addon-Daten abgleichen
     */
    static async syncAddonData(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await SyncLogService.log(userId, 4, SyncCategory.SYSTEM, 'Starting Phase 4: Addon data (Mythic+ Keys)');

            // For now, we just log that we are ready for addon data.
            // In a real flow, the desktop app would send data, but here we can simulate 
            // a check for existing addon data or simply mark it as ready.
            await SyncLogService.log(userId, 4, SyncCategory.SYSTEM, 'Phase 4: Addon synchronization ready');

            res.json({ success: true, message: 'Phase 4: Addon sync ready' });
        } catch (error: any) {
            await SyncLogService.log(userId, 4, SyncCategory.ERROR, `Phase 4 failed: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Phase 5: Chat-History laden
     */
    static async loadChatHistory(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            await SyncLogService.log(userId, 5, SyncCategory.SYSTEM, 'Starting Phase 5: Chat History');

            // Logic to fetch last messages from cloud DB
            const messages = await prisma.guildChat.findMany({
                take: 50,
                orderBy: { timestamp: 'desc' }
            });

            await SyncLogService.log(userId, 5, SyncCategory.CLOUD_DB_OUTPUT, `Loaded ${messages.length} messages from Chat History`, { messageCount: messages.length });

            res.json({ success: true, message: 'Phase 5: Chat history loaded' });
        } catch (error: any) {
            await SyncLogService.log(userId, 5, SyncCategory.ERROR, `Phase 5 failed: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Step 6: Finalization
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
     * Get Sync Logs for Debugger
     */
    static async getLogs(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            const logs = await SyncLogService.getLogs(userId);
            res.json({ success: true, logs });
        } catch (error: any) {
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
