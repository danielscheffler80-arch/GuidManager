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

        // Resolve names in bulk
        const uniqueSenders = [...new Set(messages.map((m: any) => m.sender))] as string[];
        const users = await prisma.user.findMany({
            where: { name: { in: uniqueSenders } },
            include: {
                characters: {
                    where: { isMain: true },
                    take: 1
                }
            }
        }) as any[];

        // Capitalize first letter helper
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

        const nameMap = new Map<string, { name: string, classId?: number }>();
        users.forEach(u => {
            if (u.characters && u.characters.length > 0) {
                const char = u.characters[0];
                nameMap.set(u.name, {
                    name: capitalize(char.name),
                    classId: char.classId
                });
            } else {
                nameMap.set(u.name, {
                    name: capitalize(u.name.split('#')[0])
                });
            }
        });

        const resolvedMessages = messages.map((m: any) => {
            const resolved = nameMap.get(m.sender) || { name: capitalize(m.sender.split('#')[0]) };
            return {
                ...m,
                sender: resolved.name,
                classId: resolved.classId
            };
        });

        res.json(resolvedMessages.reverse());
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
};
