import prisma from '../prisma';

export enum SyncCategory {
    BNET_API_INPUT = 'BNET_API_INPUT',
    CLOUD_DB_OUTPUT = 'CLOUD_DB_OUTPUT',
    SYSTEM = 'SYSTEM',
    ERROR = 'ERROR'
}

export class SyncLogService {
    /**
     * Logs a sync event to the database for debugging purposes.
     */
    static async log(userId: number, phase: number, category: SyncCategory, message: string, data?: any) {
        try {
            await (prisma as any).syncLog.create({
                data: {
                    userId,
                    phase,
                    category,
                    message,
                    data: data ? data : undefined
                }
            });

            console.log(`[SYNC-LOG] [Phase ${phase}] [${category}] ${message}`);
        } catch (error) {
            console.error('[SYNC-LOG] Failed to write log:', error);
        }
    }

    /**
     * Clears old logs for a user to prevent DB bloat.
     */
    static async clearLogs(userId: number) {
        try {
            await (prisma as any).syncLog.deleteMany({
                where: { userId }
            });
        } catch (error) {
            console.error('[SYNC-LOG] Failed to clear logs:', error);
        }
    }

    /**
     * Retrieves the latest logs for a user.
     */
    static async getLogs(userId: number, limit: number = 50) {
        return await (prisma as any).syncLog.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }
}
