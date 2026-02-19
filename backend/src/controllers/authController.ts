// Auth Controller
// Handhabt OAuth Login/Logout und User Authentication

import { Request, Response } from 'express';
import { battleNetOAuth } from '../services/battleNetOAuth';
import { JWTService } from '../services/jwtService';
import { BattleNetAPIService } from '../services/battleNetAPIService';
import prisma from '../prisma';

// Speichert OAuth States temporär (ID -> result)
const oauthStates = new Map<string, {
  timestamp: number;
  redirectUri?: string;
  result?: {
    success: boolean;
    user: any;
    tokens: any;
    error?: string;
  }
}>();

export class AuthController {
  // Startet OAuth Flow - leitet zu Battle.net weiter
  static async login(req: Request, res: Response) {
    try {
      // Generiere sicheren State
      const state = battleNetOAuth.generateState();
      console.log(`[AUTH] Initiating login. Generated State: ${state}`);

      // Get optional redirectUri from query
      const redirectUri = req.query.redirectUri as string | undefined;

      // Speichere State mit Timestamp (10 Minuten Gültigkeit)
      oauthStates.set(state, {
        timestamp: Date.now(),
        redirectUri
      });

      console.log(`[AUTH] Using Redirect URI: ${redirectUri || 'Default (Env)'}`);

      // Generiere OAuth URL
      const authUrl = battleNetOAuth.getAuthorizationUrl(state, redirectUri);

      // Leite zu Battle.net weiter
      res.json({
        success: true,
        authUrl,
        state
      });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate login'
      });
    }
  }

  // Verarbeitet OAuth Callback von Battle.net
  static async callback(req: Request, res: Response) {
    const { code, state } = req.query;
    console.log(`[AUTH] Callback received. Code: ${code ? 'PRESENT' : 'MISSING'}, State: ${state}`);

    try {
      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: 'Missing code or state parameter'
        });
      }

      // Validiere State
      const storedState = oauthStates.get(state as string);
      if (!storedState) {
        console.error(`[AUTH] State validation failed. State ${state} not found in:`, Array.from(oauthStates.keys()));
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired state'
        });
      }

      console.log(`[AUTH] Callback for state ${state}. Using Redirect URI: ${storedState.redirectUri || 'Default (Env)'}`);

      // Tausche Code gegen Token
      const tokenData = await battleNetOAuth.exchangeCodeForToken(code as string, storedState.redirectUri);

      // Hole User Profile
      const userProfile = await battleNetOAuth.getUserProfile(tokenData.access_token);

      // Synchronisiere nur Basis-Userdaten (Charaktere kommen später im Dashboard)
      const user = await BattleNetAPIService.syncBasicUser(userProfile, tokenData);

      // Generiere JWT Token
      const jwtToken = JWTService.generateToken({
        userId: user.id,
        battletag: user.name,
        battlenetId: user.battleNetId,
      });

      // Generiere Refresh Token
      const refreshToken = JWTService.generateRefreshToken(user.id);

      // Hole User mit Gilden-Mitgliedschaften
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { guildMemberships: true }
      });

      const result = {
        success: true,
        user: {
          id: user.id,
          battletag: user.name,
          battlenetId: user.battleNetId,
          guildMemberships: dbUser?.guildMemberships || []
        },
        tokens: {
          accessToken: jwtToken,
          refreshToken: refreshToken,
          expiresIn: 60 * 60 * 24 * 7, // 7 Tage
        }
      };

      // Speichere Ergebnis für Polling
      console.log(`[AUTH] Storing login result for state: ${state}`);
      oauthStates.set(state as string, { ...storedState, result });

      // Sende freundliche HTML Antwort statt nur JSON
      res.send(`
        <html>
          <body style="background: #252525; color: #D1D9E0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; margin: 0;">
            <div style="background: #2D2D2D; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #333; max-width: 400px;">
              <h1 style="color: #A330C9; margin-top: 0;">Login erfolgreich!</h1>
              <p style="font-size: 1.1em; line-height: 1.5;">Du kannst dieses Browser-Fenster jetzt schließen.</p>
              <p style="color: #888;">Deine Desktop-App hat dich bereits eingeloggt.</p>
              <p id="timer" style="color: #666; font-size: 0.9em; margin-top: 20px;">Fenster wird automatisch geschlossen in <span id="seconds">3</span> Sekunden...</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #444; color: #666; font-size: 0.8em; letter-spacing: 1px;">XAVA GUILD MANAGER</div>
            </div>
            <script>
              let seconds = 3;
              const interval = setInterval(() => {
                seconds--;
                document.getElementById('seconds').textContent = seconds;
                if (seconds <= 0) {
                  clearInterval(interval);
                  window.close();
                }
              }, 1000);
            </script>
          </body>
        </html>
      `);

    } catch (error) {
      const e = error as any;
      console.error('OAuth Callback Error Detail:', {
        message: e.message,
        response: e.response?.data,
        stack: e.stack
      });

      if (state) {
        const storedState = oauthStates.get(state as string);
        if (storedState) {
          oauthStates.set(state as string, {
            ...storedState,
            result: {
              success: false,
              error: e.message,
              user: null,
              tokens: null
            }
          });
        }
      }

      res.status(500).send(`
        <html>
          <body style="background: #252525; color: #D1D9E0; display: flex; align-items: center; justify-center; height: 100vh; font-family: sans-serif; text-align: center;">
            <div style="background: #2D2D2D; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 1px solid #333;">
              <h2 style="color: #FF4444;">Login fehlgeschlagen</h2>
              <p>${e.message}</p>
              <p>Bitte schließe dieses Fenster und versuche es erneut.</p>
            </div>
          </body>
        </html>
      `);
    }
  }

  // Polling Endpoint für Login Status
  static async checkStatus(req: Request, res: Response) {
    const { state } = req.params;
    console.log(`[POLLING] Received status check for state: ${state}`);

    const storedState = oauthStates.get(state);

    if (!storedState) {
      console.log(`[POLLING] State NOT FOUND: ${state}. Available states:`, Array.from(oauthStates.keys()));
      return res.status(404).json({ success: false, error: 'State not found' });
    }

    if (storedState.result) {
      console.log(`[POLLING] Result FOUND for state: ${state}. Success: ${storedState.result.success}`);
      // Wenn Ergebnis vorliegt, State danach löschen
      oauthStates.delete(state);
      return res.json(storedState.result);
    }

    // Noch kein Ergebnis
    console.log(`[POLLING] Result PENDING for state: ${state}`);
    res.json({ success: false, pending: true });
  }

  // Synchronisiert Charaktere (wird vom Dashboard aus aufgerufen)
  static async syncCharacters(req: Request, res: Response) {
    const userId = (req as any).user?.userId;
    const detailed = req.query.detailed === 'true';
    console.log(`[AUTH] Sync requested for user ID: ${userId} (Detailed: ${detailed})`);

    try {
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.accessToken) {
        return res.status(404).json({ success: false, error: 'User or token not found' });
      }

      const service = new BattleNetAPIService(user.accessToken);

      // Wenn nicht detailed, machen wir nur den schnellen Sync
      await service.syncUserCharactersData(user.id, detailed);

      res.json({ success: true, message: detailed ? 'Full sync successful' : 'Basic sync successful' });
    } catch (error) {
      console.error('Character sync error:', error);
      res.status(500).json({ success: false, error: 'Failed to sync characters' });
    }
  }

  // Debug Endpoint für Frontend Logs
  static async debug(req: Request, res: Response) {
    const { message, data } = req.body;
    console.log(`[FRONTEND-DEBUG] ${message}`, data || '');
    res.json({ success: true });
  }

  // User Logout
  static async logout(req: Request, res: Response) {
    try {
      // In dieser einfachen Version nur Client-Seitig
      // In Produktion: Token Blacklisting implementieren

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout Error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Aktualisiert Access Token
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // Validiere Refresh Token
      const payload = JWTService.verifyRefreshToken(refreshToken);

      // Hole User aus Datenbank
      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Generiere neuen Access Token
      const newAccessToken = JWTService.generateToken({
        userId: user.id,
        battletag: user.name,
        battlenetId: user.battleNetId,
      });

      res.json({
        success: true,
        accessToken: newAccessToken,
        expiresIn: 60 * 60 * 24 * 7, // 7 Tage
      });

    } catch (error) {
      console.error('Token Refresh Error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  }

  // Aktuelle User Info
  static async me(req: Request, res: Response) {
    try {
      // User ist durch Auth Middleware bereits verifiziert
      const user = (req as any).user;

      // Hole aktuelle User-Daten mit Gilden-Mitgliedschaften
      const currentUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          id: true,
          name: true,
          battleNetId: true,
          createdAt: true,
          guildMemberships: {
            include: {
              guild: {
                select: {
                  id: true,
                  name: true,
                  adminRanks: true
                }
              }
            }
          }
        }
      });

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: {
          id: currentUser.id,
          battletag: currentUser.name,
          battlenetId: currentUser.battleNetId,
          createdAt: currentUser.createdAt,
          guildMemberships: currentUser.guildMemberships
        }
      });

    } catch (error) {
      console.error('Me Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user info'
      });
    }
  }
  // Holt alle Charaktere des Users
  static async getCharacters(req: Request, res: Response) {
    const userId = (req as any).user?.userId;

    try {
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const characters = await prisma.character.findMany({
        where: { userId },
        orderBy: [
          { level: 'desc' },
          { name: 'asc' }
        ]
      });

      res.json({ success: true, characters });
    } catch (error) {
      console.error('Get characters error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch characters' });
    }
  }

  // Setzt den Main Character
  static async setMainCharacter(req: Request, res: Response) {
    const userId = (req as any).user?.userId;
    const { characterId } = req.body;

    try {
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!characterId) {
        return res.status(400).json({ success: false, error: 'Character ID required' });
      }

      // Verifiziere dass der Charakter dem User gehört
      const character = await prisma.character.findFirst({
        where: { id: characterId, userId }
      });

      if (!character) {
        return res.status(404).json({ success: false, error: 'Character not found or access denied' });
      }

      // Transaktion: Alle anderen isMain = false, dieser = true
      await prisma.$transaction([
        prisma.character.updateMany({
          where: { userId },
          data: { isMain: false }
        }),
        prisma.character.update({
          where: { id: characterId },
          data: { isMain: true }
        })
      ]);

      // Priorisierter Detail-Sync für den neuen Main im Hintergrund
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.accessToken) {
        const service = new BattleNetAPIService(user.accessToken);
        service.syncSingleCharacterDetails(user.id, character.realm, character.name);
      }

      res.json({ success: true, message: 'Main character updated successfully' });
    } catch (error) {
      console.error('Set main character error:', error);
      res.status(500).json({ success: false, error: 'Failed to update main character' });
    }
  }

  // Toggled den Favoriten-Status
  static async toggleFavoriteCharacter(req: Request, res: Response) {
    const userId = (req as any).user?.userId;
    const { characterId } = req.body;

    try {
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const character = await prisma.character.findFirst({
        where: { id: characterId, userId }
      });

      if (!character) {
        return res.status(404).json({ success: false, error: 'Character not found' });
      }

      const updated = await prisma.character.update({
        where: { id: characterId },
        data: { isFavorite: !character.isFavorite }
      });

      res.json({ success: true, isFavorite: updated.isFavorite });
    } catch (error) {
      console.error('Toggle favorite error:', error);
      res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
    }
  }
}
