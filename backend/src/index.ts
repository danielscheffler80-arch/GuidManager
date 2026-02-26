import dotenv from 'dotenv';
dotenv.config();

// DEPLOY TRIGGER v0.9.9 - Global Visibility
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
import prisma from './prisma';
import { AuthController } from './controllers/authController';

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true, // Erlaube alle Origins für Remote-Zugriff
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

// Health
app.get('/health', async (_req, res) => {
  try {
    // Basic liveness check (always returns true if server is up)
    const status: any = {
      ok: true,
      server: 'online',
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development'
    };

    // Optional Database check with short timeout
    try {
      const dbPromise = prisma.user.count();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), 3000)
      );
      await Promise.race([dbPromise, timeoutPromise]);
      status.database = 'connected';
    } catch (dbErr: any) {
      status.database = dbErr.message === 'DB_TIMEOUT' ? 'timeout' : 'error';
      status.dbError = dbErr.message;
      // We still return 200/ok:true for liveness, but report DB status
      console.warn(`[HEALTH] Database check degraded: ${dbErr.message}`);
    }

    res.json(status);
  } catch (err: any) {
    console.error(`[HEALTH] Critical failure: ${err.message}`);
    res.status(500).json({
      ok: false,
      error: err.message,
      time: new Date().toISOString()
    });
  }
});

// API Routes
console.log('[INIT] Registering routes...');
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

// Initialize Socket Service
console.log('[INIT] Initializing Socket.IO...');
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
console.log(`[INIT] Starting server on port ${port}...`);
server.listen(port, '0.0.0.0', () => {
  console.log(`[READY] Backend listening on http://0.0.0.0:${port} (PID: ${process.pid})`);
});


export default app;
