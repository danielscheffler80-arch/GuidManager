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
  try {
    const guilds = await prisma.guild.findMany({});
    res.json({ guilds });
  } catch (error) {
    console.error('[Guilds] Failed to fetch guilds:', error);
    res.status(500).json({ guilds: [], error: 'Failed to fetch guilds' });
  }
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
    include: {
      characters: true,
      rosters: { select: { includedCharacterIds: true } }
    },
  });

  // Get all unique user IDs from guild members to fetch their characters
  const guildMemberUserIds = await prisma.userGuild.findMany({
    where: { guildId: id },
    select: { userId: true }
  }).then(members => members.map(m => m.userId));

  // Find all characters that belong to users who are members of this guild
  const assignedCharacters = await prisma.character.findMany({
    where: {
      userId: { in: guildMemberUserIds }
    }
  });

  // Find all unique included IDs from ALL rosters belonging to this guild
  const allManualIds = Array.from(new Set(guild.rosters.flatMap(r => r.includedCharacterIds || [])));

  // Also include main roster manual inclusions
  const mainRosterManualIds = guild.mainRosterIncludedCharacterIds || [];
  const combinedManualIds = Array.from(new Set([...allManualIds, ...mainRosterManualIds]));

  const existingIds = new Set(guild.characters.map(c => c.id));
  const assignedCharacterIds = new Set(assignedCharacters.map(c => c.id));

  const extraManualIds = combinedManualIds.filter(id => !existingIds.has(id) && !assignedCharacterIds.has(id));

  let pool = [...guild.characters];

  // Add assigned characters that aren't already in the pool
  const newAssignedChars = assignedCharacters.filter(c => !existingIds.has(c.id));
  if (newAssignedChars.length > 0) {
    pool = [...pool, ...newAssignedChars];
  }

  if (extraManualIds.length > 0) {
    const extraChars = await prisma.character.findMany({
      where: { id: { in: extraManualIds } }
    });
    pool = [...pool, ...extraChars];
    console.log(`[RosterAPI] Added ${extraChars.length} external characters to pool for guild ${guild.name}`);
  }

  // Filter roster by visible ranks
  const includeFiltered = req.query.includeFiltered === 'true';
  const visibleRanks = guild.visibleRanks.length > 0 ? guild.visibleRanks : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const totalInPool = pool.length;

  const filteredRoster = pool.filter((char: any) => {
    // Show if manual inclusion OR is assigned to a guild user OR has a visible rank
    const isAssignedToUser = char.userId !== null && guildMemberUserIds.includes(char.userId);
    return combinedManualIds.includes(char.id) || isAssignedToUser || (char.rank !== null && visibleRanks.includes(char.rank));
  });

  res.json({
    roster: includeFiltered ? pool : filteredRoster,
    metadata: {
      totalCount: totalInPool,
      filteredCount: filteredRoster.length,
      visibleRanks: visibleRanks,
      isFiltered: !includeFiltered && filteredRoster.length < totalInPool,
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
    const raid = await prisma.raid.findUnique({
      where: { id: raidIdNum },
      include: { roster: true }
    });
    const character = await prisma.character.findUnique({ where: { id: characterIdNum } });

    if (raid && character) {
      // 1. Check specific roster ranks if rosterId is set
      if (raid.rosterId && raid.roster) {
        const isExcluded = raid.roster.excludedCharacterIds.includes(character.id);
        const isIncluded = raid.roster.includedCharacterIds.includes(character.id);
        const hasRank = character.rank !== null && raid.roster.allowedRanks.includes(character.rank);

        if (isExcluded || (!hasRank && !isIncluded)) {
          return res.status(403).json({ error: `Dieser Raid ist nur für Mitglieder des Rosters "${raid.roster.name}" zugelassen.` });
        }
      }
      // 2. Fallback to general allowedRanks if set
      else if (raid.allowedRanks.length > 0) {
        if (character.rank === null || !raid.allowedRanks.includes(character.rank)) {
          return res.status(403).json({ error: 'Dein Rang ist für diesen Raid nicht zugelassen.' });
        }
      }
    }

    const attendance = await RaidService.signup(raidIdNum, characterIdNum, { status, comment, roleSlot });
    res.status(201).json({ attendance });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create attendance' });
  }
});

