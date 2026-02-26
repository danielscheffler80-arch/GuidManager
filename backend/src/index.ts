import dotenv from 'dotenv';
dotenv.config();

// DEPLOY TRIGGER v0.9.10 - SFU Update Sync
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { Server } from 'socket.io';

import guildsRouter from './routes/guilds';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import guildRouter from './routes/guild';
import debugRouter from './routes/debug';
import messagesRouter from './routes/messages';
import syncRouter from './routes/sync';
import adminRouter from './routes/admin';
import { initSocketService } from './services/socketService';
import { SchemaService } from './services/schemaService';
import prisma from './prisma';
import { AuthController } from './controllers/authController';

const app = express();
const server = http.createServer(app);

// --- STARTUP SCHEMA ENFORCEMENT ---
SchemaService.ensureSchema().catch(err => {
  console.error('[CRITICAL] Schema enforcement failed:', err);
});

// --- ULTRA EARLY HEALTHCHECK (Railway Resilience) ---
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    status: 'liveness_check_passed',
    time: new Date().toISOString()
  });
});

console.log('[INIT] Step 1: App & Healthcheck ready');

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use('/updates', express.static(path.resolve(__dirname, '../updates')));

// Request Logger (erweitert)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health') {
      console.log(`[REQUEST] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Full Health (Internal/Detailed) - Renamed to avoid early healthcheck conflict
app.get('/api/health/detailed', async (_req, res) => {
  try {
    const status: any = {
      ok: true,
      server: 'online',
      time: new Date().toISOString()
    };
    try {
      const dbPromise = prisma.user.count();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), 3000)
      );
      await Promise.race([dbPromise, timeoutPromise]);
      status.database = 'connected';
    } catch (dbErr: any) {
      status.database = 'error';
      status.dbError = dbErr.message;
    }
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// API Routes
console.log('[INIT] Step 2: Registering routes...');
app.use('/api', guildsRouter);
app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/guild', guildRouter);
app.use('/api/debug', debugRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/admin', adminRouter);

// Debug Route
app.get('/api/debug/db', AuthController.debugDB);

// Download redirect for Universal Setup
app.get('/api/download/latest', (req, res) => {
  res.redirect('/updates/GuildManagerSetup.exe');
});

// Version Info for Bootstrapper
app.get('/api/update/info', (req, res) => {
  try {
    const latestPath = path.join(__dirname, '../updates/latest.yml');
    if (fs.existsSync(latestPath)) {
      const fileContents = fs.readFileSync(latestPath, 'utf8');
      const data = yaml.load(fileContents) as any;
      res.json({ version: data.version });
    } else {
      res.status(404).json({ error: 'latest.yml not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read version info' });
  }
});

// List Available Versions for Selector
app.get('/api/update/list', (req, res) => {
  try {
    const updatesDir = path.join(__dirname, '../updates');
    if (!fs.existsSync(updatesDir)) {
      return res.status(404).json({ error: 'Updates directory not found' });
    }

    const files = fs.readdirSync(updatesDir);

    // Find versioned setups: GuildManagerSetup_*.exe or universal ones
    const versions = files
      .filter(f => f.startsWith('GuildManagerSetup') && f.endsWith('.exe'))
      .map(f => {
        const match = f.match(/GuildManagerSetup_(.*?)\.exe/);
        return {
          filename: f,
          version: match ? match[1] : 'Latest',
          url: `/updates/${f}`
        };
      });

    // Sort by version (descending)
    versions.sort((a, b) => {
      if (a.version === 'Latest') return -1;
      if (b.version === 'Latest') return 1;
      const partsA = a.version.split('.').map(Number);
      const partsB = b.version.split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const vA = partsA[i] || 0;
        const vB = partsB[i] || 0;
        if (vA !== vB) return vB - vA;
      }
      return 0;
    });

    res.json({ success: true, versions: versions.slice(0, 3) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// Initialize Socket Service
console.log('[INIT] Step 3: Initializing Socket.IO...');
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  },
});
initSocketService(io);

// Fallback
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3334;
console.log(`[INIT] Step 4: Starting server on port ${port}...`);
server.listen(port, '0.0.0.0', () => {
  console.log(`[READY] Backend listening on http://0.0.0.0:${port} (PID: ${process.pid})`);
});

export default app;
