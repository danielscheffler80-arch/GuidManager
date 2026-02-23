import { Request, Response } from 'express';
import prisma from '../prisma';

export const MessageController = {
    // Send a message
    sendMessage: async (req: Request, res: Response) => {
        try {
            const { senderId, receiverId, content } = req.body;

            if (!senderId || !receiverId || !content) {
                return res.status(400).json({ error: 'Sender, receiver and content are required' });
            }

            const message = await prisma.privateMessage.create({
                data: {
                    senderId,
                    receiverId,
                    content
                },
                include: {
                    sender: {
                        select: { name: true, realm: true, class: true, classId: true }
                    }
                }
            });

            res.status(201).json(message);
        } catch (err: any) {
            console.error(`[MESSAGES] Send error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    },

    // Get messages for a character
    getMessages: async (req: Request, res: Response) => {
        try {
            const { characterId } = req.params;

            const messages = await prisma.privateMessage.findMany({
                where: {
                    OR: [
                        { senderId: Number(characterId) },
                        { receiverId: Number(characterId) }
                    ]
                },
                include: {
                    sender: {
                        select: { name: true, realm: true, class: true, classId: true }
                    },
                    receiver: {
                        select: { name: true, realm: true, class: true, classId: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 50
            });

            res.json(messages);
        } catch (err: any) {
            console.error(`[MESSAGES] Fetch error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    },

    // Mark messages as read
    markAsRead: async (req: Request, res: Response) => {
        try {
            const { characterId, senderId } = req.body;

            await prisma.privateMessage.updateMany({
                where: {
                    receiverId: Number(characterId),
                    senderId: Number(senderId),
                    read: false
                },
                data: {
                    read: true
                }
            });

            res.json({ success: true });
        } catch (err: any) {
            console.error(`[MESSAGES] Mark read error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    },

    // Get unread count
    getUnreadCount: async (req: Request, res: Response) => {
        try {
            const { characterId } = req.params;

            const count = await prisma.privateMessage.count({
                where: {
                    receiverId: Number(characterId),
                    read: false
                }
            });

            res.json({ count });
        } catch (err: any) {
            console.error(`[MESSAGES] Unread count error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    }
};
