import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';

export default function StreamSettings() {
    const { localStream, isStreaming, updateMetadata } = useWebRTC();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const [hdrSettings, setHdrSettings] = useState(() => {
        const saved = localStorage.getItem('guild-manager-hdr-settings');
        return saved ? JSON.parse(saved) : {
            brightness: 0.8,
            contrast: 1.15,
            saturation: 1.25
        };
    });

    const [audioSources, setAudioSources] = useState<MediaDeviceInfo[]>([]);

    // New Audio Structure
    const [micId, setMicId] = useState(() => localStorage.getItem('guild-manager-mic-id') || '');
    const [micMuted, setMicMuted] = useState(() => localStorage.getItem('guild-manager-mic-muted') === 'true');

    const [audioChannels, setAudioChannels] = useState<{ id: string, muted: boolean }[]>(() => {
        const saved = localStorage.getItem('guild-manager-audio-channels');
        return saved ? JSON.parse(saved) : [{ id: '', muted: false }, { id: '', muted: false }];
    });

    const hdrPresets = {
        subtle: { brightness: 0.9, contrast: 1.1, saturation: 1.1 },
        standard: { brightness: 0.8, contrast: 1.15, saturation: 1.25 },
        vivid: { brightness: 0.8, contrast: 1.3, saturation: 1.5 },
        min: { brightness: 0.5, contrast: 0.5, saturation: 0.5 }
    };

    useEffect(() => {
        localStorage.setItem('guild-manager-hdr-settings', JSON.stringify(hdrSettings));
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
        localStorage.setItem('guild-manager-audio-channels', JSON.stringify(audioChannels));
    }, [audioChannels]);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const filtered = devices.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput');
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
        <div style={{ padding: '20px', color: 'white', maxWidth: '1000px', display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
            <div className="settings-main">
                <h1 style={{ marginBottom: '20px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#00aaff' }}>⚙️</span> Stream Einstellungen
                </h1>

                <section style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>HDR & Bild-Kalibrierung</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setHdrSettings(hdrPresets.subtle)} className="preset-btn">Dezent</button>
                            <button onClick={() => setHdrSettings(hdrPresets.standard)} className="preset-btn">Standard</button>
                            <button onClick={() => setHdrSettings(hdrPresets.vivid)} className="preset-btn">Kräftig</button>
                            <button onClick={() => setHdrSettings(hdrPresets.min)} className="preset-btn">Minimal</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                        <div className="setting-group">
                            <label>Helligkeit: {hdrSettings.brightness}</label>
                            <input
                                type="range" min="0.1" max="2.0" step="0.05"
                                value={hdrSettings.brightness}
                                onChange={e => setHdrSettings({ ...hdrSettings, brightness: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="setting-group">
                            <label>Kontrast: {hdrSettings.contrast}</label>
                            <input
                                type="range" min="0.1" max="3.0" step="0.05"
                                value={hdrSettings.contrast}
                                onChange={e => setHdrSettings({ ...hdrSettings, contrast: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="setting-group">
                            <label>Sättigung: {hdrSettings.saturation}</label>
                            <input
                                type="range" min="0.1" max="4.0" step="0.05"
                                value={hdrSettings.saturation}
                                onChange={e => setHdrSettings({ ...hdrSettings, saturation: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
                </section>

                <section style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '20px' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Audio-Mixer</h2>

                    <div style={{ display: 'grid', gap: '15px' }}>
                        {/* Microphone Section */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#252525', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #00ff88' }}>
                            <div style={{ width: '100px', fontSize: '0.8rem', color: '#00ff88', fontWeight: 'bold' }}>🎙️ Mikrofon</div>
                            <select
                                value={micId}
                                onChange={e => setMicId(e.target.value)}
                                style={{ flex: 1, background: '#333', border: '1px solid #444', color: 'white', padding: '6px', borderRadius: '4px' }}
                            >
                                <option value="">(Deaktiviert)</option>
                                {audioSources.filter(as => as.kind === 'audioinput').map(as => (
                                    <option key={as.deviceId} value={as.deviceId}>{as.label || `Eingang ${as.deviceId.slice(0, 5)}`}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setMicMuted(!micMuted)}
                                style={{
                                    background: micMuted ? '#cc0000' : '#333',
                                    border: '1px solid #444',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                {micMuted ? '🔇' : '🔊'}
                            </button>
                        </div>

                        {/* Audio Channels */}
                        {audioChannels.map((ch, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#252525', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ width: '100px', fontSize: '0.8rem', color: '#00aaff', fontWeight: 'bold' }}>🔊 Audio {i + 1}</div>
                                <select
                                    value={ch.id}
                                    onChange={e => {
                                        const n = [...audioChannels];
                                        n[i].id = e.target.value;
                                        setAudioChannels(n);
                                    }}
                                    style={{ flex: 1, background: '#333', border: '1px solid #444', color: 'white', padding: '6px', borderRadius: '4px' }}
                                >
                                    <option value="">(Deaktiviert)</option>
                                    <option value="default">System-Sound (Desktop)</option>
                                    {audioSources.map(as => (
                                        <option key={as.deviceId} value={as.deviceId}>
                                            {as.kind === 'audiooutput' ? '🔈 [Ausgabe] ' : '🎙️ [Eingabe] '}
                                            {as.label || `Gerät ${as.deviceId.slice(0, 5)}`}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => {
                                        const n = [...audioChannels];
                                        n[i].muted = !n[i].muted;
                                        setAudioChannels(n);
                                    }}
                                    style={{
                                        background: ch.muted ? '#cc0000' : '#333',
                                        border: '1px solid #444',
                                        color: 'white',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {ch.muted ? '🔇' : '🔊'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <aside className="settings-preview" style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>Live-Vorschau</h2>
                <div style={{
                    background: '#000',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    border: '2px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
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
                            <p>Starte einen Stream, um hier eine Live-Vorschau deiner HDR-Kalibrierung zu sehen.</p>
                        </div>
                    )}
                    {isStreaming && (
                        <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#cc0000', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            LIVE PREVIEW
                        </div>
                    )}
                </div>

                <button
                    onClick={handleApplySettings}
                    style={{
                        width: '100%',
                        marginTop: '15px',
                        background: '#00aaff',
                        color: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(0, 170, 255, 0.2)'
                    }}
                >
                    {isStreaming ? '🚀 Einstellungen jetzt für Zuschauer übernehmen' : '💾 Einstellungen speichern'}
                </button>

                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '15px', fontStyle: 'italic' }}>
                    Hinweis: Deine Änderungen werden in Echtzeit auf das Vorschaubild angewendet. Zuschauer sehen die Änderung ebenfalls live.
                </p>
            </aside>

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
          gap: 8px;
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
        </div>
    );
}
