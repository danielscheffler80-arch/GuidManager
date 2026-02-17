import { Server, Socket } from 'socket.io';
import prisma from '../prisma';

interface StreamMetadata {
    id: string;
    userId: string;
    userName: string;
    title: string;
    quality: string;
    fps: number;
    startedAt: string;
    isPublic: boolean;
    guildId?: number;
    hasJoinCode: boolean;
    joinCode?: string; // Keep on server for validation
}

const activeStreams = new Map<string, StreamMetadata>();

export function initSocketService(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        // Send initial list of active streams
        socket.emit('streams-list', Array.from(activeStreams.values()));

        socket.on('join-guild', (guildId: string | number) => {
            const room = `guild_${guildId}`;
            socket.join(room);
            console.log(`User ${socket.id} joined room: ${room}`);
        });

        socket.on('start-stream', (metadata: Omit<StreamMetadata, 'id' | 'startedAt'>) => {
            const streamId = socket.id;
            const newStream: StreamMetadata = {
                ...metadata,
                id: streamId,
                startedAt: new Date().toISOString(),
            };
            activeStreams.set(streamId, newStream);
            io.emit('streams-sync', Array.from(activeStreams.values()));
            console.log(`Stream started: ${newStream.title} by ${newStream.userName}`);
        });

        socket.on('stop-stream', () => {
            if (activeStreams.has(socket.id)) {
                activeStreams.delete(socket.id);
                io.emit('streams-sync', Array.from(activeStreams.values()));
                console.log(`Stream stopped: ${socket.id}`);
            }
        });

        // WebRTC Signaling
        socket.on('signal', (data: { to: string; signal: any }) => {
            console.log(`[Socket] Forwarding signal from ${socket.id} to ${data.to} (Type: ${data.signal?.type || 'candidate'})`);

            // Forward signal to the specific user
            io.to(data.to).emit('signal', {
                from: socket.id,
                signal: data.signal
            });
        });

        // Deduplication cache for guild chat
        const chatCache = new Map<string, number>();

        socket.on('guild-chat', async (data: any) => {
            if (!data.guildId || !data.sender || !data.content) return;

            // Create a unique key for the message
            const msgKey = `${data.guildId}_${data.sender}_${data.content}`;
            const now = Date.now();

            // Check if we've seen this message recently (last 5 seconds)
            const lastSeen = chatCache.get(msgKey);
            if (lastSeen && (now - lastSeen) < 5000) {
                // console.log(`[Chat] Deduplicated message from ${data.sender}`);
                return;
            }

            // Update cache
            chatCache.set(msgKey, now);

            // Cleanup old cache entries occasionally
            if (chatCache.size > 100) {
                for (const [key, time] of chatCache.entries()) {
                    if (now - time > 10000) chatCache.delete(key);
                }
            }

            // Save to DB
            try {
                await prisma.guildChat.create({
                    data: {
                        guildId: Number(data.guildId),
                        sender: data.sender,
                        content: data.content,
                        timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
                    }
                });
            } catch (err) {
                console.error('[Socket] Failed to save chat message:', err);
            }

            io.to(`guild_${data.guildId}`).emit('guild-chat', data);

            // Resolve character name for live broadcast
            let displaySender = data.sender;
            try {
                const userWithMain = await prisma.user.findFirst({
                    where: { name: data.sender },
                    include: {
                        characters: {
                            where: { isMain: true },
                            take: 1
                        }
                    }
                });

                if (userWithMain && userWithMain.characters && userWithMain.characters.length > 0) {
                    displaySender = userWithMain.characters[0].name;
                } else {
                    // Fallback to name part of BattleTag
                    displaySender = data.sender.split('#')[0];
                }
            } catch (err) {
                console.error('[Socket] Name resolution failed:', err);
                displaySender = data.sender.split('#')[0];
            }

            // Emit again with resolved name for display
            io.to(`guild_${data.guildId}`).emit('guild-chat-resolved', { ...data, sender: displaySender });
        });

        // Debug Logging via Socket
        socket.on('webrtc-log', (data: { event: string, data: any, timestamp?: string, userId?: string }) => {
            const fs = require('fs');
            const path = require('path');
            const LOG_FILE = path.join(process.cwd(), 'webrtc_debug.log');

            const logEntry = {
                time: data.timestamp || new Date().toISOString(),
                user: data.userId || 'unknown',
                event: data.event,
                data: data.data
            };

            const logLine = `[${logEntry.time}] [User: ${logEntry.user}] [Event: ${logEntry.event}] ${JSON.stringify(logEntry.data)}\n`;

            fs.appendFile(LOG_FILE, logLine, (err: any) => {
                if (err) console.error('[Socket-Log] Error writing to log file:', err);
            });
        });

        socket.on('disconnect', () => {
            if (activeStreams.has(socket.id)) {
                activeStreams.delete(socket.id);
                io.emit('streams-sync', Array.from(activeStreams.values()));
                console.log(`User disconnected, stream removed: ${socket.id}`);
            }
        });
    });
}
