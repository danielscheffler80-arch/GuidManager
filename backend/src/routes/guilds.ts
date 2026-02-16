import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken as authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { checkPermission } from '../middleware/permissionMiddleware';
import { RosterService } from '../services/rosterService';
import { RaidService } from '../services/raidService';
import { BattleNetAPIService } from '../services/battleNetAPIService';
const router = Router();

// MVP Guilds API
// GET /api/guilds
router.get('/guilds', authMiddleware, async (_req: Request, res: Response) => {
  const guilds = await prisma.guild.findMany({});
  res.json({ guilds });
});

// Debug Route: Test Battle.net API connectivity for Roster
router.get('/guilds/:guildId/roster-debug', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  const id = Number(guildId);

  try {
    const guild = await prisma.guild.findUnique({ where: { id } });
    if (!guild) return res.status(404).json({ error: 'Guild not found in DB' });

    // Get User's Access Token (assuming the requester is the user)
    const user = await prisma.user.findUnique({ where: { id: req.user?.userId } });
    if (!user || !user.accessToken) return res.status(401).json({ error: 'No access token found' });

    const service = new BattleNetAPIService(user.accessToken);
    console.log(`[DebugAPI] Attempting to fetch roster for ${guild.name} (${guild.realm})`);

    const members = await service.getGuildRoster(guild.realm, guild.name);

    res.json({
      success: true,
      guild: { name: guild.name, realm: guild.realm },
      memberCountFromAPI: members.length,
      firstMember: members[0] ? { name: members[0].character.name, rank: members[0].rank } : null
    });

  } catch (error: any) {
    console.error('[DebugAPI] Roster fetch failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'No API response details'
    });
  }
});

// GET /api/guilds/:guildId/roster
router.get('/guilds/:guildId/roster', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  const id = Number(guildId);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid guild id' });
  }

  const guild = await prisma.guild.findUnique({
    where: { id },
    include: { characters: true },
  });

  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' });
  }

  // Filter roster by visible ranks
  const includeFiltered = req.query.includeFiltered === 'true';
  const visibleRanks = guild.visibleRanks.length > 0 ? guild.visibleRanks : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const totalInDb = guild.characters.length;

  console.log(`[RosterAPI] Guild: ${guild.name}, TotalChars: ${totalInDb}, VisibleRanks: ${JSON.stringify(visibleRanks)}, IncludeFiltered: ${includeFiltered}`);

  const filteredRoster = guild.characters.filter(char =>
    char.rank !== null && visibleRanks.includes(char.rank)
  );

  res.json({
    roster: includeFiltered ? guild.characters : filteredRoster,
    metadata: {
      totalCount: totalInDb,
      filteredCount: filteredRoster.length,
      visibleRanks: visibleRanks,
      isFiltered: !includeFiltered && filteredRoster.length < totalInDb,
      ranks: guild.ranks
    }
  });
});

// GET /api/guilds/:guildId/raids
router.get('/guilds/:guildId/raids', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  const id = Number(guildId);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid guild id' });
  }

  try {
    const raids = await RaidService.getGuildRaids(id);
    res.json({ raids });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch raids' });
  }
});

// POST /api/guilds/:guildId/raids - Erstelle einen Raid (Permission Check!)
router.post('/guilds/:guildId/raids', authMiddleware, checkPermission('edit_raids'), async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  const id = Number(guildId);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid guild id' });
  }

  try {
    if (req.body.isRecurring) {
      const raids = await RaidService.createRecurringRaids(id, req.body, req.body.recurrenceWeeks || 4);
      res.status(201).json({ raids });
    } else {
      const raid = await RaidService.createRaid(id, req.body);
      res.status(201).json({ raid });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to create raid' });
  }
});

// POST /api/guilds/:guildId/raids/:raidId/attendance - Raid Anmeldung
router.post('/guilds/:guildId/raids/:raidId/attendance', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { raidId } = req.params;
  const { characterId, status, comment, roleSlot } = req.body;

  const raidIdNum = Number(raidId);
  const characterIdNum = Number(characterId);

  if (Number.isNaN(raidIdNum) || Number.isNaN(characterIdNum) || !status) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  try {
    // Rank validation
    const raid = await prisma.raid.findUnique({ where: { id: raidIdNum } });
    const character = await prisma.character.findUnique({ where: { id: characterIdNum } });

    if (raid && raid.allowedRanks.length > 0 && character) {
      if (character.rank === null || !raid.allowedRanks.includes(character.rank)) {
        return res.status(403).json({ error: 'Dein Rang ist für diesen Raid nicht zugelassen.' });
      }
    }

    const attendance = await RaidService.signup(raidIdNum, characterIdNum, { status, comment, roleSlot });
    res.status(201).json({ attendance });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create attendance' });
  }
});

// POST /api/guilds/:guildId/sync-members - Synchronisiere Gildenmitglieder
router.post('/guilds/:guildId/sync-members', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { guildId } = req.params;
    const id = Number(guildId);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid guild id' });
    }

    // Check if user is at least a member of this guild
    const membership = await prisma.userGuild.findUnique({
      where: {
        userId_guildId: {
          userId: (req as any).user.userId,
          guildId: id
        }
      }
    });

    if (!membership && (req as any).user.battlenetId !== '100379014') {
      return res.status(403).json({ error: 'You must be a member of this guild to trigger a sync' });
    }

    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.userId }
    });

    if (!user || !user.accessToken) {
      return res.status(401).json({ error: 'No access token available' });
    }

    const stats = await RosterService.syncRoster(id, user.accessToken);

    res.json({
      success: true,
      message: `Successfully synced ${stats.updated} guild members`,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync guild members' });
  }
});

import { GuildController } from '../controllers/guildController';

// GET /api/guilds/:guildId/ranks - Hole Gilden-Ränge & Einstellungen
router.get('/guilds/:guildId/ranks', authMiddleware, GuildController.getGuildRanks);

// POST /api/guilds/:guildId/admin-ranks - Update Admin-Ränge
router.post('/guilds/:guildId/admin-ranks', authMiddleware, checkPermission('edit_roster'), GuildController.updateAdminRanks);

// POST /api/guilds/:guildId/visible-ranks - Update Sichtbare Ränge
router.post('/guilds/:guildId/visible-ranks', authMiddleware, checkPermission('edit_roster'), GuildController.updateVisibleRanks);

import { getGuildChatHistory } from '../controllers/chatController';
// GET /api/guilds/:guildId/chat - Lade Chat-Historie
router.get('/guilds/:guildId/chat', authMiddleware, getGuildChatHistory);

export default router;
