// User Routes
// Definiert alle User-bezogenen Endpoints

import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// User Profile Routes
router.get('/profile', authenticateToken, UserController.getProfile);
router.post('/characters/sync', authenticateToken, UserController.syncCharacters);
router.post('/characters/main', authenticateToken, UserController.setMainCharacter);
router.get('/guilds', authenticateToken, UserController.getGuilds);
router.patch('/characters/:id', authenticateToken, UserController.updateCharacter);

export default router;