import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/roster', label: 'Roster', icon: '👥' },
  { to: '/raids', label: 'Raid-Kalender', icon: '⚔️' },
  { to: '/mythic', label: 'Mythic+', icon: '💎' },
  { to: '/streams', label: 'Streams', icon: '📺' },
  { to: '/stream-settings', label: 'Stream Einstellungen', icon: '⚙️' },
  { to: '/chat', label: 'Chat', icon: '💬' }
];

export default function Sidebar() {
  const { user, logout, isSyncing, syncCharacters, isAdmin } = useAuth();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('0.2.34');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(setAppVersion);
    }

    if (window.electronAPI?.onUpdateMessage) {
      window.electronAPI.onUpdateMessage((msg) => {
        if (msg === 'UPDATE_READY') {
          const confirm = window.confirm('Update bereit! Möchtest du die App jetzt neu starten und aktualisieren?');
          if (confirm) {
            window.electronAPI.restartAndInstall();
          }
          setUpdateStatus('Update bereit zum Installieren');
        } else {
          setUpdateStatus(msg);
          // Auto-clear success messages after 5 seconds
          if (msg === 'Deine Version ist aktuell.') {
            setTimeout(() => setUpdateStatus(null), 5000);
          }
        }
      });
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    syncCharacters(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const battletag = user.battletag || 'User';
  const initial = battletag.charAt(0).toUpperCase();
  const displayName = battletag.split('#')[0];

  return (
    <nav className="sidebar-nav">
      {/* User Profile Section at Top */}
      <div className="sidebar-profile-section" ref={dropdownRef}>
        <div className="profile-trigger sidebar-trigger" onClick={toggleDropdown}>
          <div className="avatar-container">
            <div className="avatar-placeholder">
              {initial}
            </div>
            <div className="status-dot online"></div>
          </div>
          <div className="user-info-text">
            <span className="header-username">{displayName}</span>
            <div className="status-refresh-row">
              <span className="header-status">Online</span>
              <button
                className={`refresh-btn ${isSyncing ? 'spinning' : ''}`}
                onClick={handleRefresh}
                title="Charaktere jetzt synchronisieren"
                disabled={isSyncing}
              >
                🔄
              </button>
            </div>
          </div>
          <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
        </div>

        {isDropdownOpen && (
          <div className="profile-dropdown sidebar-dropdown">
            <div className="dropdown-user-header">
              <div className="dropdown-avatar big">
                {initial}
                <div className="status-dot online"></div>
              </div>
              <div className="dropdown-user-details">
                <div className="dropdown-battletag">{battletag}</div>
                <div className="dropdown-connection">Verbunden mit Europa</div>
              </div>
            </div>

            <div className="dropdown-divider"></div>

            <div className="dropdown-status-options">
              <div className="status-option active">
                <span className="status-dot online"></span> Online
              </div>
              <div className="status-option">
                <span className="status-dot afk"></span> AFK
              </div>
              <div className="status-option">
                <span className="status-dot dnd"></span> DND
              </div>
            </div>

            <div className="dropdown-divider"></div>

            <Link to="/settings" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
              <span className="icon">⚙️</span> Accounteinstellungen
            </Link>

            <div className="dropdown-divider"></div>

            <button className="dropdown-item logout" onClick={handleLogout}>
              <span className="icon">↪️</span> Ausloggen
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-divider"></div>

      {/* Navigation Items */}
      <ul className="nav-list">
        {items.map((it) => (
          <li key={it.to} className="nav-item">
            <Link
              to={it.to}
              className={location.pathname === it.to ? 'active' : ''}
            >
              <span className="nav-icon">{it.icon}</span>
              <span className="nav-label">{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="sidebar-divider"></div>

      {/* App Update Section */}
      <div style={{ padding: '0 15px', marginBottom: '15px' }}>
        <div style={{
          background: '#1D1E1F',
          borderRadius: '10px',
          padding: '12px',
          border: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75em', color: '#666', fontWeight: 'bold' }}>VERSION {appVersion}</span>
            <button
              onClick={() => {
                setUpdateStatus('Prüfe auf Updates...');
                window.electronAPI?.checkForUpdates?.().catch((err: any) => setUpdateStatus('Fehler: ' + err));
              }}
              style={{
                background: '#00aaff',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.65em',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >Update prüfen</button>
          </div>
          {updateStatus && (
            <div style={{
              fontSize: '0.65em',
              color: updateStatus.includes('bereit') ? '#00ff00' : '#888',
              fontStyle: 'italic',
              background: 'rgba(0,0,0,0.2)',
              padding: '4px 6px',
              borderRadius: '4px'
            }}>
              {updateStatus}
            </div>
          )}
        </div>
      </div>

      {/* Admin Management Panel */}
      {isAdmin && (
        <div className="sidebar-admin-panel">
          <div className="admin-panel-header">
            <span className="admin-pulsar"></span>
            ADMIN-MANAGEMENT
          </div>
          <div className="admin-actions">
            <Link to="/roster" className="admin-action-item">
              <span className="icon">👥</span> Roster-Setup
            </Link>
            <Link to="/admin/settings" className="admin-action-item">
              <span className="icon">🎖️</span> Ränge & Admins
            </Link>
            <Link to="/admin/create-raid" className="admin-action-item">
              <span className="icon">⚔️</span> Raid planen
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
