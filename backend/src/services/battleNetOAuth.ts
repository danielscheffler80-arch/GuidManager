// Battle.net OAuth Service
// Handhabt den kompletten OAuth Flow mit Battle.net

import axios from 'axios';
import crypto from 'crypto';

const BNET_AUTH_URL = process.env.BNET_AUTH_URL || 'https://oauth.battle.net/authorize';
const BNET_TOKEN_URL = process.env.BNET_TOKEN_URL || 'https://oauth.battle.net/token';
const BNET_API_URL = process.env.BNET_API_URL || 'https://eu.api.blizzard.com';
const BNET_CLIENT_ID = process.env.BNET_CLIENT_ID;
const BNET_CLIENT_SECRET = process.env.BNET_CLIENT_SECRET;
const BNET_REDIRECT_URI = process.env.BNET_REDIRECT_URI || 'http://localhost:5173';
const BNET_SCOPE = process.env.BNET_SCOPE || 'wow.profile openid';
const BNET_REGION = process.env.BNET_REGION || 'eu';

const BNET_USERINFO_URL = process.env.BNET_USERINFO_URL || 'https://eu.battle.net/oauth/userinfo';

console.log(`Battle.net OAuth initialized with Refresh URI: ${BNET_REDIRECT_URI}`);

if (!BNET_CLIENT_ID || !BNET_CLIENT_SECRET) {
  throw new Error('Battle.net OAuth Credentials fehlen in .env Datei');
}

export class BattleNetOAuthService {
  // Generiert OAuth Authorization URL
  getAuthorizationUrl(state: string, redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: String(BNET_CLIENT_ID),
      redirect_uri: redirectUri || BNET_REDIRECT_URI,
      response_type: 'code',
      scope: BNET_SCOPE,
      state: state,
    });

    const authUrl = `${BNET_AUTH_URL}?${params.toString()}`;
    console.log('\n\n================================================');
    console.log(`[AUTH] Generated Auth URL:\n${authUrl}`);
    console.log('================================================\n\n');
    return authUrl;
  }

  // Tauscht Authorization Code gegen Access Token
  async exchangeCodeForToken(code: string, redirectUri?: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    try {
      const response = await axios.post(BNET_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: String(BNET_CLIENT_ID),
          client_secret: String(BNET_CLIENT_SECRET),
          redirect_uri: redirectUri || BNET_REDIRECT_URI,
          code: code,
        }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
      );

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error('Token Exchange Error:', e.response?.data || e.message);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  // Erneuert Access Token mit Refresh Token
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
  }> {
    try {
      const response = await axios.post(BNET_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: String(BNET_CLIENT_ID),
          client_secret: String(BNET_CLIENT_SECRET),
          refresh_token: refreshToken,
        }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
      );

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error('Token Refresh Error:', e.response?.data || e.message);
      throw new Error('Failed to refresh access token');
    }
  }

  // Ruft Benutzer-Profil von Battle.net ab
  async getUserProfile(accessToken: string): Promise<{
    id: number;
    battletag: string;
  }> {
    try {
      console.log('Fetching user profile from:', BNET_USERINFO_URL);
      const response = await axios.get(BNET_USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error('User Profile Error Detail:', {
        url: BNET_USERINFO_URL,
        message: e.message,
        response: e.response?.data,
        status: e.response?.status
      });
      throw new Error(`Failed to fetch user profile: ${e.message}`);
    }
  }

  // Ruft WoW-Charaktere des Benutzers ab
  async getUserCharacters(accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get(`${BNET_API_URL}/profile/user/wow`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          region: BNET_REGION,
          namespace: `profile-${BNET_REGION}`,
          locale: 'de_DE',
        },
      });

      return response.data.character_accounts || [];
    } catch (error) {
      const e = error as any;
      console.error('User Characters Error:', e.response?.data || e.message);
      throw new Error('Failed to fetch user characters');
    }
  }

  // Ruft Gilden-Informationen ab
  async getGuildInfo(accessToken: string, realm: string, guildName: string): Promise<any> {
    try {
      const encodedGuildName = encodeURIComponent(guildName);
      const response = await axios.get(`${BNET_API_URL}/data/wow/guild/${realm}/${encodedGuildName}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          region: BNET_REGION,
          namespace: `profile-${BNET_REGION}`,
          locale: 'de_DE',
        },
      });

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error('Guild Info Error:', e.response?.data || e.message);
      throw new Error('Failed to fetch guild information');
    }
  }

  // Generiert sicheren Zustand für OAuth Flow
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Validiert OAuth State
  validateState(state: string, storedState: string): boolean {
    return state === storedState;
  }
}

export const battleNetOAuth = new BattleNetOAuthService();
