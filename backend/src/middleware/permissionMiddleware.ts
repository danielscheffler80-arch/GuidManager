import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import prisma from '../prisma';

export const checkPermission = (action: 'edit_roster' | 'edit_raids') => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            // 1. Superuser Bypass (Test User ID 100379014)
            if (String(user.battlenetId) === '100379014') {
                return next();
            }

            const { guildId } = req.params;
            const id = Number(guildId);

            if (Number.isNaN(id)) {
                // Wenn keine GuildId in Params, vielleicht im Body?
                const bodyGuildId = req.body.guildId;
                if (bodyGuildId) {
                    return checkUserPermissionForGuild(user.userId, Number(bodyGuildId), res, next);
                }
                return res.status(400).json({ success: false, error: 'Guild ID required for permission check' });
            }

            return checkUserPermissionForGuild(user.userId, id, res, next);
        } catch (error) {
            console.error('Permission Check Error:', error);
            res.status(500).json({ success: false, error: 'Internal server error during permission check' });
        }
    };
};

async function checkUserPermissionForGuild(userId: number, guildId: number, res: Response, next: NextFunction) {
    // Hole Gilde und Mitgliedschaft
    const [guild, membership] = await Promise.all([
        prisma.guild.findUnique({ where: { id: guildId } }),
        prisma.userGuild.findUnique({
            where: {
                userId_guildId: {
                    userId,
                    guildId
                }
            }
        })
    ]);

    if (!guild) {
        return res.status(404).json({ success: false, error: 'Guild not found' });
    }

    if (!membership) {
        return res.status(403).json({ success: false, error: 'You are not a member of this guild' });
    }

    // 2. Gildenleiter Bypass (Rank 0)
    if (membership.rank === 0) {
        return next();
    }

    // 3. Admin Ranks Check
    if (guild.adminRanks.includes(membership.rank)) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'You do not have permission to perform this action'
    });
}
