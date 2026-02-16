import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { logWebRTC } from '../api/debug';

interface StreamMetadata {
    id: string;
    userId: string;
    userName: string;
    title: string;
    quality: string;
    fps: number;
    startedAt: string;
    isHdr?: boolean;
    hdrSettings?: {
        brightness: number;
        contrast: number;
        saturation: number;
    } | null;
}

interface WebRTCContextType {
    activeStreams: StreamMetadata[];
    isStreaming: boolean;
    isConnecting: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    socket: Socket | null;
    startStream: (sourceId: string, constraints: any, metadata: any) => Promise<void>;
    stopStream: () => void;
    viewStream: (streamId: string) => Promise<void>;
    updateMetadata: (metadata: any) => void;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const WebRTCProvider = ({ children }: { children: ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeStreams, setActiveStreams] = useState<StreamMetadata[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const outgoingPCs = useRef<Map<string, RTCPeerConnection>>(new Map());
    const incomingPC = useRef<{ id: string, pc: RTCPeerConnection } | null>(null);
    const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const log = useCallback((event: string, data: any) => {
        const storedUser = localStorage.getItem('guild-manager-user');
        const user = storedUser ? JSON.parse(storedUser) : null;
        const userId = user?.battletag || 'unknown';

        if (socket?.connected) {
            socket.emit('webrtc-log', { event, data: { ...data, socketId: socket.id }, userId });
        } else {
            logWebRTC(event, { ...data, socketId: socket?.id });
        }
    }, [socket]);

    useEffect(() => {
        const backendUrl = window.electronAPI ? window.electronAPI.getBackendUrl() : 'http://localhost:3334';
        console.log('[WebRTC] Connecting to signaling server:', backendUrl);
        const newSocket = io(backendUrl);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            logWebRTC('init', { backendUrl, socketId: newSocket.id });
        });

        newSocket.on('streams-list', (streams: StreamMetadata[]) => {
            setActiveStreams(streams);
        });

        newSocket.on('streams-sync', (streams: StreamMetadata[]) => {
            setActiveStreams(streams);
        });

        newSocket.on('signal', async (data: { from: string; signal: any }) => {
            const { from, signal } = data;
            logWebRTC('signal_received', { from, type: signal.type || 'candidate', socketId: newSocket.id });

            try {
                if (signal.type === 'offer') {
                    await handleOffer(from, signal, newSocket);
                } else if (signal.type === 'answer') {
                    await handleAnswer(from, signal);
                } else if (signal.candidate) {
                    await handleCandidate(from, signal.candidate);
                }
            } catch (err: any) {
                console.error('[WebRTC] Signal error:', err);
                logWebRTC('signal_error', { from, error: err.message, socketId: newSocket.id });
            }
        });

        return () => {
            newSocket.disconnect();
            stopStream();
        };
    }, []);

