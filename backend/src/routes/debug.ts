import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const LOG_FILE = path.join(process.cwd(), 'webrtc_debug.log');

router.post('/webrtc-logs', (req, res) => {
    const { event, data, timestamp, userId } = req.body;

    const logEntry = {
        time: timestamp || new Date().toISOString(),
        user: userId || 'unknown',
        event,
        data
    };

    const logLine = `[${logEntry.time}] [User: ${logEntry.user}] [Event: ${logEntry.event}] ${JSON.stringify(logEntry.data)}\n`;

    fs.appendFile(LOG_FILE, logLine, (err) => {
        if (err) {
            console.error('[Debug] Error writing to log file:', err);
            return res.status(500).json({ error: 'Failed to write log' });
        }
        res.json({ success: true });
    });
});

export default router;
