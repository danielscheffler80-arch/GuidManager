import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MessageInbox from './MessageInbox';
import MessagePopup from './MessagePopup';

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: number, name: string } | null>(null);
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

  // Fetch unread messages count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const char = user.characters?.find((c: any) => c.isMain) || user.characters?.[0];
      if (!char) return;

      try {
        const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/messages/${char.id}/unread`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error('Failed to fetch unread count', err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [user]);

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
              <div className="flex items-center gap-2">
                <button
                  className={`refresh-btn ${isSyncing ? 'spinning' : ''}`}
                  onClick={handleRefresh}
                  title="Charaktere jetzt synchronisieren"
                  disabled={isSyncing}
                >
                  🔄
                </button>
                {unreadCount > 0 && (
                  <div
                    className="relative flex items-center cursor-pointer hover:scale-110 transition-transform"
                    title={`${unreadCount} ungelesene Nachrichten`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInbox(true);
                    }}
                  >
                    <span className="text-[14px]">📩</span>
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full border border-[#1D1E1F]">
                      {unreadCount}
                    </span>
                  </div>
                )}
              </div>
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
            {/* DEBUG RESET BUTTON */}
            <button
              className="admin-action-item debug-reset"
              style={{
                color: '#ff4444',
                border: '1px solid rgba(255, 68, 68, 0.2)',
                background: 'rgba(255, 68, 68, 0.05)',
                width: '100%',
                textAlign: 'left',
                marginBottom: '10px'
              }}
              onClick={async () => {
                if (window.confirm('Möchtest du deinen Sync-Status wirklich zurücksetzen? Die App wird danach neu gestartet.')) {
                  try {
                    const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/sync/initial/reset`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
                    });
                    if (resp.ok) {
                      localStorage.removeItem('accessToken');
                      localStorage.removeItem('refreshToken');
                      window.location.href = '/';
                    }
                  } catch (err) {
                    console.error('Reset failed', err);
                  }
                }
              }}
            >
              <span className="icon">🔄</span> Sync Reset & Restart
            </button>

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

      {/* Messaging Modals */}
      {showInbox && (
        <MessageInbox
          onClose={() => {
            setShowInbox(false);
            // Re-fetch unread count after closing inbox to update the badge
            const fetchUnreadCount = async () => {
              const char = user.characters?.find((c: any) => c.isMain) || user.characters?.[0];
              if (!char) return;
              try {
                const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/messages/${char.id}/unread`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (resp.ok) {
                  const data = await resp.json();
                  setUnreadCount(data.count);
                }
              } catch (e) { }
            };
            fetchUnreadCount();
          }}
          onReply={(id, name) => {
            setShowInbox(false);
            setReplyTarget({ id, name });
          }}
        />
      )}

      {replyTarget && (
        <MessagePopup
          receiverId={replyTarget.id}
          receiverName={replyTarget.name}
          onClose={() => setReplyTarget(null)}
          onSuccess={() => {
            // Optional: Show success toast
          }}
        />
      )}
    </nav>
  );
}
