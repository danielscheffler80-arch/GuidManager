import { Request, Response } from 'express';
import prisma from '../prisma';
import axios from 'axios';
import { RosterService } from '../services/rosterService';

export class GuildController {
    // Holt Zusammenfassung für das Dashboard
    static async getDashboardSummary(req: Request, res: Response) {
        const userId = (req as any).user?.userId;
        const requestedGuildId = req.query.guildId ? Number(req.query.guildId) : null;

        try {
            // 1. Finde Main Charakter oder alle Charaktere des Users
            const userChars = await prisma.character.findMany({
                where: { userId }
            });

            const mainChar = userChars.find(c => c.isMain) || userChars[0];

            if (!mainChar && !requestedGuildId) {
                return res.json({
                    success: true,
                    hasMain: false,
                    message: 'Kein Charakter gefunden.'
                });
            }

            // 2. Bestimme die anzuzeigende Gilde
            let guildId = requestedGuildId;
            if (!guildId && mainChar) {
                guildId = mainChar.guildId;
            }

            const guild = guildId ? await prisma.guild.findUnique({ where: { id: guildId } }) : null;

            // 3. Hole anstehende Raids (nächste 7 Tage)
            const upcomingRaids = await prisma.raid.findMany({
                where: {
                    guildId: guildId || -1,
                    startTime: { gte: new Date() }
                },
                include: {
                    attendances: {
                        where: {
                            characterId: { in: userChars.map(c => c.id) }
                        }
                    }
                },
                take: 3,
                orderBy: { startTime: 'asc' }
            });

            // Raids mit User-Status anreichern
            const raidsWithStatus = upcomingRaids.map(raid => {
                const userAttendance = raid.attendances[0]; // Da wir nach userChars gefiltert haben
                let userStatus = 'none'; // Gelb

                if (userAttendance) {
                    if (['attending', 'late', 'tentative'].includes(userAttendance.status)) {
                        userStatus = 'accepted'; // Grün
                    } else if (userAttendance.status === 'not_attending') {
                        userStatus = 'declined'; // Rot
                    }
                }

                return {
                    ...raid,
                    userStatus
                };
            });

            // 4. Hole M+ Daten des Users
            const myKeys = mainChar ? await prisma.mythicKey.findMany({
                where: { characterId: mainChar.id },
                orderBy: { level: 'desc' },
                take: 1
            }) : [];

            // 5. Dummy Announcements
            const announcements = [
                { id: 1, title: 'Raid-Vorbereitung', content: 'Bitte denkt an Flasks und Food für Mittwoch.', date: new Date() },
                { id: 2, title: 'Gilden-Treffen', content: 'Nächsten Sonntag im Discord.', date: new Date() }
            ];

            res.json({
                success: true,
                hasMain: !!mainChar,
                mainCharacter: mainChar ? {
                    name: mainChar.name,
                    class: mainChar.class,
                    classId: mainChar.classId,
                    level: mainChar.level
                } : null,
                guild: {
                    name: guild?.name,
                    realm: guild?.realm,
                    faction: guild?.faction
                },
                announcements,
                raids: raidsWithStatus,
                mythicPlus: myKeys[0] || null,
                streams: []
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
                currentVisibleRanks: guild.visibleRanks.length > 0 ? guild.visibleRanks : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                mainRosterIncludedCharacterIds: guild.mainRosterIncludedCharacterIds || [],
                mainRosterExcludedCharacterIds: guild.mainRosterExcludedCharacterIds || []
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

    // Update Main Roster Overrides
    static async updateMainRosterOverrides(req: any, res: Response) {
        const { guildId } = req.params;
        const { includedIds, excludedIds } = req.body; // Arrays of character IDs

        try {
            const data: any = {};
            if (Array.isArray(includedIds)) data.mainRosterIncludedCharacterIds = includedIds.map(Number);
            if (Array.isArray(excludedIds)) data.mainRosterExcludedCharacterIds = excludedIds.map(Number);

            const guild = await prisma.guild.update({
                where: { id: Number(guildId) },
                data
            });

            res.json({
                success: true,
                mainRosterIncludedCharacterIds: guild.mainRosterIncludedCharacterIds,
                mainRosterExcludedCharacterIds: guild.mainRosterExcludedCharacterIds
            });
        } catch (error) {
            console.error('Update main roster overrides error:', error);
            res.status(500).json({ success: false, error: 'Failed to update main roster overrides' });
        }
    }

    // Fügt externen Charakter zum Main Roster hinzu
    static async addExternalToMainRoster(req: any, res: Response) {
        const { guildId } = req.params;
        const { name, realm } = req.body;
        const user = req.user;

        if (!name || !realm) return res.status(400).json({ error: 'Name and realm are required' });

        try {
            // 0. Get User Access Token
            const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
            if (!dbUser || !dbUser.accessToken) return res.status(401).json({ error: 'No access token' });

            // 1. Sync character data (reuses RosterService logic, need to import it or move logic)
            // Ideally RosterService.syncSingleCharacter should be used.
            // I need to import RosterService here.

            // Dynamic import or check if already imported? It is not imported in this file.
            // I will return a 501 for now if I can't easily import, but I should be able to.
            // Let's assume RosterService is available or I can use BattleNetAPIService directly.

            // BETTER: Use RosterService.

            const character = await RosterService.syncSingleCharacter(realm, name, dbUser.accessToken);
            if (!character) {
                return res.status(404).json({ error: `Charakter ${name}-${realm} konnte nicht bei Blizzard gefunden werden.` });
            }

            // 2. Add to Guild Main Roster inclusions
            const guild = await prisma.guild.findUnique({ where: { id: Number(guildId) } });
            if (!guild) return res.status(404).json({ error: 'Guild not found' });

            const newInclusions = Array.from(new Set([...(guild.mainRosterIncludedCharacterIds || []), character.id]));

            const updatedGuild = await prisma.guild.update({
                where: { id: Number(guildId) },
                data: { mainRosterIncludedCharacterIds: newInclusions }
            });

            res.json({ success: true, character, mainRosterIncludedCharacterIds: updatedGuild.mainRosterIncludedCharacterIds });

        } catch (error) {
            console.error('[AddExternalMain] Error:', error);
            res.status(500).json({ error: 'Failed to add external character to main roster' });
        }
    }
}
