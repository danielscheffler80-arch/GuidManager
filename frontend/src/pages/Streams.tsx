import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';

/**
 * Streams Page:
 * Displays active guild streams and handles local stream broadcasting.
 * Version 0.2.19 includes HDR Fix, Audio support, and Player controls.
 */

export default function Streams() {
  const {
    activeStreams,
    isStreaming,
    isConnecting,
    localStream,
    remoteStream,
    socket,
    startStream,
    stopStream,
    viewStream,
    clearView
  } = useWebRTC();

  const [sources, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [resolution, setResolution] = useState(() => {
    const height = window.screen.height;
    if (height >= 1440) return '1440';
    if (height >= 1080) return '1080';
    return '720';
  });
  const [fps, setFps] = useState(60);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Player UI state (Settings are loaded from localStorage when starting, but player needs local state for viewing)
  const [isHdrFix, setIsHdrFix] = useState(false);
  const [hdrSettings, setHdrSettings] = useState({ brightness: 0.8, contrast: 1.15, saturation: 1.25 });
  const [activeHdrSettings, setActiveHdrSettings] = useState({ brightness: 0.8, contrast: 1.15, saturation: 1.25 });
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playerQuality, setPlayerQuality] = useState('original');

  const [mutedAudio, setMutedAudio] = useState<boolean[]>([false, false, false]);

  const playerRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const refreshSources = async () => {
    if (window.electronAPI) {
      const src = await window.electronAPI.getSources(['window', 'screen']);
      setSources(src);
      if (src.length > 0 && !selectedSource) {
        setSelectedSource(src[0].id);
      }
    }
  };

  useEffect(() => {
    refreshSources();
    const savedHdr = localStorage.getItem('guild-manager-hdr-settings');
    if (savedHdr) setHdrSettings(JSON.parse(savedHdr));
  }, []);

  const { user } = useAuth();
  const handleStartStream = async () => {
    // Load latest settings from localStorage
    const savedHdr = localStorage.getItem('guild-manager-hdr-settings');
    const currentHdr = savedHdr ? JSON.parse(savedHdr) : { brightness: 0.8, contrast: 1.15, saturation: 1.25 };

    const micId = localStorage.getItem('guild-manager-mic-id') || '';
    const micMuted = localStorage.getItem('guild-manager-mic-muted') === 'true';

    const savedChannels = localStorage.getItem('guild-manager-audio-channels');
    const channels: { id: string, muted: boolean }[] = savedChannels ? JSON.parse(savedChannels) : [{ id: 'default', muted: false }, { id: '', muted: false }];

    const userName = user?.battletag ? user.battletag.split('#')[0] : 'Gast';
    const metadata = {
      userName: userName,
      title: 'Gaming Session',
      quality: resolution + 'p',
      fps: fps,
      isHdr: window.matchMedia?.('(dynamic-range: high)').matches || false,
      hdrSettings: window.matchMedia?.('(dynamic-range: high)').matches ? currentHdr : null
    };

    const resMap: Record<string, { w: number, h: number }> = {
      '720': { w: 1280, h: 720 },
      '1080': { w: 1920, h: 1080 },
      '1440': { w: 2560, h: 1440 }
    };

    const constraints = {
      width: resMap[resolution].w,
      height: resMap[resolution].h,
      fps: fps,
      micId: micId,
      micMuted: micMuted,
      audioIds: channels.map(c => c.id),
      mutedAudio: channels.map(c => c.muted)
    };

    try {
      await startStream(selectedSource, constraints, metadata);
      setViewingId(socket?.id || null);
      setIsHdrFix(metadata.isHdr);
      if (metadata.hdrSettings) {
        setHdrSettings(metadata.hdrSettings);
        setActiveHdrSettings(metadata.hdrSettings);
      }
    } catch (err: any) {
      console.error('[Streams] Start failed:', err);
      alert(`Fehler beim Starten des Streams: ${err.message || 'Unbekannter Fehler'}`);
    }
  };

  useEffect(() => {
    if (viewingId) {
      const currentStream = activeStreams.find(s => s.id === viewingId);
      if (currentStream) {
        const streamMeta = currentStream as any;

        // If it's our own stream, use our local calibrated settings
        if (viewingId === socket?.id) {
          const savedHdr = localStorage.getItem('guild-manager-hdr-settings');
          const localSettings = savedHdr ? JSON.parse(savedHdr) : hdrSettings;
          setActiveHdrSettings(localSettings);
          setIsHdrFix(!!streamMeta.isHdr);
        } else {
          // If viewing someone else, prioritize their settings
          setIsHdrFix(!!streamMeta.isHdr);
          if (streamMeta.hdrSettings) {
            setActiveHdrSettings(streamMeta.hdrSettings);
          }
        }
      }
    }
  }, [viewingId, activeStreams]);

  const toggleFullscreen = () => {
    if (playerRef.current) {
      if (!document.fullscreenElement) {
        playerRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const getHdrFilter = () => {
    if (!isHdrFix) return 'none';

    // Use active settings (either remote streamer's or our current preview settings)
    const b = activeHdrSettings.brightness;
    const c = activeHdrSettings.contrast;
    const s = activeHdrSettings.saturation;

    return `brightness(${b}) contrast(${c}) saturate(${s})`;
  };

  return (
    <section className="streams-page page-container">
      <header className="streams-header">
        <h1>Live Streams</h1>
        <div className="stream-controls">
          {!isStreaming ? (
            <div className="start-stream-form">
              <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                <option value="720">720p</option>
                <option value="1080">1080p</option>
                <option value="1440">1440p</option>
              </select>
              <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
              <button onClick={handleStartStream} className="btn-primary">Stream starten</button>
              <button onClick={refreshSources} className="btn-secondary">🔄</button>
            </div>
          ) : (
            <button onClick={stopStream} className="btn-danger">Stream stoppen</button>
          )}
        </div>
      </header>


      <div className="streams-content">
        <aside className="streams-sidebar">
          <h3>Aktive Streams</h3>
          <ul className="streams-list">
            {activeStreams.length === 0 && <li>Keine aktiven Streams</li>}
            {activeStreams.map(stream => (
              <li
                key={stream.id}
                className={`stream-item ${viewingId === stream.id ? 'active' : ''}`}
                onClick={() => {
                  setViewingId(stream.id);
                  if (stream.id !== socket?.id) {
                    viewStream(stream.id);
                  } else {
                    clearView();
                  }
                }}
              >
                <div className="stream-info">
                  <span className="stream-user">{stream.userName}</span>
                  <span className="stream-meta">{stream.quality} @ {stream.fps}fps</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="streams-viewer" ref={playerRef}>
          {/* Large Main View */}
          <div className="main-video-area">
            {/* Show local stream ONLY if explicitly selected */}
            {isStreaming && localStream && viewingId === socket?.id && (
              <div className="video-container" style={{ filter: getHdrFilter() }}>
                <span className="video-badge">Mein Stream</span>
                <video
                  autoPlay
                  muted
                  ref={video => {
                    if (video) video.srcObject = localStream;
                    localVideoRef.current = video;
                  }}
                />
              </div>
            )}

            {/* Show remote stream if a DIFFERENT stream is selected */}
            {remoteStream && viewingId !== socket?.id && (
              <div className="video-container" style={{ filter: getHdrFilter() }}>
                <span className="video-badge live">LIVE</span>
                <video
                  autoPlay
                  muted={isMuted}
                  ref={video => {
                    if (video) {
                      console.log('[Streams] Setting remoteVideo srcObject:', remoteStream?.id);
                      video.srcObject = remoteStream;
                      video.volume = isMuted ? 0 : volume;
                    }
                    remoteVideoRef.current = video;
                  }}
                  style={{
                    maxHeight: playerQuality === '720p' ? '720px' : playerQuality === '480p' ? '480px' : '100%'
                  }}
                />
              </div>
            )}

            {/* Placeholder if nothing or something inactive is selected */}
            {(!viewingId || (viewingId === socket?.id && !isStreaming) || (viewingId !== socket?.id && !remoteStream)) && (
              <div className="viewer-placeholder">
                {isConnecting ? (
                  <div className="connecting-spinner">
                    <div className="spinner"></div>
                    <p>Verbindung wird aufgebaut...</p>
                  </div>
                ) : (
                  <p>Wähle einen Stream aus der Liste oder starte deine eigene Übertragung.</p>
                )}
              </div>
            )}

            {/* Player Overlay Controls */}
            {(remoteStream || (isStreaming && viewingId === socket?.id)) && (
              <div className="player-controls-overlay">
                <div className="controls-left">
                  <button onClick={() => setIsMuted(!isMuted)} className="icon-btn">
                    {isMuted || volume === 0 ? '🔇' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (v > 0) setIsMuted(false);
                    }}
                    className="volume-slider"
                  />
                </div>

                <div className="controls-center">
                  <button
                    onClick={() => setIsHdrFix(!isHdrFix)}
                    className={`btn-filter ${isHdrFix ? 'active' : ''}`}
                    title="Korrigiert Überbelichtung bei HDR-Inhalten"
                  >
                    HDR Fix: {isHdrFix ? 'AN' : 'AUS'}
                  </button>
                </div>

                <div className="controls-right">
                  <select
                    value={playerQuality}
                    onChange={(e) => setPlayerQuality(e.target.value)}
                    className="quality-select"
                  >
                    <option value="original">Original</option>
                    <option value="720p">720p (Skaliert)</option>
                    <option value="480p">480p (Skaliert)</option>
                  </select>
                  <button onClick={toggleFullscreen} className="icon-btn" title="Vollbild">
                    🔲
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
                .streams-page {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    gap: 20px;
                    color: white;
                }
                .streams-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid #333;
                }
                .start-stream-form {
                    display: flex;
                    gap: 10px;
                }
                .streams-content {
                    display: grid;
                    grid-template-columns: 250px 1fr;
                    gap: 20px;
                    flex: 1;
                    min-height: 0;
                }
                .streams-sidebar {
                    background: #1a1a1a;
                    padding: 15px;
                    border-radius: 8px;
                    overflow-y: auto;
                }
                .streams-list {
                    list-style: none;
                    padding: 0;
                    margin-top: 15px;
                }
                .stream-item {
                    padding: 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    background: #2a2a2a;
                    margin-bottom: 10px;
                    transition: background 0.2s;
                }
                .stream-item:hover {
                    background: #3a3a3a;
                }
                .stream-item.active {
                    border: 1px solid #00aaff;
                    background: #253340;
                }
                .stream-info {
                    display: flex;
                    flex-direction: column;
                }
                .stream-user {
                    font-weight: bold;
                }
                .stream-meta {
                    font-size: 0.8rem;
                    color: #aaa;
                }
                .streams-viewer {
                    background: #000;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    height: 100%;
                }
                .main-video-area {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .pip-container {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    width: 240px;
                    aspect-ratio: 16/9;
                    background: #000;
                    border: 2px solid #00aaff;
                    border-radius: 8px;
                    z-index: 100;
                    overflow: hidden;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                }
                .pip-label {
                    position: absolute;
                    top: 5px;
                    left: 5px;
                    font-size: 0.6rem;
                    background: rgba(0,0,0,0.7);
                    padding: 2px 5px;
                    border-radius: 3px;
                }
                .video-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                video {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .video-badge {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: rgba(0,0,0,0.6);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    z-index: 10;
                }
                .video-badge.live {
                    background: #cc0000;
                    color: white;
                }
                .viewer-placeholder {
                    text-align: center;
                    color: #666;
                }
                .connecting-spinner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(0, 170, 255, 0.1);
                    border-top: 4px solid #00aaff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* New Player Controls Styles */
                .player-controls-overlay {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0,0,0,0.8));
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    opacity: 0;
                    transition: opacity 0.3s;
                    z-index: 100;
                }
                .streams-viewer:hover .player-controls-overlay {
                    opacity: 1;
                }
                .controls-left, .controls-right, .controls-center {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .icon-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.1s;
                }
                .icon-btn:hover {
                    transform: scale(1.1);
                }
                .volume-slider {
                    width: 80px;
                    accent-color: #00aaff;
                    cursor: pointer;
                }
                .quality-select {
                    background: rgba(0,0,0,0.5);
                    border: 1px solid #444;
                    color: white;
                    border-radius: 4px;
                    padding: 2px 5px;
                    font-size: 0.8rem;
                }
                .btn-filter {
                    background: #333;
                    border: 1px solid #555;
                    color: #aaa;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                .btn-filter.active {
                    background: #0088cc;
                    border-color: #00aaff;
                    color: white;
                    box-shadow: 0 0 10px rgba(0, 170, 255, 0.3);
                }

                 .btn-primary { background: #00aaff; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; }
                .btn-secondary { background: #444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
                .btn-danger { background: #ff4444; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; }
                select { background: #333; color: white; border: 1px solid #444; padding: 5px; border-radius: 4px; }
            `}</style>
    </section>
  );
}
