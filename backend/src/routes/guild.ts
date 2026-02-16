import { Router } from 'express';
import { GuildController } from '../controllers/guildController';
import { authenticateToken } from '../middleware/authMiddleware';
import { checkPermission } from '../middleware/permissionMiddleware';

const router = Router();

router.get('/dashboard', authenticateToken, GuildController.getDashboardSummary);
router.get('/:guildId/ranks', authenticateToken, GuildController.getGuildRanks);
router.post('/:guildId/admin-ranks', authenticateToken, checkPermission('edit_roster'), GuildController.updateAdminRanks);

export default router;
