import { Router } from 'express';
import { SyncController } from '../controllers/syncController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// 5-Phase initial sync
router.post('/initial/account', authenticateToken, SyncController.syncAccount);    // Phase 1
router.post('/initial/discover', authenticateToken, SyncController.discoverCharacters); // Phase 2
router.post('/initial/guilds', authenticateToken, SyncController.syncGuilds);        // Phase 3
router.post('/initial/addon', authenticateToken, SyncController.syncAddonData);      // Phase 4
router.post('/initial/history', authenticateToken, SyncController.loadChatHistory);  // Phase 5

router.post('/initial/finalize', authenticateToken, SyncController.finalize);
router.post('/initial/reset', authenticateToken, SyncController.resetInitialSync);

// Consolidated Full Sync
router.post('/full', authenticateToken, SyncController.fullSync);

// Debugger
router.get('/debug/logs', authenticateToken, SyncController.getLogs);

// Admin
router.post('/admin/wipe', authenticateToken, SyncController.wipeDatabase);

export default router;
