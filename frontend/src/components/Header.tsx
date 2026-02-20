// Header Component - Slim version without profile (moved to sidebar)

import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: any;
  }
}

const Header: React.FC = () => {
  const { user } = useAuth();
  const {
    guilds,
    selectedGuild,
    setSelectedGuild,
    loading,
    selectedRosterView,
    setSelectedRosterView,
    triggerRosterSync,
    isRosterSyncing,
    rosterSortField,
    setRosterSortField,
    settingsSortField,
    setSettingsSortField,
    availableRosters
  } = useGuild();

  const { pathname } = useLocation();
  const { filter, setFilter, isStreaming, stopStream } = useWebRTC();

  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('0.6.6');

  // Mythic filter state
  const [mSearch, setMSearch] = useState('');
  const [mMin, setMMin] = useState('');
  const [mMax, setMMax] = useState('');

  const dispatchMythicFilter = (search: string, min: string, max: string) => {
    window.dispatchEvent(new CustomEvent('mythic-key-filter', {
      detail: {
        search,
        min: min ? parseInt(min) : 0,
        max: max ? parseInt(max) : 99
      }
    }));
  };

  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(setAppVersion);
    }

    if (window.electronAPI?.onUpdateMessage) {
      window.electronAPI.onUpdateMessage((msg: string) => {
        if (msg === 'UPDATE_READY') {
          setUpdateStatus('Update bereit');
          const confirm = window.confirm('Update bereit! Möchtest du die App jetzt neu starten und aktualisieren?');
          if (confirm) {
            window.electronAPI.restartAndInstall();
          }
        } else {
          setUpdateStatus(msg);
          // Lösche Status nach 5 Sekunden, wenn es kein "Ready" ist
          if (msg !== 'Update bereit') {
            setTimeout(() => setUpdateStatus(null), 5000);
          }
        }
      });
    }
  }, []);

  if (!user) {
    return null;
  }

  const isStreamsPage = pathname === '/streams';

  const dropdownStyle: React.CSSProperties = {
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
    minWidth: '140px',
    transition: 'all 0.2s ease',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    appearance: 'none',
    paddingRight: '30px'
  };

  const [codeCopied, setCodeCopied] = useState(false);
  const streamJoinCode = isStreaming ? (localStorage.getItem('stream-privacy-code') || '') : '';

  const copyJoinCode = () => {
    if (streamJoinCode) {
      navigator.clipboard.writeText(streamJoinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };


  return (
    <header className="header slim-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '80px',
      backgroundColor: '#1a1b1c',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      zIndex: 30
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {loading ? (
            <div style={{ height: '36px', width: '200px', backgroundColor: '#2A2A2A', borderRadius: '8px', animation: 'pulse 1.5s infinite' }}></div>
          ) : (
            <select
              value={selectedGuild?.id || ''}
              onChange={(e) => {
                const guildId = Number(e.target.value);
                const guild = guilds.find(g => g.id === guildId);
                setSelectedGuild(guild || null);
              }}
              style={dropdownStyle}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = '#444')}
            >
              {guilds.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.name}
                </option>
              ))}
              {guilds.length === 0 && <option value="">Keine Gilden verfügbar</option>}
            </select>
          )}
        </div>

        {(isStreamsPage || pathname === '/roster' || pathname === '/mythic') && (
          <div className="header-page-filters" style={{ display: 'flex', gap: '8px', marginLeft: '20px', alignItems: 'center' }}>
            {isStreamsPage ? (
              <>
                <button
                  onClick={() => setFilter('all')}
                  className={`head-filter ${filter === 'all' ? 'active' : ''}`}
                >Alle</button>
                <button
                  onClick={() => setFilter('public')}
                  className={`head-filter ${filter === 'public' ? 'active' : ''}`}
                >Öffentlich</button>
                <button
                  onClick={() => setFilter('private')}
                  className={`head-filter ${filter === 'private' ? 'active' : ''}`}
                >Gilde</button>
                <button
                  onClick={() => setFilter('protected')}
                  className={`head-filter ${filter === 'protected' ? 'active' : ''}`}
                >Geschützt</button>
              </>
            ) : pathname === '/mythic' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#222', padding: '2px 10px', borderRadius: '6px', border: '1px solid #333' }}>
                  <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 800 }}>SUCHE</span>
                  <input
                    type="text"
                    placeholder="Key..."
                    value={mSearch}
                    onChange={(e) => {
                      setMSearch(e.target.value);
                      dispatchMythicFilter(e.target.value, mMin, mMax);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      padding: '4px 0',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      outline: 'none',
                      width: '140px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#222', padding: '2px 10px', borderRadius: '6px', border: '1px solid #333' }}>
                  <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 800 }}>LVL</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={mMin}
                    onChange={(e) => {
                      setMMin(e.target.value);
                      dispatchMythicFilter(mSearch, e.target.value, mMax);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      width: '35px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      outline: 'none',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ color: '#444' }}>-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={mMax}
                    onChange={(e) => {
                      setMMax(e.target.value);
                      dispatchMythicFilter(mSearch, mMin, e.target.value);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      width: '35px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      outline: 'none',
                      textAlign: 'center'
                    }}
                  />
                </div>
              </div>
            ) : (
              // Roster page left controls
              <>
                <select
                  value={selectedRosterView}
                  onChange={(e) => setSelectedRosterView(e.target.value)}
                  style={dropdownStyle}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = '#444')}
                >
                  <option value="all">Alle Mitglieder</option>
                  <option value="main">Main Roster (Standard)</option>
                  {availableRosters.map(roster => (
                    <option key={roster.id} value={String(roster.id)}>{roster.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => selectedGuild && triggerRosterSync(selectedGuild.id)}
                  disabled={isRosterSyncing}
                  style={{
                    backgroundColor: '#00aaff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    width: '19px',
                    height: '19px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: useGuild().isRosterSyncing ? 'not-allowed' : 'pointer',
                    opacity: useGuild().isRosterSyncing ? 0.6 : 1,
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 5px rgba(0, 170, 255, 0.2)',
                    marginLeft: '8px'
                  }}
                  title="Roster synchronisieren"
                >
                  <span className={useGuild().isRosterSyncing ? 'animate-spin' : ''} style={{ fontSize: '0.7rem' }}>
                    {useGuild().isRosterSyncing ? '⌛' : '🔄'}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {pathname === '/roster' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setRosterSortField('role')}
              className={`head-filter ${rosterSortField === 'role' ? 'active' : ''}`}
            >Rolle</button>
            <button
              onClick={() => setRosterSortField('ilvl')}
              className={`head-filter ${rosterSortField === 'ilvl' ? 'active' : ''}`}
            >Itemlevel</button>
            <button
              onClick={() => setRosterSortField('rank')}
              className={`head-filter ${rosterSortField === 'rank' ? 'active' : ''}`}
            >Gildenrang</button>
          </div>
        )}

        {/* Join Code + Stop Stream */}
        {isStreaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {streamJoinCode && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(0, 170, 255, 0.1)',
                border: '1px solid rgba(0, 170, 255, 0.4)',
                borderRadius: '6px',
                padding: '4px 8px'
              }}>
                <span style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Code</span>
                <code style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '2px', color: '#00aaff', fontFamily: 'monospace' }}>
                  {streamJoinCode}
                </code>
                <button
                  onClick={copyJoinCode}
                  title="Code kopieren"
                  style={{
                    background: codeCopied ? 'rgba(0,200,0,0.2)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: codeCopied ? '#4ade80' : '#aaa',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    transition: 'all 0.2s'
                  }}
                >{codeCopied ? '✓' : '📋'}</button>
              </div>
            )}
            <button
              onClick={() => stopStream()}
              style={{
                backgroundColor: '#ff4444',
                border: 'none',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(255, 68, 68, 0.2)',
                padding: 0
              }}
              title="Stop Stream"
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: 'white' }}></div>
            </button>
          </div>
        )}

        {pathname === '/settings' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSettingsSortField('ilvl')}
              className={`head-filter ${settingsSortField === 'ilvl' ? 'active' : ''}`}
            >Itemlevel</button>
            <button
              onClick={() => setSettingsSortField('rio')}
              className={`head-filter ${settingsSortField === 'rio' ? 'active' : ''}`}
            >RIO Score</button>
            <button
              onClick={() => setSettingsSortField('progress')}
              className={`head-filter ${settingsSortField === 'progress' ? 'active' : ''}`}
            >Progress</button>
          </div>
        )}
        {pathname === '/mythic' && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('mythic-sync-keys'))}
            style={{
              background: 'rgba(163,48,201,0.1)',
              border: '1px solid rgba(163,48,201,0.3)',
              color: 'white',
              padding: '4px 14px',
              borderRadius: '6px',
              fontSize: '0.65rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase' as any,
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(163,48,201,0.1)'; e.currentTarget.style.borderColor = 'rgba(163,48,201,0.3)'; }}
          >
            <svg style={{ width: '11px', height: '11px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Sync
          </button>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '4px 12px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', letterSpacing: '0.05em' }}>V{appVersion}</span>
          <button
            onClick={() => {
              if (updateStatus === 'Prüfe...') return;
              setUpdateStatus('Prüfe...');
              window.electronAPI?.checkForUpdates?.().then((res: any) => {
                if (res && !res.success) {
                  setUpdateStatus('Kein Update');
                  setTimeout(() => setUpdateStatus(null), 3000);
                }
              }).catch(() => {
                setUpdateStatus('Fehler');
                setTimeout(() => setUpdateStatus(null), 3000);
              });

              // Sicherheits-Fallback nach 10s falls gar keine Rückmeldung kommt
              setTimeout(() => {
                setUpdateStatus(prev => prev === 'Prüfe...' ? null : prev);
              }, 10000);
            }}
            style={{
              background: updateStatus?.includes('bereit') ? '#00ff00' : '#00aaff',
              color: updateStatus?.includes('bereit') ? 'black' : 'white',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.65rem',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              minWidth: '100px',
              textAlign: 'center'
            }}
          >
            {updateStatus || 'Update prüfen'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.8; }
          100% { opacity: 0.6; }
        }
        .head-filter {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #888;
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 600;
            cursor: pointer;
        }
        .head-filter:hover {
            border-color: #666;
            color: #ccc;
        }
        .head-filter.active {
            background: var(--accent);
            border-color: var(--accent);
            color: white;
        }
      `}</style>
    </header>
  );
};

export default Header;
