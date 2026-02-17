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
    setFilter
  } = useWebRTC();

  const [viewingId, setViewingId] = useState<string | null>(null);

  const DEFAULT_HDR = { brightness: 0.8, contrast: 1.15, saturation: 1.25 };

  // Player UI state (Settings are loaded from localStorage when starting, but player needs local state for viewing)
  const [isHdrFix, setIsHdrFix] = useState(false);
  const [hdrSettings, setHdrSettings] = useState(() => storage.get('guild-manager-hdr-settings', DEFAULT_HDR));
  const [activeHdrSettings, setActiveHdrSettings] = useState(() => storage.get('guild-manager-hdr-settings', DEFAULT_HDR));
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
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

  const toggleFullscreen = async () => {
    // If we're in Electron, we can use the native fullscreen mode for the whole window
    // This is often more reliable than DOM fullscreen when hardware acceleration is off.
    if ((window as any).electronAPI?.toggleWindowFullscreen) {
      try {
        await (window as any).electronAPI.toggleWindowFullscreen();
        return;
      } catch (err) {
        console.error('[Streams] Native fullscreen failed, falling back to DOM:', err);
      }
    }

    if (playerRef.current) {
      try {
        if (!document.fullscreenElement) {
          await playerRef.current.requestFullscreen();
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          }
        }
      } catch (err: any) {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        alert('Vollbild konnte nicht aktiviert werden. Falls du im Browser bist, klicke erst einmal in das Video-Fenster.');
      }
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

  return (
    <section className="streams-page page-container">
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
                  onClick={async () => {
                    if (stream.id === socket?.id) {
                      setViewingId(stream.id);
                      clearView();
                      return;
                    }

                    let code: string | undefined = undefined;
                    if (stream.hasJoinCode) {
                      const input = prompt('Dieser Stream ist geschützt. Bitte gib den Beitritts-Code ein:');
                      if (input === null) return;
                      code = input.toUpperCase();
                    }

                    setViewingId(stream.id);
                    try {
                      await viewStream(stream.id, code);
                    } catch (err: any) {
                      alert(err.message || 'Fehler beim Laden des Streams.');
                    }
                  }}
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

        <main className="streams-viewer" ref={playerRef}>
          <div className="main-video-area">
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
                    maxHeight: playerQuality === '720p' ? '720px' : playerQuality === '480p' ? '480px' : '100%'
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
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0,0,0,0.9));
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    opacity: 0;
                    transition: all 0.3s;
                    z-index: 100;
                    pointer-events: none;
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
