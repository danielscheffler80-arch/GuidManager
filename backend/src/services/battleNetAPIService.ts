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

      return await prisma.user.upsert({
        where: { battleNetId },
        update: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          lastLogin: new Date()
        },
        create: {
          battleNetId,
          name: userProfile.battletag,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        }
      });
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

      // Atomic upsert for user
      const user = await prisma.user.upsert({
        where: { battleNetId },
        update: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          lastLogin: new Date()
        },
        create: {
          battleNetId,
          name: userProfile.battletag,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        }
      });

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
            // Extract Guild from Basic Info if available
            let guildId = null;
            if (character.guild) {
              const guildName = character.guild.name;
              const guildRealm = character.guild.realm.slug;
              const faction = typeof character.faction === 'object' ? (character.faction.name.de_DE || character.faction.name.en_US || character.faction.name) : character.faction;

              console.log(`[SYNC] Character ${character.name.toLowerCase()} in guild ${guildName}@${guildRealm}`);

              const upsertedGuild = await prisma.guild.upsert({
                where: { name_realm: { name: guildName, realm: guildRealm } },
                update: { faction },
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
                class: this.getName(character.playable_class),
                classId: character.playable_class.id,
                race: this.getName(character.playable_race),
                faction: typeof character.faction === 'object' ? (character.faction.name.de_DE || character.faction.name.en_US || character.faction.name) : character.faction,
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
                class: this.getName(character.playable_class),
                classId: character.playable_class.id,
                race: this.getName(character.playable_race),
                faction: typeof character.faction === 'object' ? (character.faction.name.de_DE || character.faction.name.en_US || character.faction.name) : character.faction,
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
          const faction = typeof details.faction === 'object' ? (details.faction.name.de_DE || details.faction.name.en_US || details.faction.name) : details.faction;

          const upsertedGuild = await prisma.guild.upsert({
            where: { name_realm: { name: guildName, realm: guildRealm } },
            update: { faction },
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
          let targetRaid = null;

          // Priority 1: Specifically look for "Manaforge Omega"
          for (const exp of raidEncounters.expansions) {
            if (exp.instances) {
              const omegaRaid = exp.instances.find((inst: any) =>
                inst.instance.name === 'Manaforge Omega' ||
                (inst.instance.name.de_DE && inst.instance.name.de_DE === 'Manaschmiede Omega')
              );
              if (omegaRaid) {
                targetRaid = omegaRaid;
                console.log(`[RaidSync] Prioritizing Manaforge Omega for ${name}`);
                break;
              }
            }
          }

          // Priority 2: Fallback to the latest raid in the most recent expansion
          if (!targetRaid && raidEncounters.expansions.length > 0) {
            const latestExp = raidEncounters.expansions[raidEncounters.expansions.length - 1];
            if (latestExp.instances && latestExp.instances.length > 0) {
              targetRaid = latestExp.instances[latestExp.instances.length - 1];
              console.log(`[RaidSync] Detected latest raid: ${targetRaid.instance.name} for ${name}`);
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

      // Sync Mythic Keys (>= 10) for Weekly Progress
      try {
        const mythicData = await this.getCharacterMythicKeystone(realmSlug, name);
        if (mythicData && mythicData.current_period && mythicData.current_period.best_runs) {
          // Delete existing Blizzard-synced keys for this character
          const char = await prisma.character.findUnique({ where: { name_realm: { name, realm: realmSlug } } });
          if (char) {
            await prisma.mythicKey.deleteMany({
              where: { characterId: char.id, isFromBag: false }
            });

            for (const run of mythicData.current_period.best_runs) {
              await prisma.mythicKey.create({
                data: {
                  characterId: char.id,
                  dungeon: this.getName(run.dungeon),
                  level: run.keystone_level,
                  affixes: JSON.stringify(run.affixes?.map((a: any) => a.id) || []),
                  completed: true,
                  completedAt: new Date(run.completed_timestamp),
                  isFromBag: false
                }
              });
            }
          }
        }
      } catch (e) {
        console.error(`[M+Sync] Failed best runs for ${name}:`, e.message);
      }

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
      // IMPORTANT: European realms use localized slugs for names with special characters!
      const slug = guildName.toLowerCase()
        .replace(/[ä]/g, 'a')
        .replace(/[ö]/g, 'o')
        .replace(/[ü]/g, 'u')
        .replace(/[ß]/g, 'ss')
        .replace(/[\s\.]+/g, '-') // Handle spaces and dots
        .replace(/[^a-z0-9-]/g, '') // Remove everything else
        .replace(/-+/g, '-')      // Avoid double dashes
        .replace(/^-|-$/g, '');   // Trim dashes from start/end

      const encodedName = encodeURIComponent(slug);
      console.log(`[BNET] Fetching roster for guild: ${guildName} -> slug: ${slug} (encoded: ${encodedName}) on realm: ${realm}`);

      const data = await this.makeAPICall(`/data/wow/guild/${realm}/${encodedName}/roster`);

      // LOGGING RAW KEYS
      const { members, ...meta } = data;
      console.log(`[BNET] Roster success for ${guildName}. Member Count: ${members?.length || 0}`);

      return members || [];
    } catch (error: any) {
      console.error(`[BNET] Failed to fetch roster for ${guildName}@${realm}:`, error.message);
      // Detailed error log to help debugging
      if (error.response?.status === 404) {
        console.warn(`[BNET] 404 NOT FOUND for guild slug: ${guildName} -> ${realm}. Please check slugification logic.`);
      }
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
  static async syncGuildMembers(guildId: number, guildName: string, realmSlug: string, accessToken: string, deepSync: boolean = false): Promise<number> {
    try {
      const service = new BattleNetAPIService(accessToken);
      const members = await service.getGuildRoster(realmSlug, guildName);

      console.log(`[BNET] Syncing ${members.length} members for guild ${guildName} (DeepSync: ${deepSync})`);

      for (const member of members) {
        try {
          const charName = member.character.name.toLowerCase();
          const charRealm = member.character.realm.slug;

          const updatedChar = await prisma.character.upsert({
            where: {
              name_realm: {
                name: charName,
                realm: charRealm,
              },
            },
            update: {
              level: member.character.level,
              guildId: guildId,
              class: BattleNetAPIService.getStaticName(member.character.playable_class),
              classId: member.character.playable_class.id,
              race: BattleNetAPIService.getStaticName(member.character.playable_race),
              faction: typeof member.character.faction === 'object' ? (member.character.faction.name.de_DE || member.character.faction.name.en_US || member.character.faction.name) : member.character.faction,
              rank: member.rank,
              lastSync: new Date(),
            },
            create: {
              userId: 0,
              battleNetId: member.character.id.toString(),
              name: charName,
              realm: charRealm,
              level: member.character.level,
              class: BattleNetAPIService.getStaticName(member.character.playable_class),
              classId: member.character.playable_class.id,
              race: BattleNetAPIService.getStaticName(member.character.playable_race),
              faction: typeof member.character.faction === 'object' ? (member.character.faction.name.de_DE || member.character.faction.name.en_US || member.character.faction.name) : member.character.faction,
              guildId: guildId,
              rank: member.rank,
              lastSync: new Date(),
            },
          });

          // Wenn DeepSync an ist, holen wir RIO und Raid Fortschritt
          if (deepSync && member.character.level >= 70) {
            console.log(`[BNET] Deep Syncing details for ${charName}@${charRealm}...`);
            await service.syncSingleCharacterDetails(0, charRealm, charName);
            // Kleines Delay um Rate Limits zu schonen
            await new Promise(r => setTimeout(r, 200));
          }
        } catch (charErr) {
          console.error(`[BNET] Error syncing member ${member.character.name}:`, charErr);
        }
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
          mythicRating: mythicData.current_mythic_rating?.rating || 0,
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

  // Hilfsmethode zur Extraktion von Namen (instanz-basiert)
  public getName(obj: any): string {
    if (!obj || !obj.name) return 'Unknown';
    if (typeof obj.name === 'object') {
      return obj.name.de_DE || obj.name.en_US || obj.name.name || 'Unknown';
    }
    return obj.name;
  }

  // Hilfsmethode zur Extraktion von Namen (statisch)
  public static getStaticName(obj: any): string {
    if (!obj || !obj.name) return 'Unknown';
    if (typeof obj.name === 'object') {
      return obj.name.de_DE || obj.name.en_US || obj.name.name || 'Unknown';
    }
    return obj.name;
  }
}
