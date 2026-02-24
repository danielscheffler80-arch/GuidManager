// User Controller
// Handhabt User-bezogene Operationen nach OAuth Login

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { BattleNetAPIService } from '../services/battleNetAPIService';
import prisma from '../prisma';

export class UserController {
  // Ruft User-Profil mit Charakteren ab
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      // Hole User aus Datenbank mit Charakteren
      const userData = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          characters: {
            orderBy: {
              lastSync: 'desc'
            }
          },
          guildMemberships: {
            include: {
              guild: true
            }
          }
        }
      });

      if (!userData) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: {
          id: userData.id,
          battletag: userData.name,
          battlenetId: userData.battleNetId,
          createdAt: userData.createdAt,
          characters: userData.characters,
          guildMemberships: userData.guildMemberships,
        }
      });

    } catch (error) {
      console.error('Get Profile Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user profile'
      });
    }
  }

  // Synchronisiert Charaktere mit Battle.net
  static async syncCharacters(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      // Hole User mit aktuellem Access Token
      const userData = await prisma.user.findUnique({
        where: { id: user.userId }
      });

      if (!userData || !userData.accessToken) {
        return res.status(401).json({
          success: false,
          error: 'No valid Battle.net connection'
        });
      }

      // Prüfe ob Token abgelaufen ist
      if (userData.tokenExpiresAt && new Date() > userData.tokenExpiresAt) {
        return res.status(401).json({
          success: false,
          error: 'Battle.net token expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      // Synchronisiere Charaktere
      const battleNetAPI = new BattleNetAPIService(userData.accessToken);
      await battleNetAPI.syncUserCharactersData(user.userId);

      // Hole aktualisierte Charaktere
      const characters = await prisma.character.findMany({
        where: { userId: user.userId },
        orderBy: { lastSync: 'desc' }
      });

      res.json({
        success: true,
        message: 'Characters synchronized successfully',
        characters: characters
      });

    } catch (error) {
      console.error('Sync Characters Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync characters'
      });
    }
  }

  // Setzt Main-Charakter
  static async setMainCharacter(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { characterId } = req.body;

      if (!characterId) {
        return res.status(400).json({
          success: false,
          error: 'Character ID required'
        });
      }

      // Prüfe ob Charakter dem User gehört
      const character = await prisma.character.findFirst({
        where: {
          id: characterId,
          userId: user.userId
        }
      });

      if (!character) {
        return res.status(404).json({
          success: false,
          error: 'Character not found or not owned by user'
        });
      }

      // Setze alle anderen Charaktere auf nicht-main
      await prisma.character.updateMany({
        where: { userId: user.userId },
        data: { isMain: false }
      });

      // Setze gewählten Charakter als Main
      const updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: { isMain: true }
      });

      res.json({
        success: true,
        message: 'Main character set successfully',
        character: updatedCharacter
      });

    } catch (error) {
      console.error('Set Main Character Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set main character'
      });
    }
  }

  // Ruft User-Gilden ab
  static async getGuilds(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      // Hole User mit Guild-Mitgliedschaften
      const userData = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          guildMemberships: {
            include: {
              guild: true
            },
            orderBy: {
              joinedAt: 'desc'
            }
          }
        }
      });

      if (!userData) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        guilds: userData.guildMemberships.map(membership => ({
          id: membership.guild.id,
          name: membership.guild.name,
          realm: membership.guild.realm,
          faction: membership.guild.faction,
          rank: membership.rank,
          joinedAt: membership.joinedAt,
        }))
      });

    } catch (error) {
      console.error('Get Guilds Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user guilds'
      });
    }
  }
  // Aktualisiert Charakter-Details (Rolle, Klasse, Aktivitätsstatus)
  static async updateCharacter(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { role, class: className, isActive } = req.body;

      const characterId = Number(id);
      if (Number.isNaN(characterId)) {
        return res.status(400).json({ success: false, error: 'Invalid character ID' });
      }

      // Prüfe Besitz
      const character = await prisma.character.findFirst({
        where: { id: characterId, userId: user.userId }
      });

      if (!character) {
        return res.status(404).json({ success: false, error: 'Character not found' });
      }

      // Role Normalization (tank -> Tank, dps -> DPS, healer -> Healer)
      let normalizedRole = role;
      if (role) {
        const r = role.toLowerCase();
        if (r === 'tank') normalizedRole = 'Tank';
        else if (r === 'healer') normalizedRole = 'Healer';
        else if (r === 'dps') normalizedRole = 'DPS';
      }

      const updated = await prisma.character.update({
        where: { id: characterId },
        data: {
          role: normalizedRole !== undefined ? normalizedRole : character.role,
          class: className !== undefined ? className : character.class,
          isActive: isActive !== undefined ? isActive : character.isActive
        }
      });

      res.json({ success: true, character: updated });
    } catch (error) {
      console.error('Update Character Error:', error);
      res.status(500).json({ success: false, error: 'Failed to update character' });
    }
  }
}
