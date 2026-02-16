// Auth Routes
// Definiert alle Authentication Endpoints

import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// OAuth Flow Routes
router.get('/battlenet', AuthController.login);
router.get('/callback', AuthController.callback);
router.get('/status/:state', AuthController.checkStatus);
router.post('/logout', authenticateToken, AuthController.logout);
router.post('/refresh', AuthController.refreshToken);

// User Info Route
router.get('/me', authenticateToken, AuthController.me);

// Character Management Routes
router.get('/characters', authenticateToken, AuthController.getCharacters);
router.post('/main-character', authenticateToken, AuthController.setMainCharacter);
router.post('/favorite-character', authenticateToken, AuthController.toggleFavoriteCharacter);

// Debug Route
router.post('/debug/log', AuthController.debug);

// Deferred Sync Route
router.post('/sync', authenticateToken, AuthController.syncCharacters);

export default router;