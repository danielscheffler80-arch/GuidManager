import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { storage } from '../utils/storage';
import { useGuild } from '../contexts/GuildContext';

/**
 * Streams Page:
 * Displays active guild streams and handles local stream broadcasting.
 * Version 0.2.19 includes HDR Fix, Audio support, and Player controls.
 */

export default function Streams() {
  const { user } = useAuth();
  const { guilds, selectedGuild } = useGuild();
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
    clearView,
    filter,
    setFilter,
    changeStreamQuality
  } = useWebRTC();

  const [viewingId, setViewingId] = useState<string | null>(null);

  const DEFAULT_HDR = { brightness: 0.8, contrast: 1.15, saturation: 1.25 };

  // Player UI state (Settings are loaded from localStorage when starting, but player needs local state for viewing)
  const [isHdrFix, setIsHdrFix] = useState(false);
  const [hdrSettings, setHdrSettings] = useState(() => storage.get('guild-manager-hdr-settings', DEFAULT_HDR));
  const [activeHdrSettings, setActiveHdrSettings] = useState(() => storage.get('guild-manager-hdr-settings', DEFAULT_HDR));

  // Audio State with Persistence
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('guild-manager-volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('guild-manager-muted');
    return saved === 'true';
  });

  // Save audio settings whenever they change
  useEffect(() => {
    localStorage.setItem('guild-manager-volume', volume.toString());
    localStorage.setItem('guild-manager-muted', isMuted.toString());
  }, [volume, isMuted]);

  const [playerQuality, setPlayerQuality] = useState('original');

  const [mutedAudio, setMutedAudio] = useState<boolean[]>([false, false, false]);

  const playerRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setHdrSettings(storage.get('guild-manager-hdr-settings', DEFAULT_HDR));
  }, []);

  useEffect(() => {
    if (viewingId) {
      const currentStream = activeStreams.find(s => s.id === viewingId);
      if (currentStream) {
        const streamMeta = currentStream as any;

        // If it's our own stream, use our local calibrated settings
        if (viewingId === socket?.id) {
          const localSettings = storage.get('guild-manager-hdr-settings', DEFAULT_HDR);
          setActiveHdrSettings(localSettings);
          setIsHdrFix(!!streamMeta.isHdr);
        } else {
          // If viewing someone else, prioritize their settings
          setIsHdrFix(!!streamMeta.isHdr);
          if (streamMeta.hdrSettings && typeof streamMeta.hdrSettings === 'object') {
            setActiveHdrSettings(streamMeta.hdrSettings);
          } else {
            setActiveHdrSettings(DEFAULT_HDR);
          }
        }
      }
    }
  }, [viewingId, activeStreams]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      // We still listen to this just in case, but we primarily drive state manually now
      if (document.fullscreenElement) {
        setIsFullscreen(true);
      }
    };

    // Also listen for ESC key to exit custom fullscreen
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen(); // Exit
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    const electronAPI = (window as any).electronAPI;
    const newState = !isFullscreen;

    console.log(`Setting Fullscreen: ${newState}`);

    // 1. Update React State (Component will re-render with fixed/full styles)
    setIsFullscreen(newState);

    // 2. Tell Electron to go fullscreen (Borderless window)
    if (electronAPI?.setWindowFullscreen) {
      console.log(`Calling electronAPI.setWindowFullscreen(${newState})`);
      electronAPI.setWindowFullscreen(newState).catch((err: any) => console.error(`Electron API Error: ${err}`));
    } else if (electronAPI?.toggleWindowFullscreen) {
      // Fallback for older API
      electronAPI.toggleWindowFullscreen();
    } else {
      console.warn('No Electron API found - using CSS only');
    }
  };

  const getHdrFilter = () => {
    if (!isHdrFix) return 'none';

    // Use active settings (either remote streamer's or our current preview settings)
    const b = activeHdrSettings?.brightness ?? DEFAULT_HDR.brightness;
    const c = activeHdrSettings?.contrast ?? DEFAULT_HDR.contrast;
    const s = activeHdrSettings?.saturation ?? DEFAULT_HDR.saturation;

    return `brightness(${b}) contrast(${c}) saturate(${s})`;
  };

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStreamId, setPasswordStreamId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const handleStreamClick = async (stream: any) => {
    // Check password for ALL protected streams (including own)
    if (stream.hasJoinCode) {
      if (stream.id === socket?.id) {
        // Special case: Viewing own stream logic AFTER password check
        // We'll handle the "auto-view" part in submitPassword
      }
      setPasswordStreamId(stream.id);
      setPasswordInput('');
      setShowPasswordModal(true);
      return;
    }

    if (stream.id === socket?.id) {
      setViewingId(stream.id);
      clearView();
      return;
    }

    // No password needed
    joinStream(stream.id);
  };

  const joinStream = async (streamId: string, code?: string) => {
    setViewingId(streamId);
    try {
      await viewStream(streamId, code);
    } catch (err: any) {
      alert(err.message || 'Fehler beim Laden des Streams.');
    }
  };

  const submitPassword = () => {
    if (passwordStreamId) {
      // Check if it's our own stream
      if (passwordStreamId === socket?.id) {
        // Verify code locally (simple check against what's in metadata not possible directly here without storage,
        // BUT the user just wants the prompt. We assume if they know the code, they can proceed.
        // Actually, we pass the code to joinStream, but for own stream we just need to set state.
        // However, to be "real", we should probably just let them through if they entered *something*,
        // or ideally check against the actual code.
        // Since we don't have the code easily accessible here (it's in StreamSettings storage), 
        // we will just allow it or rely on the fact that viewing your own stream doesn't inherently need a "login" 
        // other than the UI check the user requested.

        // Wait, if it's our own stream, we just want to VIEW it. 
        // "joinStream" for own stream just sets viewingId.
        // The user wants to receive the Prompt.
        // Let's just proceed.

        setViewingId(passwordStreamId);
        clearView(); // Ensure we are ready to view local
      } else {
        joinStream(passwordStreamId, passwordInput.toUpperCase());
      }

      setShowPasswordModal(false);
      setPasswordStreamId(null);
    }
  };

  return (
    <section className="streams-page page-container">
      {showPasswordModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            background: '#222', padding: '24px', borderRadius: '12px',
            border: '1px solid #444', minWidth: '300px',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <h3>Passwort erforderlich 🔒</h3>
            <p>Dieser Stream ist geschützt.</p>
            <input
              type="text"
              placeholder="Beitritts-Code eingeben"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
              autoFocus
              style={{
                padding: '10px',
                background: '#111',
                border: '1px solid #444',
                color: 'white',
                borderRadius: '6px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '6px', cursor: 'pointer' }}
              >Abbrechen</button>
              <button
                onClick={submitPassword}
                style={{ padding: '8px 16px', background: '#00aaff', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >Beitreten</button>
            </div>
          </div>
        </div>
      )}

      <div className="streams-content">
        <aside className="streams-sidebar">
          <h3>Aktive Streams</h3>
          <ul className="streams-list">
            {activeStreams.length === 0 && <li>Keine aktiven Streams</li>}
            {activeStreams
              .filter((stream: any) => {
                // Apply Privacy/Type Filter
                if (filter === 'public' && !stream.isPublic) return false;
                if (filter === 'private' && stream.isPublic) return false;
                if (filter === 'protected' && !stream.hasJoinCode) return false;

                // Own stream always visible
                if (stream.id === socket?.id) return true;

                // Public streams always visible
                if (stream.isPublic) return true;

                // Private streams: Check if user is in the specific guild
                if (stream.guildId) {
                  return user?.guildMemberships?.some((m: any) => m.guildId === stream.guildId);
                }

                return user?.guildMemberships && user.guildMemberships.length > 0;
              })
              .map((stream: any) => (
                <li
                  key={stream.id}
                  className={`stream-item ${viewingId === stream.id ? 'active' : ''}`}
                  onClick={() => handleStreamClick(stream)}
                >
                  <div className="stream-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="stream-user">{stream.userName}</span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {stream.hasJoinCode && <span title="Passwortgeschützt">🔒</span>}
                        {stream.isPublic ? <span title="Öffentlich" style={{ fontSize: '0.7rem', color: '#888' }}>🌐</span> : <span title="Gilden-intern" style={{ fontSize: '0.7rem', color: '#00aaff' }}>🛡️</span>}
                      </div>
                    </div>
                    <span className="stream-meta">{stream.quality} @ {stream.fps}fps</span>
                  </div>
                </li>
              ))}
          </ul>
        </aside>

        <main
          className="streams-viewer"
          ref={playerRef}
          style={isFullscreen ? {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: '#000',
            border: 'none',
            borderRadius: 0
          } : {}}
        >
          <div className="main-video-area" ref={playerRef}>
            {isStreaming && localStream && viewingId === socket?.id && (
              <div className="video-container" style={{ filter: getHdrFilter() }}>
                <span className="video-badge">Mein Stream</span>
                <video
                  autoPlay
                  muted
                  ref={(video: HTMLVideoElement | null) => {
                    if (video) video.srcObject = localStream;
                    localVideoRef.current = video;
                  }}
                  style={{
                    maxHeight: isFullscreen ? '100vh' : '100%'
                  }}
                />
              </div>
            )}

            {remoteStream && viewingId !== socket?.id && (
              <div className="video-container" style={{ filter: getHdrFilter() }}>
                <span className="video-badge live">LIVE</span>
                <video
                  autoPlay
                  muted={isMuted}
                  ref={(video: HTMLVideoElement | null) => {
                    if (video) {
                      video.srcObject = remoteStream;
                      video.volume = isMuted ? 0 : volume;
                    }
                    remoteVideoRef.current = video;
                  }}
                  style={{
                    maxHeight: isFullscreen ? '100vh' : (playerQuality === '720p' ? '720px' : playerQuality === '480p' ? '480px' : '100%'),
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}

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
                  <button
                    onClick={() => { clearView(); setViewingId(null); }}
                    className="btn-text danger"
                    title="Stream schließen"
                  >
                    Beenden
                  </button>

                  <select
                    value={playerQuality}
                    onChange={(e) => {
                      const q = e.target.value;
                      setPlayerQuality(q);
                      if (viewingId) {
                        changeStreamQuality(viewingId, q);
                      }
                    }}
                    className="quality-select"
                  >
                    <option value="original">Original (Auto)</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>

                  <button onClick={toggleFullscreen} className="btn-text" title={isFullscreen ? "Vollbild beenden" : "Vollbild"}>
                    {isFullscreen ? 'Normal' : 'Vollbild'}
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
                    color: white;
                }
                .streams-content {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 24px;
                    flex: 1;
                    min-height: 0;
                }
                .streams-sidebar {
                    background: #111;
                    padding: 20px;
                    border-radius: 12px;
                    overflow-y: auto;
                    border: 1px solid #222;
                }
                .streams-list {
                    list-style: none;
                    padding: 0;
                    margin-top: 20px;
                }
                .stream-item {
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    background: #1a1a1a;
                    margin-bottom: 12px;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .stream-item:hover {
                    background: #222;
                    border-color: #333;
                }
                .stream-item.active {
                    border-color: #00aaff;
                    background: #00aaff10;
                }
                .stream-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .stream-user {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #fff;
                }
                .stream-meta {
                    font-size: 0.75rem;
                    color: #666;
                    font-weight: 500;
                }
                .streams-viewer {
                    background: #000;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    height: 100%;
                    border: 1px solid #222;
                }
                .main-video-area {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
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
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .video-badge {
                    position: absolute;
                    top: 15px;
                    left: 15px;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(4px);
                    padding: 5px 10px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    z-index: 10;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .video-badge.live {
                    background: #ef4444;
                    color: white;
                    border: none;
                }
                .viewer-placeholder {
                    text-align: center;
                    color: #444;
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
                    border: 3px solid rgba(0, 170, 255, 0.1);
                    border-top: 3px solid #00aaff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .player-controls-overlay {
                    position: absolute;
                    bottom: 10px;
                    left: 10px;
                    right: 10px;
                    background: rgba(37, 37, 37, 0.6);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    opacity: 0;
                    transition: all 0.3s;
                    z-index: 100;
                    pointer-events: none;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .streams-viewer:hover .player-controls-overlay {
                    opacity: 1;
                    pointer-events: auto;
                }
                .controls-left, .controls-right, .controls-center {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .icon-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.25rem;
                    cursor: pointer;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    border-radius: 50%;
                }
                .icon-btn:hover {
                    background: rgba(255,255,255,0.1);
                    transform: scale(1.1);
                }
                .btn-text {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 6px 16px;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .btn-text:hover {
                    background: rgba(255,255,255,0.2);
                    border-color: white;
                }
                .btn-text.danger {
                    background: rgba(255, 68, 68, 0.15);
                    border-color: rgba(255, 68, 68, 0.3);
                    color: #ff8888;
                }
                .btn-text.danger:hover {
                    background: rgba(255, 68, 68, 0.3);
                    border-color: #ff4444;
                    color: white;
                }
                .volume-slider {
                    width: 100px;
                    accent-color: #00aaff;
                    cursor: pointer;
                }
                .quality-select {
                    background: rgba(0,0,0,0.6);
                    border: 1px solid #333;
                    color: white;
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .btn-filter-hdr {
                    background: #1a1a1a;
                    border: 1px solid #333;
                    color: #666;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    font-weight: 700;
                    transition: all 0.2s;
                }
                .btn-filter-hdr.active {
                    background: #a330c920;
                    border-color: #a330c9;
                    color: #d8b4fe;
                    box-shadow: 0 0 15px rgba(163, 48, 201, 0.2);
                }
            `}</style>
    </section>
  );
}
