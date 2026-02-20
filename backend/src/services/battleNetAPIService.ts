// @ts-nocheck
// Battle.net API Service
// Handhabt Battle.net API Calls für Guilds, Characters, etc.

import axios from 'axios';
import prisma from '../prisma';

const BNET_API_URL = process.env.BNET_API_URL || 'https://eu.api.blizzard.com';
const BNET_REGION = process.env.BNET_REGION || 'eu';

export class BattleNetAPIService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Synchronisiere nur Basis-Userdaten (ohne Charaktere)
  static async syncBasicUser(userProfile: any, tokenData: any): Promise<any> {
    try {
      const battleNetId = String(userProfile.id);

      let user = await prisma.user.findUnique({
        where: { battleNetId }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            battleNetId,
            name: userProfile.battletag,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          }
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          }
        });
      }

      return user;
    } catch (error) {
      console.error(`Failed to sync basic user: ${error}`);
      throw error;
    }
  }

  // Statische Methoden für direkten Zugriff ohne Instanz
  static async syncUserCharacters(userProfile: any, tokenData: any, _state: string): Promise<any> {
    try {
      console.log(`Starting sync for ${userProfile.battletag} (${userProfile.id})`);
      const service = new BattleNetAPIService(tokenData.access_token);

      // Ensure battleNetId is a string
      const battleNetId = String(userProfile.id);

      // Synchronisiere User und Charaktere
      let user = await prisma.user.findUnique({
        where: { battleNetId }
      });

      if (!user) {
        console.log(`Creating new user: ${userProfile.battletag}`);
        user = await prisma.user.create({
          data: {
            battleNetId,
            name: userProfile.battletag,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          }
        });
      } else {
        console.log(`Updating existing user: ${userProfile.battletag}`);
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          }
        });
      }

      // Hole und synchronisiere Charaktere
      await service.syncUserCharactersData(user.id);

      return user;
    } catch (error) {
      console.log(`Failed to sync user characters: ${error}`);
      throw error;
    }
  }

  // Synchronisiert Charakterdaten für einen User
  async syncUserCharactersData(userId: number, detailed: boolean = true): Promise<void> {
    try {
      console.log(`Syncing characters for user ${userId} (Detailed: ${detailed})...`);
      const accounts = await this.getUserCharacters();
      console.log(`API returned ${accounts.length} WoW accounts.`);

      let count = 0;
      for (const account of accounts) {
        console.log(`Processing account ${account.id} with ${account.characters?.length || 0} characters`);
        for (const character of account.characters || []) {
          try {
            count++;
            const getName = (obj: any) => typeof obj.name === 'object' ? obj.name.de_DE : obj.name;

            // Extract Guild from Basic Info if available
            let guildId = null;
            if (character.guild) {
              const guildName = character.guild.name;
              const guildRealm = character.guild.realm.slug;
              const faction = typeof character.faction === 'object' ? character.faction.name : character.faction;

              const upsertedGuild = await prisma.guild.upsert({
                where: { name: guildName },
                update: { realm: guildRealm, faction },
                create: { name: guildName, realm: guildRealm, faction }
              });
              guildId = upsertedGuild.id;

              await prisma.userGuild.upsert({
                where: { userId_guildId: { userId, guildId } },
                update: {},
                create: { userId, guildId, rank: 9 }
              });
            }

            // Phase 1: Basic Stats
            await prisma.character.upsert({
              where: {
                name_realm: {
                  name: character.name.toLowerCase(),
                  realm: character.realm.slug,
                },
              },
              update: {
                level: character.level,
                class: getName(character.playable_class),
                classId: character.playable_class.id,
                race: getName(character.playable_race),
                faction: typeof character.faction === 'object' ? character.faction.name : character.faction,
                userId: userId,
                ...(guildId !== null ? { guildId } : {}),
                lastSync: new Date()
              },
              create: {
                userId: userId,
                battleNetId: character.id.toString(),
                name: character.name.toLowerCase(),
                realm: character.realm.slug,
                level: character.level,
                class: getName(character.playable_class),
                classId: character.playable_class.id,
                race: getName(character.playable_race),
                faction: typeof character.faction === 'object' ? character.faction.name : character.faction,
                ...(guildId !== null ? { guildId } : {}),
                lastSync: new Date(),
              },
            });

            // Phase 2: Details (Optional/Deferred)
            if (detailed) {
              await this.syncSingleCharacterDetails(userId, character.realm.slug, character.name.toLowerCase());
            }

            console.log(`Synced character basic info: ${character.name.toLowerCase()}@${character.realm.slug}`);
          } catch (charError) {
            console.error(`Error syncing character ${character.name}:`, charError);
            // Weiter mit dem nächsten Charakter
          }
        }
      }
      console.log(`Successfully synced ${count} characters basic info.`);

      // Wenn das nur ein Basic Sync war, starte Guild Discovery um Gilden zu finden
      if (!detailed) {
        await this.syncGuildDiscovery(userId, accounts);
      }

    } catch (error) {
      console.log(`Failed to sync user characters data: ${error}`);
      throw error;
    }
  }

  // Intelligenter Sync: Wählt 1 Char pro Realm aus, um Gilden zu entdecken
  async syncGuildDiscovery(userId: number, accounts: any[]): Promise<void> {
    console.log('[GuildDiscovery] Starting smart guild discovery...');
    const realmSampleChars = new Map<string, { name: string, realm: string }>();

    // 1. Sammle EINEN Char pro Realm
    for (const account of accounts) {
      for (const char of account.characters || []) {
        const key = char.realm.slug;
        if (!realmSampleChars.has(key)) {
          // Bevorzuge High-Level Chars für bessere Gilden-Chance
          if (char.level >= 60 || !realmSampleChars.has(key)) {
            realmSampleChars.set(key, { name: char.name.toLowerCase(), realm: char.realm.slug });
          }
        } else {
          // Update wenn wir einen höheren Char finden
          if (char.level > 60 && realmSampleChars.get(key)!.name !== char.name.toLowerCase()) {
            // Hier könnten wir Logik verfeinern, aber erster Hit reicht meistens für Gilden-Check
          }
        }
      }
    }

    console.log(`[GuildDiscovery] Identified ${realmSampleChars.size} realms to probe for guilds.`);

    // 2. Sync diese wenigen Chars im Detail
    let syncedCount = 0;
    for (const char of realmSampleChars.values()) {
      try {
        await this.syncSingleCharacterDetails(userId, char.realm, char.name);
        syncedCount++;
        // Kleines Delay um Rate Limits zu schonen
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`[GuildDiscovery] Failed probe for ${char.name}@${char.realm}`, e);
      }
    }
    console.log(`[GuildDiscovery] Probed ${syncedCount} characters.`);
  }

  // Hilfsmethode für Detail-Sync eines einzelnen Charakters
  async syncSingleCharacterDetails(userId: number, realmSlug: string, name: string): Promise<void> {
    try {
      console.log(`Fetching details for ${name}@${realmSlug}...`);

      let guildId: number | null = null;
      let averageItemLevel: number | null = null;
      let mythicRating: number | null = null;
      let raidProgress: string | null = null;
      let role: string | null = null;

      const details = await this.getCharacterDetails(realmSlug, name);

      if (details) {
        averageItemLevel = details.equipped_item_level;

        if (details.guild) {
          const guildName = details.guild.name;
          const guildRealm = details.guild.realm.slug;
          const faction = typeof details.faction === 'object' ? details.faction.name : details.faction;

          const upsertedGuild = await prisma.guild.upsert({
            where: { name: guildName },
            update: { realm: guildRealm, faction },
            create: { name: guildName, realm: guildRealm, faction }
          });
          guildId = upsertedGuild.id;

          await prisma.userGuild.upsert({
            where: { userId_guildId: { userId, guildId } },
            update: {},
            create: { userId, guildId, rank: 9 }
          });
        }
      }

      // Role
      try {
        const specData = await this.makeAPICall(`/profile/wow/character/${realmSlug}/${encodeURIComponent(name)}/specializations`);
        if (specData && specData.active_specialization) {
          const specRole = specData.active_specialization.role?.type;
          if (specRole === 'TANK') role = 'Tank';
          else if (specRole === 'HEALER') role = 'Healer';
          else if (specRole === 'DAMAGE') role = 'DPS';
        }
      } catch (e) { }

      // M+ Rating
      try {
        const mPlusProfile = await this.getCharacterMythicKeystone(realmSlug, name);
        if (mPlusProfile && mPlusProfile.current_mythic_rating) {
          mythicRating = mPlusProfile.current_mythic_rating.rating;
        }
      } catch (e) { }

      // Raid Progress
      try {
        const raidEncounters = await this.getCharacterRaidEncounters(realmSlug, name);
        if (raidEncounters && raidEncounters.expansions) {
          // Dynamic raid detection: search for the latest raid in the most recent expansion
          let targetRaid = null;

          if (raidEncounters.expansions && raidEncounters.expansions.length > 0) {
            // Sort expansions by ID if possible, or just take the last one (usually latest)
            const latestExp = raidEncounters.expansions[raidEncounters.expansions.length - 1];

            if (latestExp.instances && latestExp.instances.length > 0) {
              // Take the last instance - Blizzard usually appends new raids to the end of the expansion's array
              targetRaid = latestExp.instances[latestExp.instances.length - 1];

              console.log(`[RaidSync] Detected latest raid: ${targetRaid.instance.name} in expansion: ${latestExp.expansion.name}`);
            }
          }

          if (targetRaid) {
            const modes = ['MYTHIC', 'HEROIC', 'NORMAL'];
            for (const mode of modes) {
              const modeData = targetRaid.modes.find((m: any) => m.difficulty.type === mode);
              if (modeData) {
                const diffChar = mode === 'MYTHIC' ? 'M' : mode === 'HEROIC' ? 'H' : 'N';
                raidProgress = `${modeData.progress.completed_count}/${modeData.progress.total_count} ${diffChar}`;
                break;
              }
            }
          }
        }
      } catch (e) { }

      // Update DB
      await prisma.character.update({
        where: { name_realm: { name, realm: realmSlug } },
        data: {
          guildId,
          averageItemLevel,
          mythicRating,
          role,
          raidProgress,
          lastSync: new Date()
        }
      });
    } catch (error) {
      console.error(`Failed to sync details for ${name}@${realmSlug}:`, error);
    }
  }

  // Hilfsfunktion für API Calls
  private async makeAPICall(endpoint: string, params: any = {}): Promise<any> {
    try {
      const response = await axios.get(`${BNET_API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        params: {
          region: BNET_REGION,
          namespace: `profile-${BNET_REGION}`,
          locale: 'de_DE',
          ...params,
        },
      });

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error(`Battle.net API Error for ${endpoint}:`, e.response?.data || e.message);
      throw new Error(`Failed to fetch data from Battle.net API: ${endpoint}`);
    }
  }

  // Ruft alle Charaktere eines Benutzers ab
  async getUserCharacters(): Promise<any[]> {
    try {
      const data = await this.makeAPICall('/profile/user/wow');
      console.log(`Raw Profile API Response: ${JSON.stringify(data).substring(0, 1000)}...`);
      return data.wow_accounts || [];
    } catch (error) {
      const e = error as any;
      console.log(`getUserCharacters Error: ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`);
      throw error;
    }
  }

  // Ruft Charakter-Details ab
  async getCharacterDetails(realm: string, characterName: string): Promise<any> {
    try {
      const encodedName = encodeURIComponent(characterName.toLowerCase());
      return await this.makeAPICall(`/profile/wow/character/${realm}/${encodedName}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`[BNET] Character not found: ${characterName}@${realm}`);
        return null;
      }
      console.error(`Failed to fetch character details for ${characterName}@${realm}:`, error);
      throw error;
    }
  }

  // Ruft Gilden-Informationen ab
  async getGuildInfo(realm: string, guildName: string): Promise<any> {
    try {
      const encodedName = encodeURIComponent(guildName.toLowerCase());
      return await this.makeAPICall(`/data/wow/guild/${realm}/${encodedName}`);
    } catch (error) {
      console.error(`Failed to fetch guild info for ${guildName}@${realm}:`, error);
      throw error;
    }
  }

  // Ruft Gilden-Ranks ab
  async getGuildRanks(realm: string, guildName: string): Promise<any[]> {
    try {
      // Blizzard API expects a slug: lowercase, spaces replaced by dashes
      const slug = guildName.toLowerCase().replace(/\s+/g, '-');
      const encodedName = encodeURIComponent(slug);
      // /data/wow/guild/{realmSlug}/{nameSlug}/roster returns members which have rank, 
      // but to get rank definitions we need another endpoint or extract it from somewhere else.
      // Actually, standard Guild API has 'achievement/criteria' etc.

      // Attempt to fetch from guild info directly, maybe it's there.

      const guildData = await this.makeAPICall(`/data/wow/guild/${realm}/${encodedName}`);
      return guildData.ranks || []; // Hope it's there
    } catch (error) {
      console.error(`Failed to fetch guild ranks for ${guildName}@${realm}:`, error);
      return [];
    }
  }

  // Ruft Gilden-Roster ab
  async getGuildRoster(realm: string, guildName: string): Promise<any[]> {
    try {
      // Blizzard API expects a slug: lowercase, spaces/dots replaced by dashes
      const slug = guildName.toLowerCase()
        .replace(/[\s\.]+/g, '-') // Handle spaces and dots
        .replace(/-+/g, '-')      // Avoid double dashes
        .replace(/^-|-$/g, '');   // Trim dashes from start/end

      const encodedName = encodeURIComponent(slug);
      const data = await this.makeAPICall(`/data/wow/guild/${realm}/${encodedName}/roster`);

      // LOGGING RAW KEYS
      const { members, ...meta } = data;
      console.log(`[BNET] Roster Response Meta Keys: ${Object.keys(meta).join(', ')}`);
      if (members) console.log(`[BNET] Roster Member Count: ${members.length}`);

      return members || [];
    } catch (error) {
      console.error(`Failed to fetch guild roster for ${guildName}@${realm}:`, error);
      // Re-throw error so the caller knows it failed
      throw error;
    }
  }

  // Ruft Mythic+ Keystone Informationen ab
  async getCharacterMythicKeystone(realm: string, characterName: string): Promise<any> {
    try {
      const encodedName = encodeURIComponent(characterName.toLowerCase());
      return await this.makeAPICall(`/profile/wow/character/${realm}/${encodedName}/mythic-keystone-profile`);
    } catch (error) {
      console.error(`Failed to fetch mythic keystone for ${characterName}@${realm}:`, error);
      return null;
    }
  }

  // Ruft Raid Encounters Informationen ab
  async getCharacterRaidEncounters(realm: string, characterName: string): Promise<any> {
    try {
      const encodedName = encodeURIComponent(characterName.toLowerCase());
      return await this.makeAPICall(`/profile/wow/character/${realm}/${encodedName}/encounters/raids`);
    } catch (error) {
      console.error(`Failed to fetch raid encounters for ${characterName}@${realm}:`, error);
      return null;
    }
  }

  // Ruft alle Realms für die aktuelle Region ab
  async getRealms(): Promise<any[]> {
    try {
      const data = await this.makeAPICall('/data/wow/realm/index', {
        namespace: `dynamic-${BNET_REGION}`
      });
      return data.realms || [];
    } catch (error) {
      console.error('Failed to fetch realms:', error);
      return [];
    }
  }

  // Statische Methode zum Synchronisieren von Gildenmitgliedern
  static async syncGuildMembers(guildId: number, guildName: string, realmSlug: string, accessToken: string): Promise<number> {
    try {
      const service = new BattleNetAPIService(accessToken);
      const members = await service.getGuildRoster(realmSlug, guildName);

      for (const member of members) {
        await prisma.character.upsert({
          where: {
            name_realm: {
              name: member.character.name.toLowerCase(),
              realm: member.character.realm.slug,
            },
          },
          update: {
            level: member.character.level,
            guildId: guildId,
            class: member.character.playable_class.name.de_DE,
            classId: member.character.playable_class.id,
            race: member.character.playable_race.name.de_DE,
            faction: member.character.faction.name.de_DE,
            rank: member.rank,
            lastSync: new Date(),
          },
          create: {
            userId: 0, // Temporär, da wir keine User-ID haben
            battleNetId: member.character.id.toString(),
            name: member.character.name.toLowerCase(),
            realm: member.character.realm.slug,
            level: member.character.level,
            class: member.character.playable_class.name.de_DE,
            classId: member.character.playable_class.id,
            race: member.character.playable_race.name.de_DE,
            faction: member.character.faction.name.de_DE,
            guildId: guildId,
            rank: member.rank,
            lastSync: new Date(),
          },
        });
      }

      return members.length;
    } catch (error) {
      console.error(`Failed to sync guild members for ${guildName}:`, error);
      throw error;
    }
  }

  // Statische Methode zum Synchronisieren von Mythic+ Daten
  static async syncMythicPlusData(characterId: number, characterName: string, realmSlug: string, accessToken: string): Promise<void> {
    try {
      const service = new BattleNetAPIService(accessToken);
      const mythicData = await service.getCharacterMythicKeystone(realmSlug, characterName);

      if (!mythicData) {
        console.log(`No Mythic+ data found for ${characterName}@${realmSlug}`);
        return;
      }

      // Aktualisiere Charakter mit Mythic+ Daten
      await prisma.character.update({
        where: { id: characterId },
        data: {
          // Hier könnten wir ein Feld für Mythic+ Rating hinzufügen
          lastSync: new Date(),
        },
      });

      // Mythic Keys synchronisieren
      if (mythicData.current_period && mythicData.current_period.best_runs) {
        // Lösche alte Keys für diese Woche
        await prisma.mythicKey.deleteMany({
          where: {
            characterId: characterId,
            weeklyBest: false,
          },
        });

        for (const run of mythicData.current_period.best_runs) {
          await prisma.mythicKey.create({
            data: {
              characterId: characterId,
              dungeon: run.dungeon.name.de_DE,
              level: run.keystone_level,
              affixes: JSON.stringify(run.affixes.map((affix: any) => affix.id)),
              completed: true,
              completedAt: new Date(run.completed_timestamp),
              weeklyBest: false,
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to sync Mythic+ data for ${characterName}@${realmSlug}:`, error);
      throw error;
    }
  }

  // Synchronisiert Raid-Teams basierend auf aktiven Gilden-Charakteren
  static async syncRaidTeams(guildId: number): Promise<{ raidId: number; attendanceCount: number }> {
    // Erstelle einen geplanten Raid und füge alle aktiven Charaktere als 'tentative' hinzu
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { characters: { where: { isActive: true } } },
    });

    if (!guild) {
      throw new Error('Guild not found');
    }

    const raid = await prisma.raid.create({
      data: {
        guildId: guildId,
        title: `Auto Sync Raid (${new Date().toLocaleDateString('de-DE')})`,
        description: 'Automatisch generierter Raid basierend auf aktiven Gilden-Charakteren',
        startTime: new Date(),
        difficulty: 'Normal',
        status: 'scheduled',
      },
    });

    let attendanceCount = 0;
    for (const character of guild.characters) {
      await prisma.attendance.create({
        data: {
          raidId: raid.id,
          characterId: character.id,
          status: 'tentative',
          roleSlot: character.role || 'main',
        },
      });
      attendanceCount++;
    }

    return { raidId: raid.id, attendanceCount };
  }
}
