import { Router } from 'express';
import { MessageController } from '../controllers/messageController';

const router = Router();

// Send a message
router.post('/send', MessageController.sendMessage);

// Get messages for a character
router.get('/:characterId', MessageController.getMessages);

// Mark messages as read
router.post('/read', MessageController.markAsRead);

// Get unread count
router.get('/:characterId/unread', MessageController.getUnreadCount);

export default router;