// --- ROSTER MANAGEMENT ENDPOINTS ---

// GET /api/guilds/:guildId/rosters - Liste alle Roster einer Gilde
router.get('/guilds/:guildId/rosters', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  try {
    const rosters = await prisma.roster.findMany({
      where: { guildId: Number(guildId) },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, rosters });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rosters' });
  }
});

// POST /api/guilds/:guildId/rosters - Erstelle oder Update einen Roster
router.post('/guilds/:guildId/rosters', authMiddleware, checkPermission('edit_roster'), async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  const { id, name, allowedRanks, includedCharacterIds, excludedCharacterIds } = req.body;

  try {
    const data = {
      name,
      allowedRanks: allowedRanks?.map(Number),
      includedCharacterIds: includedCharacterIds?.map(Number),
      excludedCharacterIds: excludedCharacterIds?.map(Number)
    };

    if (id) {
      const updated = await prisma.roster.update({
        where: { id: Number(id) },
        data
      });
      return res.json({ success: true, roster: updated });
    } else {
      const created = await prisma.roster.create({
        data: {
          guildId: Number(guildId),
          ...data
        }
      });
      return res.status(201).json({ success: true, roster: created });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to manage roster' });
  }
});

// POST /api/guilds/:guildId/rosters/:rosterId/add-external - Füge externen Partner hinzu
router.post('/guilds/:guildId/rosters/:rosterId/add-external', authMiddleware, checkPermission('edit_roster'), async (req: AuthenticatedRequest, res: Response) => {
  const { guildId, rosterId } = req.params;
  const { name, realm } = req.body;

  if (!name || !realm) {
    return res.status(400).json({ error: 'Name and realm are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: (req as any).user.userId } });
    if (!user || !user.accessToken) return res.status(401).json({ error: 'No access token' });

    // 1. Sync character data
    const character = await RosterService.syncSingleCharacter(realm, name, user.accessToken);
    if (!character) {
      return res.status(404).json({ error: `Charakter ${name}-${realm} konnte nicht bei Blizzard gefunden werden.` });
    }

    // 2. Add to roster inclusions
    const roster = await prisma.roster.findUnique({ where: { id: Number(rosterId) } });
    if (!roster) return res.status(404).json({ error: 'Roster not found' });

    const newInclusions = Array.from(new Set([...roster.includedCharacterIds, character.id]));
    const updated = await prisma.roster.update({
      where: { id: Number(rosterId) },
      data: { includedCharacterIds: newInclusions }
    });

    res.json({ success: true, character, roster: updated });
  } catch (error) {
    console.error('[AddExternal] Error:', error);
    res.status(500).json({ error: 'Failed to add external character' });
  }
});

// GET /api/guilds/realms - Holt die Realm-Liste für die aktuelle Region
router.get('/guilds/realms', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: (req as any).user.userId } });
    if (!user || !user.accessToken) return res.status(401).json({ error: 'No access token' });

    const service = new BattleNetAPIService(user.accessToken);
    const realms = await service.getRealms();

    // Sort realms alphabetically and map to simple format
    const formattedRealms = realms.map((r: any) => {
      let name = 'Unknown';
      if (typeof r.name === 'string') name = r.name;
      else if (r.name && typeof r.name === 'object') {
        name = r.name.de_DE || r.name.en_US || r.name.fr_FR || r.name.es_ES || r.name.ru_RU || Object.values(r.name)[0];
      }
      return {
        name: name,
        slug: r.slug
      };
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));

    res.json({ success: true, realms: formattedRealms });
  } catch (error) {
    console.error('[Realms] Error:', error);
    res.status(500).json({ error: 'Failed to fetch realms' });
  }
});

