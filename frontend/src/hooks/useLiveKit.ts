import { useCallback, useEffect, useState } from 'react';
import {
    Room,
    RoomEvent,
    RemoteTrack,
    RemoteTrackPublication,
    Participant,
    Track,
} from 'livekit-client';
import { useWebRTC } from './useWebRTC';

/**
 * useLiveKit Hook:
 * Manages the connection to a LiveKit SFU room.
 * Handles token fetching via socket and room lifecycle.
 */
export function useLiveKit() {
    const { socket } = useWebRTC();
    const [room, setRoom] = useState<Room | null>(null);
    const [remoteTracks, setRemoteTracks] = useState<any[]>([]);

    const joinStream = useCallback(async (streamId: string, identity: string) => {
        // 1. Request token from backend
        if (!socket) throw new Error('Socket not connected');

        return new Promise<void>((resolve, reject) => {
            socket.emit('request-room-token', { roomName: streamId, identity }, async (token: string) => {
                try {
                    const newRoom = new Room({
                        adaptiveStream: true,
                        dynacast: true,
                        publishDefaults: {
                            simulcast: true,
                            videoCodec: 'h264',
                        },
                    });

                    // Handle track subscriptions
                    newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
                        if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                            setRemoteTracks(prev => [...prev, track]);
                        }
                    });

                    newRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
                        setRemoteTracks(prev => prev.filter(t => t !== track));
                    });

                    // Join
                    const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7800';
                    await newRoom.connect(serverUrl, token);
                    setRoom(newRoom);
                    resolve();
                } catch (err) {
                    console.error('[LiveKit] Failed to connect:', err);
                    reject(err);
                }
            });
        });
    }, [socket]);

    const leaveStream = useCallback(async () => {
        if (room) {
            await room.disconnect();
            setRoom(null);
            setRemoteTracks([]);
        }
    }, [room]);

    useEffect(() => {
        return () => {
            leaveStream();
        };
    }, [leaveStream]);

    return {
        room,
        remoteTracks,
        joinStream,
        leaveStream
    };
}
