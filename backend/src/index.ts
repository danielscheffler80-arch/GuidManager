import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

import guildsRouter from './routes/guilds';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import guildRouter from './routes/guild';
import debugRouter from './routes/debug';
import { initSocketService } from './services/socketService';
import prisma from './prisma';

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true, // Erlaube alle Origins für Remote-Zugriff
  credentials: true
}));
app.use(express.json());
app.use('/updates', express.static(path.join(__dirname, '../updates')));

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
    // Timeout für DB Check
    const dbPromise = prisma.user.count();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database Timeout')), 5000)
    );

    const userCount = await Promise.race([dbPromise, timeoutPromise]) as number;

    res.json({
      ok: true,
      database: 'connected',
      userCount,
      time: new Date().toISOString()
    });
  } catch (err: any) {
    console.error(`[HEALTH] Fehler: ${err.message}`);
    res.status(500).json({
      ok: false,
      database: 'error',
      message: err.message,
      time: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api', guildsRouter);
app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/guild', guildRouter);
app.use('/api/debug', debugRouter);

// Updates für Standalone App
app.use('/updates', express.static(path.join(__dirname, '../updates')));


// Initialize Socket Service
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
server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port} (PID: ${process.pid})`);
  console.log(`BNET_REDIRECT_URI at runtime: ${process.env.BNET_REDIRECT_URI}`);
  console.log(`DATABASE_URL starts with: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
});

export default app;
