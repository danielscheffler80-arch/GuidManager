import { Request, Response } from 'express';
import prisma from '../prisma';

export const getGuildChatHistory = async (req: Request, res: Response) => {
    try {
        const guildId = parseInt(req.params.guildId);
        if (isNaN(guildId)) {
            return res.status(400).json({ error: 'Invalid guild ID' });
        }

        // Fetch last 50 messages
        // Since we want the LATEST 50, we sort by desc, take 50, then reverse
        const messages = await prisma.guildChat.findMany({
            where: { guildId },
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        // Return in chronological order
        res.json(messages.reverse());
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
};
