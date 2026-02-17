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
  const dropdownRef = useRef<HTMLDivElement>(null);


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
