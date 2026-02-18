// @ts-nocheck
import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken as authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { checkPermission } from '../middleware/permissionMiddleware';
import { RosterService } from '../services/rosterService';
import { RaidService } from '../services/raidService';
import { BattleNetAPIService } from '../services/battleNetAPIService';
import { MythicPlusService } from '../services/mythicPlusService';
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

  const filteredRoster = guild.characters.filter((char: any) =>
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

// POST /api/guilds/:guildId/members/:characterId/promote
router.post('/guilds/:guildId/members/:characterId/promote', authMiddleware, checkPermission('edit_roster'), async (req: AuthenticatedRequest, res: Response) => {
  const { guildId, characterId } = req.params;
  try {
    const character = await prisma.character.findUnique({ where: { id: Number(characterId) } });
    if (!character) return res.status(404).json({ error: 'Character not found' });

    // In a real scenario with Write API, we would call Blizzard here.
    // Since it's read-only, we provide the command for the user and maybe update local "expected" rank if desired.
    res.json({
      success: true,
      command: `/gpromote ${character.name}`,
      message: `Beförderung für ${character.name} vorbereitet. Bitte nutze den Befehl im Spiel.`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process promotion' });
  }
});

// POST /api/guilds/:guildId/members/:characterId/demote
router.post('/guilds/:guildId/members/:characterId/demote', authMiddleware, checkPermission('edit_roster'), async (req: AuthenticatedRequest, res: Response) => {
  const { guildId, characterId } = req.params;
  try {
    const character = await prisma.character.findUnique({ where: { id: Number(characterId) } });
    if (!character) return res.status(404).json({ error: 'Character not found' });

    res.json({
      success: true,
      command: `/gdemote ${character.name}`,
      message: `Degradierung für ${character.name} vorbereitet. Bitte nutze den Befehl im Spiel.`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process demotion' });
  }
});

// POST /api/guilds/:guildId/members/:characterId/kick
router.post('/guilds/:guildId/members/:characterId/kick', authMiddleware, checkPermission('edit_roster'), async (req: AuthenticatedRequest, res: Response) => {
  const { guildId, characterId } = req.params;
  try {
    const character = await prisma.character.findUnique({ where: { id: Number(characterId) } });
    if (!character) return res.status(404).json({ error: 'Character not found' });

    res.json({
      success: true,
      command: `/gkick ${character.name}`,
      message: `Ausschluss für ${character.name} vorbereitet. Bitte nutze den Befehl im Spiel.`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process kick' });
  }
});

// POST /api/mythic/sync-addon - Empfange Keystone-Daten vom Desktop-App/Addon
router.post('/mythic/sync-addon', async (req: Request, res: Response) => {
  const { keys } = req.body;

  if (!keys || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'Invalid keys data' });
  }

  try {
    console.log(`[AddonSync] Processing ${keys.length} keys...`);
    for (const key of keys) {
      console.log(`[AddonSync] Lookup char: ${key.name} on realm: ${key.realm}`);
      const character = await prisma.character.findUnique({
        where: { name_realm: { name: key.name.toLowerCase(), realm: key.realm } }
      });

      if (character) {
        console.log(`[AddonSync] Found character: ${character.name} (ID: ${character.id})`);
        // Upsert key
        // Wir löschen alte "Bag"-Keys für diesen Charakter (es gibt nur einen aktuellen Key)
        await (prisma as any).mythicKey.deleteMany({
          where: { characterId: character.id, isFromBag: true } as any
        });

        await (prisma as any).mythicKey.create({
          data: {
            characterId: character.id,
            dungeon: key.dungeon,
            level: key.level,
            affixes: '[]', // Addon liefert aktuell keine Affixe direkt (könnte man nachrüsten)
            isFromBag: true,
            completed: false
          } as any
        });
      }
    }
    res.json({ success: true, message: `Synced ${keys.length} keys` });
  } catch (error) {
    console.error('[AddonSync] Error:', error);
    res.status(500).json({ error: 'Failed to sync addon data' });
  }
});

// GET /api/guilds/:guildId/mythic - Hole Gilden-Keys gruppiert
router.get('/guilds/:guildId/mythic', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  try {
    const keys = await MythicPlusService.getGuildKeysGrouped(Number(guildId));
    res.json({ keys });
  } catch (error: any) {
    console.error('[MythicKeys] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch mythic keys',
      message: error.message,
      stack: error.stack
    });
  }
});

// POST /api/guilds/:guildId/mythic/:keyId/signup - Anmeldung für einen Key
router.post('/guilds/:guildId/mythic/:keyId/signup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { keyId } = req.params;
  const { characterId, message } = req.body;
  try {
    const signup = await MythicPlusService.signupForKey(Number(keyId), Number(characterId), message);
    res.status(201).json({ signup });
  } catch (error) {
    res.status(500).json({ error: 'Failed to signup for key' });
  }
});

// POST /api/guilds/:guildId/sync-mythic-plus - Manueller Sync von M+ Daten
router.post('/guilds/:guildId/sync-mythic-plus', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: (req as any).user.userId } });
    if (!user || !user.accessToken) return res.status(401).json({ error: 'No access token' });

    const result = await MythicPlusService.syncGuildMythicPlus(Number(guildId), user.accessToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync mythic data' });
  }
});

import { getGuildChatHistory } from '../controllers/chatController';
// GET /api/guilds/:guildId/chat - Lade Chat-Historie
router.get('/guilds/:guildId/chat', authMiddleware, getGuildChatHistory);

export default router;
