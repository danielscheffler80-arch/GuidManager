// Discord Integration Service
// Handhabt OAuth mit Discord und die Verknüpfung von Discord IDs zu User-Accounts

import axios from 'axios';
import prisma from '../prisma';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/discord/callback';

export class DiscordService {
  // Generiert Discord OAuth URL
  static getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: String(DISCORD_CLIENT_ID),
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
      state: state,
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  // Tauscht Authorization Code gegen Discord Token
  static async exchangeCodeForToken(code: string): Promise<any> {
    try {
      const response = await axios.post('https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: String(DISCORD_CLIENT_ID),
          client_secret: String(DISCORD_CLIENT_SECRET),
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: DISCORD_REDIRECT_URI,
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error('Discord Token Exchange Error:', e.response?.data || e.message);
      throw new Error('Failed to exchange Discord authorization code');
    }
  }

  // Ruft Discord User Info ab
  static async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      const e = error as any;
      console.error('Discord User Info Error:', e.response?.data || e.message);
      throw new Error('Failed to fetch Discord user info');
    }
  }

  // Verknüpft einen bestehenden Battle.net User mit einem Discord Account
  static async linkDiscordAccount(userId: number, discordData: any): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          discordId: discordData.id,
          discordTag: `${discordData.username}#${discordData.discriminator}`,
        },
      });
    } catch (error) {
      console.error('Failed to link Discord account:', error);
      throw error;
    }
  }
}
