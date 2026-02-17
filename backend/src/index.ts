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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Erlaube alle Origins
    methods: ['GET', 'POST'],
    credentials: true
  },
});

// Request Logger für Callback Fehlersuche
app.use((req, _res, next) => {
  if (req.path.includes('callback')) {
    console.log(`[REQUEST-LOG] ${req.method} ${req.url} from ${req.ip}`);
  }
  next();
});

app.use(cors({
  origin: true, // Erlaube alle Origins für Remote-Zugriff
  credentials: true
}));
app.use(express.json());

// Health
app.get('/health', async (_req, res) => {
  try {
    // Kurzer Prisma-Check
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const userCount = await prisma.user.count();
    res.json({
      ok: true,
      database: 'connected',
      userCount,
      time: new Date().toISOString()
    });
  } catch (err) {
    res.json({
      ok: true,
      database: 'error',
      message: (err as Error).message,
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
initSocketService(io);

// Fallback
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3334;
server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port} (PID: ${process.pid})`);
  console.log(`BNET_REDIRECT_URI at runtime: ${process.env.BNET_REDIRECT_URI}`);
});

export default app;
