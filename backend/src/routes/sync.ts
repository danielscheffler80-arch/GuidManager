import { Router } from 'express';
import { SyncController } from '../controllers/syncController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Step-based initial sync
router.post('/initial/account', authenticateToken, SyncController.syncAccount);
router.post('/initial/guilds', authenticateToken, SyncController.syncGuilds);
router.post('/initial/guild/:guildId', authenticateToken, SyncController.syncSingleGuild);
router.post('/initial/finalize', authenticateToken, SyncController.finalize);

export default router;