    const createPeerConnection = (userId: string, isInitiator: boolean, currentSocket: Socket | null) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.nextcloud.com:443' }
            ],
            iceCandidatePoolSize: 10
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && (currentSocket || socket)) {
                const s = currentSocket || socket;
                s?.emit('signal', { to: userId, signal: { candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            if (!isInitiator) return;
            const streams = event.streams;
            const stream = streams[0];
            if (stream) {
                setRemoteStream(stream);
                setIsConnecting(false);
            }
        };

        if (!isInitiator && localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                if (incomingPC.current?.id === userId) {
                    setRemoteStream(null);
                    setIsConnecting(false);
                    incomingPC.current = null;
                }
                outgoingPCs.current.delete(userId);
            }
        };

        if (isInitiator) {
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });
        }

        return pc;
    };

    const processCandidateQueue = async (userId: string, pc: RTCPeerConnection) => {
        const queue = candidateQueues.current.get(userId) || [];
        if (queue.length > 0) {
            while (queue.length > 0) {
                const candidate = queue.shift();
                if (candidate) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e: any) {
                        console.error('[WebRTC] Error adding queued candidate:', e);
                    }
                }
            }
        }
        candidateQueues.current.delete(userId);
    };

    const handleOffer = async (from: string, offer: RTCSessionDescriptionInit, currentSocket: Socket) => {
        const pc = createPeerConnection(from, false, currentSocket);
        outgoingPCs.current.set(from, pc);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processCandidateQueue(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        currentSocket.emit('signal', { to: from, signal: answer });
    };

    const handleAnswer = async (from: string, answer: RTCSessionDescriptionInit) => {
        let pc = outgoingPCs.current.get(from);
        if (!pc && incomingPC.current?.id === from) pc = incomingPC.current.pc;
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await processCandidateQueue(from, pc);
        }
    };

    const handleCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
        let pc = outgoingPCs.current.get(from);
        if (!pc && incomingPC.current?.id === from) pc = incomingPC.current.pc;
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e: any) {
                console.error('[WebRTC] Error adding candidate:', e);
            }
        } else {
            if (!candidateQueues.current.has(from)) candidateQueues.current.set(from, []);
            candidateQueues.current.get(from)!.push(candidate);
        }
    };

    const startStream = async (sourceId: string, constraints: any, metadata: any) => {
        let stream: MediaStream;
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();

        try {
            log('start_stream_requested', { sourceId, constraints });

            const videoConstraints: any = {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: constraints.width,
                    maxWidth: constraints.width,
                    minHeight: constraints.height,
                    maxHeight: constraints.height,
                    minFrameRate: constraints.fps,
                    maxFrameRate: constraints.fps
                }
            };

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints
                } as any);
            } catch (videoErr: any) {
                console.error('[WebRTC] Video capture failed:', videoErr);
                throw videoErr;
            }

            // Capture Mic
            if (constraints.micId) {
                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: { deviceId: { exact: constraints.micId } }
                    });
                    const micSource = audioContext.createMediaStreamSource(micStream);
                    const micGain = audioContext.createGain();
                    micGain.gain.value = constraints.micMuted ? 0 : 1;
                    micSource.connect(micGain).connect(destination);
                } catch (e: any) {
                    console.error('[WebRTC] Failed to capture Mic:', e);
                }
            }

            // Capture Additional Audio Channels (Audio 1, Audio 2)
            if (constraints.audioIds) {
                for (let i = 0; i < constraints.audioIds.length; i++) {
                    const audioId = constraints.audioIds[i];
                    if (!audioId) continue;

                    try {
                        let extraStream: MediaStream | null = null;
                        if (audioId === 'default') {
                            console.log('[WebRTC] Capturing System Sound (desktop)...');
                            extraStream = await navigator.mediaDevices.getUserMedia({
                                audio: {
                                    mandatory: {
                                        chromeMediaSource: 'desktop',
                                        chromeMediaSourceId: sourceId
                                    }
                                } as any,
                                video: false
                            });
                        } else {
                            // First attempt to capture as is (might be input or virtual loopback)
                            extraStream = await navigator.mediaDevices.getUserMedia({
                                audio: { deviceId: { exact: audioId } }
                            });
                        }

                        if (extraStream) {
                            const source = audioContext.createMediaStreamSource(extraStream);
                            const gain = audioContext.createGain();
                            gain.gain.value = constraints.mutedAudio[i] ? 0 : 1;
                            source.connect(gain).connect(destination);
                        }
                    } catch (e: any) {
                        console.error(`[WebRTC] Failed to capture extra channel ${i} (${audioId}):`, e);
                        // Don't throw, just skip this channel so the rest of the stream can work
                    }
                }
            }

            const finalStream = new MediaStream([stream.getVideoTracks()[0]]);
            if (destination.stream.getAudioTracks().length > 0) {
                finalStream.addTrack(destination.stream.getAudioTracks()[0]);
            }

            setLocalStream(finalStream);
            localStreamRef.current = finalStream;
            setIsStreaming(true);
            socket?.emit('start-stream', metadata);
        } catch (error: any) {
            console.error('[WebRTC] Error starting stream:', error);
            setIsStreaming(false);
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            throw error;
        }
    };

    const stopStream = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        setLocalStream(null);
        localStreamRef.current = null;
        setIsStreaming(false);
        socket?.emit('stop-stream');

        outgoingPCs.current.forEach(pc => pc.close());
        outgoingPCs.current.clear();

        if (incomingPC.current) {
            incomingPC.current.pc.close();
            incomingPC.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.error);
            audioContextRef.current = null;
        }

        candidateQueues.current.clear();
        setRemoteStream(null);
        setIsConnecting(false);
    };

    const viewStream = async (streamId: string) => {
        if (incomingPC.current) {
            incomingPC.current.pc.close();
            candidateQueues.current.delete(incomingPC.current.id);
        }

        setRemoteStream(null);
        setIsConnecting(true);

        const pc = createPeerConnection(streamId, true, socket);
        incomingPC.current = { id: streamId, pc };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('signal', { to: streamId, signal: offer });
    };

    const updateMetadata = (metadata: any) => {
        if (!isStreaming) return;
        socket?.emit('update-stream-metadata', metadata);
        log('metadata_updated', metadata);
    };

    return (
        <WebRTCContext.Provider value={{
            activeStreams, isStreaming, isConnecting, localStream, remoteStream, socket,
            startStream, stopStream, viewStream, updateMetadata
        }}>
            {children}
        </WebRTCContext.Provider>
    );
};

export const useWebRTC = () => {
    const context = useContext(WebRTCContext);
    if (!context) throw new Error('useWebRTC must be used within WebRTCProvider');
    return context;
};
