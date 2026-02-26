import prisma from '../prisma';
import { BattleNetAPIService } from './battleNetAPIService';
import { RosterService } from './rosterService';
import { MythicPlusService } from './mythicPlusService';
import { SyncLogService, SyncCategory } from './syncLogService';

export class SyncService {
    /**
     * Runs the complete sync process (Phases 1-5) in a single operation.
     */
    static async runFullSync(userId: number) {
        try {
            await SyncLogService.clearLogs(userId);
            await SyncLogService.log(userId, 0, SyncCategory.SYSTEM, 'Starting Full Application Sync (Consolidated)');

            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { guildMemberships: { include: { guild: true } } }
            });

            if (!user || user.accessToken === null) {
                await SyncLogService.log(userId, 0, SyncCategory.ERROR, 'User or token missing');
                throw new Error('User not found or no access token');
            }

            // Phase 1: Account Verification (already done by checkAuth in frontend, but we log it)
            await SyncLogService.log(userId, 1, SyncCategory.SYSTEM, 'Phase 1: Verifying Battle.net Account');
            await SyncLogService.log(userId, 1, SyncCategory.BNET_API_INPUT, `Checking account for Battle.net ID: ${user.battleNetId}`);
            
            // Phase 2: Character & Guild Discovery
            await SyncLogService.log(userId, 2, SyncCategory.SYSTEM, 'Phase 2: Discovering Characters and Guilds');
            const apiService = new BattleNetAPIService(user.accessToken);
            await apiService.syncUserCharactersData(user.id, false);
            await SyncLogService.log(userId, 2, SyncCategory.SYSTEM, 'Phase 2: Discovery completed');

            // Refresh user to get updated memberships after discovery
            const updatedUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { guildMemberships: { include: { guild: true } } }
            });

            const guilds = updatedUser?.guildMemberships.map(m => m.guild) || [];
            
            // Phase 3: Deep Guild Sync
            await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, `Phase 3: Deep Syncing ${guilds.length} Guilds`);
            for (let i = 0; i < guilds.length; i++) {
                const guild = guilds[i];
                try {
                    await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, `Syncing guild ${i + 1}/${guilds.length}: ${guild.name}`);
                    await RosterService.syncRoster(guild.id, user.accessToken, userId);
                } catch (guildErr: any) {
                    console.error(`[SYNC] Failed to sync guild ${guild.name}:`, guildErr.message);
                    await SyncLogService.log(userId, 3, SyncCategory.ERROR, `Phase 3 failed for ${guild.name}: ${guildErr.message}`);
                }
            }
            await SyncLogService.log(userId, 3, SyncCategory.SYSTEM, 'Phase 3: Deep sync completed');

            // Phase 4: Mythic+ Weekly Keys
            await SyncLogService.log(userId, 4, SyncCategory.SYSTEM, 'Phase 4: Syncing Mythic+ Weekly Keys');
            for (let i = 0; i < guilds.length; i++) {
                const guild = guilds[i];
                await SyncLogService.log(userId, 4, SyncCategory.SYSTEM, `Syncing keys for ${guild.name}`);
                await MythicPlusService.syncGuildMythicPlus(guild.id, user.accessToken);
            }
            await SyncLogService.log(userId, 4, SyncCategory.SYSTEM, 'Phase 4: Mythic+ sync completed');

            // Phase 5: Finalization
            await SyncLogService.log(userId, 5, SyncCategory.SYSTEM, 'Phase 5: Finalizing Synchronization');
            await prisma.user.update({
                where: { id: userId },
                data: { initialSyncCompletedAt: new Date() }
            });
            await SyncLogService.log(userId, 5, SyncCategory.SYSTEM, 'Full sync finalized successfully');

            return { 
                success: true, 
                message: 'Full sync completed',
                guildsSynced: guilds.length
            };
        } catch (error: any) {
            console.error('[SyncService] Full sync failed:', error);
            await SyncLogService.log(userId, 0, SyncCategory.ERROR, `Full sync failed: ${error.message}`);
            throw error;
        }
    }
}