// DELETE /api/guilds/:guildId/rosters/:rosterId - Lösche einen Roster
router.delete('/guilds/:guildId/rosters/:rosterId', authMiddleware, checkPermission('edit_roster'), async (req: AuthenticatedRequest, res: Response) => {
  const { rosterId } = req.params;
  try {
    await prisma.roster.delete({ where: { id: Number(rosterId) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete roster' });
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

// POST /api/guilds/:guildId/main-roster-overrides - Update Main Roster Overrides
router.post('/guilds/:guildId/main-roster-overrides', authMiddleware, checkPermission('edit_roster'), GuildController.updateMainRosterOverrides);

// POST /api/guilds/:guildId/main-roster/add-external
router.post('/guilds/:guildId/main-roster/add-external', authMiddleware, checkPermission('edit_roster'), GuildController.addExternalToMainRoster);

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
    const results = { matched: [] as string[], skipped: [] as string[] };

    for (const key of keys) {
      const lowerName = key.name.toLowerCase();
      const lowerRealm = key.realm.toLowerCase();

      console.log(`[AddonSync] Target: ${lowerName} on ${lowerRealm} (+${key.level} ${key.dungeon})`);

      const character = await prisma.character.findUnique({
        where: { name_realm: { name: lowerName, realm: lowerRealm } }
      });

      if (character) {
        results.matched.push(`${character.name}-${character.realm}`);
        console.log(`[AddonSync] MATCH: Found ${character.name} (ID: ${character.id}, Guild: ${character.guildId})`);

        // Upsert key carefully to preserve signups if unchanged
        try {
          const existingKey = await (prisma as any).mythicKey.findFirst({
            where: { characterId: character.id, isFromBag: true }
          });

          if (existingKey && existingKey.dungeon === key.dungeon && existingKey.level === key.level) {
            // Key is the same, just update timestamp
            await (prisma as any).mythicKey.update({
              where: { id: existingKey.id },
              data: { updatedAt: new Date() }
            });
            console.log(`[AddonSync] SKIP: Key unchanged for ${character.name}`);
          } else {
            // Key changed or new, delete old and create new (Cascades delete to signups)
            await (prisma as any).mythicKey.deleteMany({
              where: { characterId: character.id, isFromBag: true } as any
            });

            const newKey = await (prisma as any).mythicKey.create({
              data: {
                characterId: character.id,
                dungeon: key.dungeon,
                level: key.level,
                affixes: '[]',
                isFromBag: true,
                completed: false
              } as any
            });
            console.log(`[AddonSync] SUCCESS: Created new key ID ${newKey.id} for ${character.name} (Old signups auto-cleared)`);
          }
        } catch (dbErr: any) {
          console.error(`[AddonSync] DB ERROR for ${character.name}:`, dbErr.message);
        }
      } else {
        results.skipped.push(`${lowerName}-${lowerRealm}`);
        console.log(`[AddonSync] SKIP: Character not found: ${lowerName} on ${lowerRealm}`);
      }
    }
    res.json({ success: true, matchedCount: results.matched.length, results });
  } catch (error: any) {
    console.error('[AddonSync] GLOBAL ERROR:', error.message);
    res.status(500).json({ error: 'Failed to sync addon data', details: error.message });
  }
});

// GET /api/guilds/:guildId/mythic - Hole Gilden-Keys gruppiert
router.get('/guilds/:guildId/mythic', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { guildId } = req.params;
  try {
    console.log(`[MythicKeys] Request for GuildID: ${guildId} by UserID: ${req.user?.id}`);
    const keys = await MythicPlusService.getGuildKeysGrouped(Number(guildId));
    console.log(`[MythicKeys] Returning ${keys.length} entries for GuildID: ${guildId}`);
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
  const { characterId, primaryRole, secondaryRole, message } = req.body;

  if (!primaryRole) {
    return res.status(400).json({ error: 'Primary role is required' });
  }

  try {
    const signup = await MythicPlusService.signupForKey(Number(keyId), Number(characterId), primaryRole, secondaryRole, message);
    res.status(201).json({ signup });
  } catch (error) {
    res.status(500).json({ error: 'Failed to signup for key' });
  }
});

// PATCH /api/guilds/:guildId/mythic/signups/:signupId - Status einer Anmeldung ändern
router.patch('/guilds/:guildId/mythic/signups/:signupId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { signupId } = req.params;
  const { status } = req.body;
  try {
    const signup = await MythicPlusService.updateSignupStatus(Number(signupId), status);
    res.json({ signup });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update signup status' });
  }
});

// DELETE /api/guilds/:guildId/mythic/signups/:signupId - Anmeldung zurückziehen/löschen
router.delete('/guilds/:guildId/mythic/signups/:signupId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { signupId } = req.params;
  try {
    await MythicPlusService.removeSignup(Number(signupId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove signup' });
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
