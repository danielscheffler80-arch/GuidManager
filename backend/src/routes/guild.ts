import { Router } from 'express';
import { GuildController } from '../controllers/guildController';
import { authenticateToken } from '../middleware/authMiddleware';
import { checkPermission } from '../middleware/permissionMiddleware';

const router = Router();

router.get('/dashboard', authenticateToken, GuildController.getDashboardSummary);
router.get('/:guildId/ranks', authenticateToken, GuildController.getGuildRanks);
router.post('/:guildId/admin-ranks', authenticateToken, checkPermission('edit_roster'), GuildController.updateAdminRanks);
router.post('/:guildId/update-progress', authenticateToken, checkPermission('edit_roster'), GuildController.updateRaidProgress);
router.post('/:guildId/exclusive-raid', authenticateToken, checkPermission('edit_roster'), GuildController.updateExclusiveRaid);
router.post('/:guildId/roster/add-external', authenticateToken, checkPermission('edit_roster'), GuildController.addExternalToMainRoster);
router.post('/:guildId/roster/overrides', authenticateToken, checkPermission('edit_roster'), GuildController.updateMainRosterOverrides);
router.post('/:guildId/visible-ranks', authenticateToken, checkPermission('edit_roster'), GuildController.updateVisibleRanks);

export default router;
