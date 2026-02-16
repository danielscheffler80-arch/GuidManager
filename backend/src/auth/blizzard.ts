import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID || '';
const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.BLIZZARD_REDIRECT_URI || '';
const TOKEN_URL = 'https://oauth.battle.net/oauth/token';
const AUTHORIZE_URL = 'https://www.battle.net/oauth/authorize';

// Step 1: Redirect user to Blizzard authorization page
router.get('/authorize', (_req, res) => {
  const url = `${AUTHORIZE_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(url);
});

// Step 2: Blizzard will redirect back with a code; exchange for tokens
router.get('/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await resp.json();
    // In a full app, you'd map this to a user and issue a JWT here
    res.json({ blizzardToken: data });
  } catch (e) {
    res.status(500).json({ error: ' Blizzard OAuth failed', detail: (e as Error).message });
  }
});

export default router;
