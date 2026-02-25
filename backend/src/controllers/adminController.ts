import { Request, Response } from 'express';
import prisma from '../prisma';

export class AdminController {
    /**
     * List all database models (tables)
     */
    static async listTables(req: any, res: Response) {
        // We manually define the tables we want to expose to avoid exposing internal Prisma stuff
        const tables = [
            'user', 'character', 'guild', 'guildChat', 'roster',
            'userGuild', 'raid', 'attendance', 'mythicKey',
            'mythicKeySignup', 'stream', 'privateMessage', 'syncLog'
        ];
        res.json({ success: true, tables });
    }

    /**
     * Get records for a specific table
     */
    static async getTableRecords(req: any, res: Response) {
        const { table } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        try {
            const model = (prisma as any)[table];
            if (!model) {
                return res.status(404).json({ success: false, error: 'Table not found' });
            }

            const [records, total] = await Promise.all([
                model.findMany({
                    skip,
                    take: limit,
                    orderBy: { id: 'desc' }
                }),
                model.count()
            ]);

            res.json({ success: true, records, total, page, totalPages: Math.ceil(total / limit) });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update a record in a specific table
     */
    static async updateRecord(req: any, res: Response) {
        const { table, id } = req.params;
        const data = req.body;

        try {
            const model = (prisma as any)[table];
            if (!model) {
                return res.status(404).json({ success: false, error: 'Table not found' });
            }

            // Remove id from data to avoid primary key update errors
            const { id: _, createdAt: __, updatedAt: ___, ...updateData } = data;

            const record = await model.update({
                where: { id: parseInt(id) },
                data: updateData
            });

            res.json({ success: true, record });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Delete a record from a specific table
     */
    static async deleteRecord(req: any, res: Response) {
        const { table, id } = req.params;

        try {
            const model = (prisma as any)[table];
            if (!model) {
                return res.status(404).json({ success: false, error: 'Table not found' });
            }

            await model.delete({
                where: { id: parseInt(id) }
            });

            res.json({ success: true, message: 'Record deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Execute a nuclear wipe and reset
     */
    static async fullReset(req: any, res: Response) {
        // This is a wrapper around the wipe/reset logic
        // We can just call the wipeDatabase method from SyncController or re-implement here
        // Re-implementing for independence
        try {
            const tables = [
                'sync_logs', 'mythic_key_signups', 'mythic_keys', 'attendances',
                'raids', 'rosters', 'guild_chats', 'user_guilds',
                'private_messages', 'streams', 'characters', 'guilds'
            ];

            for (const table of tables) {
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
            }

            await prisma.user.updateMany({
                data: { initialSyncCompletedAt: null }
            });

            res.json({ success: true, message: 'Full system reset completed' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
