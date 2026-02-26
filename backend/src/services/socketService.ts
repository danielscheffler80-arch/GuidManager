import { Server, Socket } from 'socket.io';
import prisma from '../prisma';
import { LiveKitService } from './livekitService';

interface StreamMetadata {
    id: string;
    userId: string;
    userName: string;
    title: string;
    game: string;
    streamType: 'webcam' | 'screen' | 'window';
    quality: string;
    startedAt: string;
    isSFU?: boolean;
}

const activeStreams = new Map<string, StreamMetadata>();

export const initSocketService = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join-guild', (guildId: string) => {
            socket.join(`guild_${guildId}`);
            console.log(`User ${socket.id} joined guild room: ${guildId}`);
        });

        socket.on('join-room', (room: string) => {
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

        // LiveKit SFU Support
        socket.on('request-room-token', async (data: { roomName: string, identity: string, isPublisher?: boolean }, callback: (token: string) => void) => {
            try {
                const token = await LiveKitService.createToken(data.roomName, data.identity, data.isPublisher);
                callback(token);
            } catch (err) {
                console.error('[Socket] Failed to generate LiveKit token:', err);
            }
        });

        socket.on('stop-stream', () => {
            if (activeStreams.has(socket.id)) {
                activeStreams.delete(socket.id);
                io.emit('streams-sync', Array.from(activeStreams.values()));
                console.log(`Stream stopped: ${socket.id}`);
            }
        });

        socket.on('disconnect', () => {
            if (activeStreams.has(socket.id)) {
                activeStreams.delete(socket.id);
                io.emit('streams-sync', Array.from(activeStreams.values()));
            }
            console.log(`User disconnected: ${socket.id}`);
        });

        // Multi-view Signaling Fallback (for older P2P)
        socket.on('offer', (data: { to: string, offer: any }) => {
            socket.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
        });

        socket.on('answer', (data: { to: string, answer: any }) => {
            socket.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
        });

        socket.on('ice-candidate', (data: { to: string, candidate: any }) => {
            socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
        });

        socket.on('quality-request', (data: { to: string, quality: string }) => {
            socket.to(data.to).emit('quality-request', { from: socket.id, quality: data.quality });
        });

        // Chat
        socket.on('send-guild-msg', async (data: { guildId: string, userId: string, content: string }) => {
            try {
                const message = await prisma.guildMessage.create({
                    data: {
                        content: data.content,
                        userId: data.userId,
                        guildId: data.guildId
                    },
                    include: { user: true }
                });
                io.to(`guild_${data.guildId}`).emit('guild-msg', message);
            } catch (err) {
                console.error('Failed to save guild message:', err);
            }
        });
    });
};
