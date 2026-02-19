import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { storage } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';

export default function StreamSettings() {
    const { user } = useAuth();
    const { guilds } = useGuild();
    const {
        localStream,
        isStreaming,
        isConnecting,
        activeStreams,
        socket,
        startStream,
        stopStream,
        updateMetadata,
        updateConstraints
    } = useWebRTC();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const [sources, setSources] = useState<any[]>([]);
    const [selectedSource, setSelectedSource] = useState('');
    const [resolution, setResolution] = useState(() => {
        const stored = storage.get('guild-manager-stream-resolution', '');
        if (stored) return stored;
        const height = window.screen.height;
        if (height >= 1440) return '1440';
        if (height >= 1080) return '1080';
        return '720';
    });
    const [fps, setFps] = useState(() => storage.get('guild-manager-stream-fps', 60));

    const [hdrSettings, setHdrSettings] = useState(() => {
        return storage.get('guild-manager-hdr-settings', {
            brightness: 0.8,
            contrast: 1.15,
            saturation: 1.25
        });
    });

    const [audioSources, setAudioSources] = useState<MediaDeviceInfo[]>([]);

    // New Audio Structure
    const [micId, setMicId] = useState(() => localStorage.getItem('guild-manager-mic-id') || '');
    const [micMuted, setMicMuted] = useState(() => localStorage.getItem('guild-manager-mic-muted') === 'true');

    const [audioChannels, setAudioChannels] = useState<{ id: string, muted: boolean }[]>(() => {
        return storage.get('guild-manager-audio-channels', [{ id: '', muted: false }, { id: '', muted: false }]);
    });

    const [defaultBitrate, setDefaultBitrate] = useState(() => storage.get('guild-manager-stream-bitrate', 6000));
    const [defaultOptimization, setDefaultOptimization] = useState(() => storage.get('guild-manager-stream-optimization', 'motion'));
    const [encoderMode, setEncoderMode] = useState(() => storage.get('guild-manager-stream-encoder', 'gpu'));
    const [cpuPreset, setCpuPreset] = useState(() => storage.get('guild-manager-stream-cpu-preset', 'veryfast'));

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const [isPublic, setIsPublic] = useState(() => storage.get('stream-privacy-public', true));
    const [privacyGuildId, setPrivacyGuildId] = useState(() => storage.get('stream-privacy-guild-id', ''));
    const [joinCode, setJoinCode] = useState(() => {
        const stored = storage.get('stream-privacy-code', '');
        return stored || '';
    });

    const [gpuName, setGpuName] = useState<string>('Wird erkannt...');

    const hdrPresets = {
        subtle: { brightness: 0.9, contrast: 1.1, saturation: 1.1 },
        standard: { brightness: 0.8, contrast: 1.15, saturation: 1.25 },
        vivid: { brightness: 0.8, contrast: 1.3, saturation: 1.5 },
        min: { brightness: 0.5, contrast: 0.5, saturation: 0.5 }
    };

    useEffect(() => {
        storage.set('guild-manager-hdr-settings', hdrSettings);
        // We still auto-update if streaming, but the button gives a clearer "Apply" action
        if (isStreaming) {
            const isHdr = window.matchMedia?.('(dynamic-range: high)').matches || false;
            updateMetadata({ isHdr, hdrSettings });
        }
    }, [hdrSettings, isStreaming, updateMetadata]);

    const handleApplySettings = () => {
        if (isStreaming) {
            const isHdr = window.matchMedia?.('(dynamic-range: high)').matches || false;
            updateMetadata({ isHdr, hdrSettings });
            alert('Einstellungen wurden für alle Zuschauer übernommen!');
        } else {
            alert('Einstellungen gespeichert (Vorschau aktiv). Starte einen Stream, um sie zu übertragen.');
        }
    };

    useEffect(() => {
        localStorage.setItem('guild-manager-mic-id', micId);
    }, [micId]);

    useEffect(() => {
        localStorage.setItem('guild-manager-mic-muted', micMuted.toString());
    }, [micMuted]);

    useEffect(() => {
        storage.set('guild-manager-audio-channels', audioChannels);
    }, [audioChannels]);

    useEffect(() => {
        storage.set('guild-manager-stream-bitrate', defaultBitrate);
    }, [defaultBitrate]);

    useEffect(() => {
        storage.set('guild-manager-stream-optimization', defaultOptimization);
    }, [defaultOptimization]);

    useEffect(() => {
        storage.set('guild-manager-stream-encoder', encoderMode);
    }, [encoderMode]);

    useEffect(() => {
        storage.set('guild-manager-stream-resolution', resolution);
    }, [resolution]);

    useEffect(() => {
        storage.set('guild-manager-stream-fps', fps);
    }, [fps]);

    useEffect(() => {
        storage.set('guild-manager-stream-cpu-preset', cpuPreset);
        if (isStreaming && encoderMode === 'cpu') {
            updateConstraints({ cpuPreset });
        }
    }, [cpuPreset, isStreaming, encoderMode, updateConstraints]);

    useEffect(() => {
        if (isStreaming) {
            updateConstraints({
                bitrate: defaultBitrate,
                optimizationMode: defaultOptimization,
                encoder: encoderMode
            });
        }
    }, [defaultBitrate, defaultOptimization, encoderMode, isStreaming, updateConstraints]);

    useEffect(() => {
        storage.set('stream-privacy-public', isPublic);
    }, [isPublic]);

    useEffect(() => {
        storage.set('stream-privacy-guild-id', privacyGuildId);
    }, [privacyGuildId]);

    useEffect(() => {
        storage.set('stream-privacy-code', joinCode);
    }, [joinCode]);

    useEffect(() => {
        storage.set('stream-privacy-public', isPublic);
    }, [isPublic]);

    useEffect(() => {
        storage.set('stream-privacy-guild-id', privacyGuildId);
    }, [privacyGuildId]);

    useEffect(() => {
        storage.set('stream-privacy-code', joinCode);
    }, [joinCode]);

    useEffect(() => {
        const detectGpu = async () => {
            try {
                if ((window as any).electronAPI?.getGPUInfo) {
                    const info = await (window as any).electronAPI.getGPUInfo();
                    const gpu = info?.gpuDevice?.[0];
                    if (gpu) {
                        const vendorId = gpu.vendorId;
                        let vendor = 'Unbekannt';
                        if (vendorId === 4318 || vendorId === 0x10DE) vendor = 'NVIDIA';
                        else if (vendorId === 4098 || vendorId === 0x1002) vendor = 'AMD';
                        else if (vendorId === 32902 || vendorId === 0x8086) vendor = 'Intel';

                        setGpuName(`${vendor} (${gpu.renderer || 'Generic'})`);
                    } else {
                        setGpuName('Wird erkannt...');
                    }
                } else {
                    setGpuName('Browser (Standard)');
                }
            } catch (e) {
                console.error('GPU Detection failed:', e);
                setGpuName('Hardware-Erkennung n.v.');
            }
        };
        detectGpu();
    }, []);

    const refreshSources = async () => {
        if ((window as any).electronAPI) {
            const src = await (window as any).electronAPI.getSources(['window', 'screen']);

            let cameraSources: any[] = [];
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                cameraSources = devices
                    .filter(d => d.kind === 'videoinput')
                    .map(d => ({
                        id: d.deviceId,
                        name: `📷 ${d.label || 'Kamera ' + d.deviceId.slice(0, 5)}`,
                        type: 'camera'
                    }));
            } catch (err) {
                console.error('[StreamSettings] Failed to fetch cameras:', err);
            }

            const desktopSources = src.map((s: any) => ({
                ...s,
                type: s.id.startsWith('screen') ? 'screen' : 'window'
            }));

            const allSources = [...desktopSources, ...cameraSources];
            setSources(allSources);

            if (allSources.length > 0 && !selectedSource) {
                setSelectedSource(allSources[0].id);
            }
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('Code kopiert!');
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleStartStream = async () => {
        const currentHdr = storage.get('guild-manager-hdr-settings', { brightness: 0.8, contrast: 1.15, saturation: 1.25 });

        const micId = localStorage.getItem('guild-manager-mic-id') || '';
        const micMuted = localStorage.getItem('guild-manager-mic-muted') === 'true';

        const channels: { id: string, muted: boolean }[] = storage.get('guild-manager-audio-channels', [{ id: 'default', muted: false }, { id: '', muted: false }]);

        const userName = user?.battletag ? user.battletag.split('#')[0] : 'Gast';
        const isPublicVal = storage.get('stream-privacy-public', true);
        const privacyGuildIdVal = storage.get('stream-privacy-guild-id', '');
        const streamJoinCode = storage.get('stream-privacy-code', '');

        const metadata = {
            userName: userName,
            title: 'Gaming Session',
            quality: resolution + 'p',
            fps: fps,
            isHdr: window.matchMedia?.('(dynamic-range: high)').matches || false,
            hdrSettings: window.matchMedia?.('(dynamic-range: high)').matches ? currentHdr : null,
            isPublic: isPublic,
            guildId: privacyGuildId ? Number(privacyGuildId) : undefined,
            hasJoinCode: !!joinCode && joinCode.trim().length > 0,
            joinCode: joinCode
        };

        const resMap: Record<string, { w: number, h: number }> = {
            '720': { w: 1280, h: 720 },
            '1080': { w: 1920, h: 1080 },
            '1440': { w: 2560, h: 1440 }
        };

        const currentSource = sources.find((s: any) => s.id === selectedSource);
        const sourceType = currentSource?.type === 'camera' ? 'camera' : 'desktop';

        const constraints = {
            width: resMap[resolution].w,
            height: resMap[resolution].h,
            fps: fps,
            micId: micId,
            micMuted: micMuted,
            audioIds: channels.map(c => c.id),
            mutedAudio: channels.map(c => c.muted),
            sourceType: sourceType,
            bitrate: storage.get('guild-manager-stream-bitrate', 6000),
            optimizationMode: storage.get('guild-manager-stream-optimization', 'motion'),
            encoder: storage.get('guild-manager-stream-encoder', 'gpu'),
            cpuPreset: storage.get('guild-manager-stream-cpu-preset', 'veryfast')
        };

        try {
            await startStream(selectedSource, constraints, metadata);
        } catch (err: any) {
            console.error('[StreamSettings] Start failed:', err);
            alert(`Fehler beim Starten des Streams: ${err.message || 'Unbekannter Fehler'}`);
        }
    };

    useEffect(() => {
        refreshSources();
    }, []);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const filtered = devices.filter(d => d.kind === 'audioinput');
                setAudioSources(filtered);
            } catch (err) {
                console.error('Error fetching devices:', err);
            }
        };
        fetchDevices();
        const interval = setInterval(fetchDevices, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const getHdrFilter = () => {
        const { brightness, contrast, saturation } = hdrSettings;
        return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    };

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '1200px', margin: '0 auto' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '25px', alignItems: 'start' }}>
                {/* LEFT COLUMN: Settings & Audio */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {/* 1. Consolidated Settings: Quality, Encoder & HDR */}
                    <section style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#00aaff' }}>Bildqualität & Übertragung</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setHdrSettings(hdrPresets.subtle)} className="preset-btn">Dezent</button>
                                <button onClick={() => setHdrSettings(hdrPresets.standard)} className="preset-btn">Standard</button>
                                <button onClick={() => setHdrSettings(hdrPresets.vivid)} className="preset-btn">Kräftig</button>
                            </div>
                        </div>

                        {/* HDR Calibration */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                            <div className="setting-group">
                                <label style={{ fontSize: '0.75rem' }}>Helligkeit: {hdrSettings.brightness}</label>
                                <input
                                    type="range" min="0.1" max="2.0" step="0.05"
                                    value={hdrSettings.brightness}
                                    onChange={e => setHdrSettings({ ...hdrSettings, brightness: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label style={{ fontSize: '0.75rem' }}>Kontrast: {hdrSettings.contrast}</label>
                                <input
                                    type="range" min="0.1" max="3.0" step="0.05"
                                    value={hdrSettings.contrast}
                                    onChange={e => setHdrSettings({ ...hdrSettings, contrast: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="setting-group">
                                <label style={{ fontSize: '0.75rem' }}>Sättigung: {hdrSettings.saturation}</label>
                                <input
                                    type="range" min="0.1" max="4.0" step="0.05"
                                    value={hdrSettings.saturation}
                                    onChange={e => setHdrSettings({ ...hdrSettings, saturation: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* Transmission Settings */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="setting-group">
                                <label>Bitrate (kbps): {defaultBitrate}</label>
                                <input
                                    type="range" min="1000" max="15000" step="500"
                                    value={defaultBitrate}
                                    onChange={e => setDefaultBitrate(parseInt(e.target.value))}
                                />
                            </div>
                            <div className="setting-group">
                                <label>Optimierung & Bildschärfe</label>
                                <select
                                    value={defaultOptimization}
                                    onChange={(e) => setDefaultOptimization(e.target.value)}
                                    style={{ background: '#333', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}
                                >
                                    <option value="detail">🎯 Max. Schärfe (Static/Desktop)</option>
                                    <option value="balanced">⚖️ Ausgeglichen (Allround)</option>
                                    <option value="motion">🎬 Flüssige Bewegung (Action/Movies)</option>
                                    <option value="gaming">🎮 Gaming (Priorität FPS)</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ height: '1px', background: '#333' }}></div>

                        {/* Encoder Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="setting-group">
                                <label style={{ fontSize: '0.8rem', color: '#888' }}>Hardware-Encoder</label>
                                <select
                                    value={encoderMode}
                                    onChange={e => setEncoderMode(e.target.value)}
                                    style={{ background: '#333', border: '1px solid #444', color: 'white', padding: '6px', borderRadius: '4px', fontSize: '0.9rem' }}
                                >
                                    <option value="gpu">GPU (Hardware)</option>
                                    <option value="cpu">CPU (Software)</option>
                                </select>
                                <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>Hardware: {gpuName}</p>
                            </div>

                            {encoderMode === 'cpu' && (
                                <div className="setting-group">
                                    <label style={{ fontSize: '0.8rem', color: '#888' }}>CPU Preset</label>
                                    <select
                                        value={cpuPreset}
                                        onChange={e => setCpuPreset(e.target.value)}
                                        style={{ background: '#333', border: '1px solid #444', color: 'white', padding: '6px', borderRadius: '4px', fontSize: '0.9rem' }}
                                    >
                                        <option value="ultrafast">Ultrafast</option>
                                        <option value="superfast">Superfast</option>
                                        <option value="veryfast">Veryfast</option>
                                        <option value="faster">Faster</option>
                                        <option value="fast">Fast</option>
                                        <option value="medium">Medium</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 2. Audio Mixer */}
                    <section style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                        <h2 style={{ fontSize: '1.1rem', marginBottom: '20px', color: '#00aaff' }}>🎙️ Audio-Mixer</h2>

                        <div style={{ background: 'rgba(0, 170, 255, 0.1)', border: '1px solid rgba(0, 170, 255, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', color: '#ccc', lineHeight: '1.4' }}>
                            <strong style={{ color: '#00aaff', display: 'block', marginBottom: '4px' }}>💡 Profi-Tipp: Spiel-Sound übertragen</strong>
                            Wähle <strong>"System-Sound"</strong>, um alles zu übertragen, was du gerade hörst (Spiel, Musik, Windows). Physische Lautsprecher können techn. bedingt nicht direkt ausgewählt werden.
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {/* Microphone */}
                            <div style={{ background: '#252525', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #00ff88' }}>
                                <div style={{ fontSize: '0.75rem', color: '#00ff88', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>Mikrofon</div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <select
                                        value={micId}
                                        onChange={e => setMicId(e.target.value)}
                                        style={{ flex: 1, background: '#1a1a1a', border: '1px solid #444', color: 'white', padding: '5px', borderRadius: '4px', fontSize: '0.85rem' }}
                                    >
                                        <option value="">(Deaktiviert)</option>
                                        {audioSources.map(as => (
                                            <option key={as.deviceId} value={as.deviceId}>{as.label || `Eingang ${as.deviceId.slice(0, 3)}`}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setMicMuted(!micMuted)}
                                        style={{ background: micMuted ? '#cc0000' : '#333', border: '1px solid #444', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        {micMuted ? '🔇' : '🔊'}
                                    </button>
                                </div>
                            </div>

                            {/* Audio Channels */}
                            {audioChannels.map((ch, i) => (
                                <div key={i} style={{ background: '#252525', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #00aaff' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#00aaff', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>Kanal {i + 1}</div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <select
                                            value={ch.id}
                                            onChange={e => {
                                                const n = [...audioChannels];
                                                n[i].id = e.target.value;
                                                setAudioChannels(n);
                                            }}
                                            style={{ flex: 1, background: '#1a1a1a', border: '1px solid #444', color: 'white', padding: '5px', borderRadius: '4px', fontSize: '0.85rem' }}
                                        >
                                            <option value="">(Aus)</option>
                                            <option value="default">System-Sound</option>
                                            {audioSources.map(as => (
                                                <option key={as.deviceId} value={as.deviceId}>
                                                    🎙️ {as.label ? (as.label.length > 25 ? as.label.slice(0, 25) + '...' : as.label) : `Eingang ${as.deviceId.slice(0, 3)}`}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                const n = [...audioChannels];
                                                n[i].muted = !n[i].muted;
                                                setAudioChannels(n);
                                            }}
                                            style={{ background: ch.muted ? '#cc0000' : '#333', border: '1px solid #444', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            {ch.muted ? '🔇' : '🔊'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* RIGHT COLUMN: Live Preview & Steuerung */}
                <section style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Live-Vorschau & Steuerung</h2>
                    <div style={{
                        background: '#000',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        height: '310px', // Adjusted height to prevent scrolling
                        border: '1px solid #333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                    }}>
                        {isStreaming && localStream ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: getHdrFilter() }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '15px', opacity: 0.3 }}>📺</div>
                                <p style={{ fontSize: '0.95rem' }}>Kein Live-Stream aktiv.</p>
                                <p style={{ fontSize: '0.8rem', marginTop: '5px', opacity: 0.6 }}>Konfiguriere deine Quelle und drücke "Stream starten".</p>
                            </div>
                        )}
                        {isStreaming && (
                            <div style={{ position: 'absolute', top: '15px', left: '15px', background: '#cc0000', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                LIVE
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {!isStreaming ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        value={selectedSource || ''}
                                        onChange={(e) => setSelectedSource(e.target.value)}
                                        style={{ flex: 1, background: '#333', border: '1px solid #444', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '0.95rem' }}
                                    >
                                        <optgroup label="Bildschirme">
                                            {sources.filter((s: any) => s.type === 'screen').map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Fenster">
                                            {sources.filter((s: any) => s.type === 'window').map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Kameras">
                                            {sources.filter((s: any) => s.type === 'camera').map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    <button onClick={refreshSources} className="preset-btn" style={{ padding: '0 20px', fontSize: '1rem' }}>🔄</button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="setting-group">
                                        <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={{ background: '#333', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                                            <option value="720">720p (HD)</option>
                                            <option value="1080">1080p (Full HD)</option>
                                            <option value="1440">1440p (QHD)</option>
                                        </select>
                                    </div>
                                    <div className="setting-group">
                                        <select value={fps} onChange={(e) => setFps(Number(e.target.value))} style={{ background: '#333', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                                            <option value="30">30 FPS</option>
                                            <option value="60">60 FPS</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid #333' }}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ flex: 1 }}>
                                            <select
                                                value={isPublic ? 'public' : 'private'}
                                                onChange={e => setIsPublic(e.target.value === 'public')}
                                                style={{ width: '100%', background: '#111', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}
                                            >
                                                <option value="public">🌐 Öffentlich</option>
                                                <option value="private">🛡️ Gilden-intern</option>
                                            </select>
                                        </div>
                                        {!isPublic && (
                                            <div style={{ flex: 1 }}>
                                                <select
                                                    value={privacyGuildId}
                                                    onChange={e => setPrivacyGuildId(e.target.value)}
                                                    style={{ width: '100%', background: '#111', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}
                                                >
                                                    <option value="">(Alle Gilden)</option>
                                                    {guilds.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '5px' }}>Beitritts-Code (optional)</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="Code vergeben..."
                                                value={joinCode}
                                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                                style={{ flex: 1, background: '#111', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', width: '0', minWidth: '0' }}
                                            />
                                            <button
                                                onClick={() => setJoinCode(generateRandomCode())}
                                                className="preset-btn"
                                                title="Code neu generieren"
                                                style={{ padding: '0 12px' }}
                                            >
                                                🔄
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(joinCode)}
                                                className="preset-btn"
                                                title="Code kopieren"
                                                style={{ padding: '0 12px' }}
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleStartStream}
                                    disabled={!selectedSource || isConnecting}
                                    style={{
                                        width: '100%',
                                        background: isConnecting ? '#333' : '#00aaff',
                                        color: 'white',
                                        border: 'none',
                                        padding: '16px',
                                        borderRadius: '10px',
                                        fontWeight: 'bold',
                                        cursor: isConnecting ? 'default' : 'pointer',
                                        boxShadow: '0 4px 15px rgba(0, 170, 255, 0.3)',
                                        transition: 'all 0.2s',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    {isConnecting ? 'Verbinde...' : 'Start Broadcasting'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {joinCode && (
                                    <div style={{
                                        background: 'rgba(0, 170, 255, 0.1)',
                                        border: '1px solid #00aaff',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <label style={{ fontSize: '0.75rem', color: '#00aaff', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            Aktueller Beitritts-Code
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <code style={{
                                                fontSize: '1.2rem',
                                                fontWeight: 'bold',
                                                letterSpacing: '2px',
                                                background: 'rgba(0,0,0,0.3)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontFamily: 'monospace'
                                            }}>
                                                {joinCode}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(joinCode)}
                                                className="preset-btn"
                                                title="Code kopieren"
                                                style={{ padding: '6px 12px' }}
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={stopStream}
                                    style={{
                                        width: '100%',
                                        background: '#cc0000',
                                        color: 'white',
                                        border: 'none',
                                        padding: '16px',
                                        borderRadius: '10px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(204, 0, 0, 0.3)',
                                        transition: 'all 0.2s',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    Übertragung beenden
                                </button>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleApplySettings}
                                style={{
                                    flex: 1,
                                    background: 'rgba(0, 170, 255, 0.1)',
                                    border: '1px solid #00aaff',
                                    color: '#00aaff',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {isStreaming ? '🚀 Live anwenden' : '💾 Für später speichern'}
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <style>{`
        .preset-btn {
          background: #333;
          border: 1px solid #555;
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-btn:hover {
          background: #444;
          border-color: #00aaff;
        }
        .setting-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .setting-group label {
          font-size: 0.85rem;
          color: #aaa;
        }
        .setting-group input[type=range] {
          accent-color: #00aaff;
          cursor: pointer;
        }
      `}</style>
        </div >
    );
}
