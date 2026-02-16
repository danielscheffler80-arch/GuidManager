import { Request, Response } from 'express';
import prisma from '../prisma';
import axios from 'axios';

export class GuildController {
    // Holt Zusammenfassung für das Dashboard
    static async getDashboardSummary(req: Request, res: Response) {
        const userId = (req as any).user?.userId;

        try {
            // 1. Finde Main Charakter
            const mainChar = await prisma.character.findFirst({
                where: { userId, isMain: true },
                include: { guild: true }
            });

            if (!mainChar) {
                return res.json({
                    success: true,
                    hasMain: false,
                    message: 'Kein Main-Charakter ausgewählt.'
                });
            }

            // 2. Hole Gilden-Info
            const guild = mainChar.guild;

            // 3. Hole anstehende Raids (nächste 7 Tage)
            const upcomingRaids = await prisma.raid.findMany({
                where: {
                    guildId: mainChar.guildId || -1,
                    startTime: { gte: new Date() }
                },
                take: 3,
                orderBy: { startTime: 'asc' }
            });

            // 4. Hole M+ Daten des Users (aktuelle ID-Woche - vereinfacht)
            const myKeys = await prisma.mythicKey.findMany({
                where: { characterId: mainChar.id },
                orderBy: { level: 'desc' },
                take: 1
            });

            // 5. Dummy Announcements (Später aus DB)
            const announcements = [
                { id: 1, title: 'Raid-Vorbereitung', content: 'Bitte denkt an Flasks und Food für Mittwoch.', date: new Date() },
                { id: 2, title: 'Gilden-Treffen', content: 'Nächsten Sonntag im Discord.', date: new Date() }
            ];

            res.json({
                success: true,
                hasMain: true,
                mainCharacter: {
                    name: mainChar.name,
                    class: mainChar.class,
                    classId: mainChar.classId,
                    level: mainChar.level
                },
                guild: {
                    name: guild?.name,
                    realm: guild?.realm,
                    faction: guild?.faction
                },
                announcements,
                raids: upcomingRaids,
                mythicPlus: myKeys[0] || null,
                streams: [] // Später implementieren
            });

        } catch (error) {
            console.error('Dashboard Hub error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
        }
    }

    // Aktualisiert die Admin-Ränge
    static async updateAdminRanks(req: Request, res: Response) {
        const { guildId } = req.params;
        const { ranks } = req.body; // Array of numbers

        if (!Array.isArray(ranks)) {
            return res.status(400).json({ success: false, error: 'Ranks must be an array of numbers' });
        }

        try {
            const guild = await prisma.guild.update({
                where: { id: Number(guildId) },
                data: { adminRanks: ranks.map(Number) }
            });

            res.json({ success: true, adminRanks: guild.adminRanks });
        } catch (error) {
            console.error('Update admin ranks error:', error);
            res.status(500).json({ success: false, error: 'Failed to update admin ranks' });
        }
    }

    // Holt alle verfügbaren Ränge aus der Gilde (Blizzard API)
    static async getGuildRanks(req: Request, res: Response) {
        const { guildId } = req.params;

        try {
            const guild = await prisma.guild.findUnique({
                where: { id: Number(guildId) }
            });

            if (!guild) {
                return res.status(404).json({ success: false, error: 'Guild not found' });
            }

            // Fallback: Standard WoW Ränge 0-9
            const defaultRanks = [
                { id: 0, name: 'Gildenleiter' },
                { id: 1, name: 'Offizier' },
                { id: 2, name: 'Veteran' },
                { id: 3, name: 'Mitglied' },
                { id: 4, name: 'Raider' },
                { id: 5, name: 'Alt' },
                { id: 6, name: 'Twink' },
                { id: 7, name: 'Rekrut' },
                { id: 8, name: 'Social' },
                { id: 9, name: 'Gast' }
            ];

            let ranks = defaultRanks;

            // If we have ranks in DB, use them (they were synced during roster sync)
            if (guild.ranks && Array.isArray(guild.ranks) && guild.ranks.length > 0) {
                ranks = (guild.ranks as any[]).map(r => ({
                    id: r.id ?? r.rank,
                    name: r.name?.de_DE || r.name || `Rang ${r.id ?? r.rank}`
                }));
            }

            res.json({
                success: true,
                ranks: ranks,
                currentAdminRanks: guild.adminRanks,
                currentVisibleRanks: guild.visibleRanks.length > 0 ? guild.visibleRanks : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            });

        } catch (error) {
            console.error('Get guild ranks error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch guild ranks' });
        }
    }

    // Aktualisiert die sichtbaren Ränge
    static async updateVisibleRanks(req: Request, res: Response) {
        const { guildId } = req.params;
        const { ranks } = req.body; // Array of numbers

        if (!Array.isArray(ranks)) {
            return res.status(400).json({ success: false, error: 'Ranks must be an array of numbers' });
        }

        try {
            const guild = await prisma.guild.update({
                where: { id: Number(guildId) },
                data: { visibleRanks: ranks.map(Number) }
            });

            res.json({ success: true, visibleRanks: guild.visibleRanks });
        } catch (error) {
            console.error('Update visible ranks error:', error);
            res.status(500).json({ success: false, error: 'Failed to update visible ranks' });
        }
    }
}
