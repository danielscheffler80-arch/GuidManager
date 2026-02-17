// Auth Context
// Verwaltet User Authentication State

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '../utils/storage';

interface User {
  id: number;
  battletag: string;
  battlenetId: number;
  createdAt: string;
  discordId?: string;
  discordTag?: string;
  characters?: any[];
  guildMemberships?: any[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSyncing: boolean;
  login: (user: User) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  syncCharacters: (detailed?: boolean) => Promise<void>;

  isAdmin: boolean;
  connectionError: string | null;
  setBackendUrl: (url: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'waiting' | 'ready'>('checking');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const isSuperuser = String(user.battlenetId) === '100379014';

      const hasAdminPrivileges = user.guildMemberships?.some((m: any) => {
        // Rank 0 is always Admin (GM)
        if (m.rank === 0) return true;

        // Check if user's rank is in designated adminRanks for this guild
        const guildAdminRanks = m.guild?.adminRanks || [];
        return guildAdminRanks.includes(m.rank);
      });

      setIsAdmin(!!(isSuperuser || hasAdminPrivileges));
      console.log('[AUTH] Admin Check:', { isSuperuser, hasAdminPrivileges, bnetId: user.battlenetId });
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Lade User aus localStorage beim Start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('accessToken');

        // Check Electron Backend Status
        if (window.electronAPI && window.electronAPI.isBackendReady) {
          console.log('[AUTH] Waiting for backend check...');
          let checks = 0;
          while (!window.electronAPI.isBackendReady() && checks < 600) {
            if (checks > 30) setConnectionStatus('waiting'); // Show message after 3 seconds
            await new Promise(resolve => setTimeout(resolve, 100));
            checks++;
          }
          setConnectionStatus('ready');
          console.log(`[AUTH] Backend ready after ${checks * 100}ms`);
        }

        if (storedUser && token) {
          const userData = storage.get<User | null>('user', null);
          if (!userData) {
            // Data corrupted in localStorage
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            setIsLoading(false);
            return;
          }

          // Validiere Token mit Backend
          const backendUrl = window.electronAPI?.getBackendUrl?.() ||
            localStorage.getItem('backendUrl') ||
            'https://guild-manager-backend.onrender.com';

          const response = await fetch(`${backendUrl}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setUser(result.user);
              // Update localStorage with fresh data
              storage.set('user', result.user);
              // Trigger LIGHT initial sync in background
              setTimeout(() => syncCharacters(false), 2000);
            } else {
              // Token ungültig, lösche alles
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
            }
          } else {
            // Token ungültig, lösche alles
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Only set connection error if it's a network error (TypeEror on fetch)
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          setConnectionError('Verbindung zum Server fehlgeschlagen. Bitte Backend-URL prüfen.');
        }
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Background sync every hour
  useEffect(() => {
    if (!user) return;

    const interval = window.setInterval(() => {
      console.log('[AUTH] Triggering background sync (hourly)');
      syncCharacters();
    }, 60 * 60 * 1000); // 1 hour

    return () => window.clearInterval(interval);
  }, [user]);

  const syncCharacters = async (detailed: boolean = false) => {
    const token = localStorage.getItem('accessToken');
    if (!token || isSyncing) return;

    setIsSyncing(true);
    try {
      const backendUrl = window.electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('backendUrl') ||
        'http://localhost:3334';

      console.log(`[AUTH] Syncing characters (Detailed: ${detailed})...`);
      const response = await fetch(`${backendUrl}/auth/sync?detailed=${detailed}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('[AUTH] Sync successful');
        // Hol frische User-Daten vom Backend ab um neue Charaktere etc. zu sehen
        const meResponse = await fetch(`${backendUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (meResponse.ok) {
          const meResult = await meResponse.json();
          if (meResult.success) {
            setUser(meResult.user);
            storage.set('user', meResult.user);
          }
        }
      } else {
        console.error('[AUTH] Sync failed:', response.statusText);
      }
    } catch (error) {
      console.error('[AUTH] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const login = async (userData: User) => {
    setUser(userData);
    storage.set('user', userData);
    // Start background sync after login
    syncCharacters(false);
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const backendUrl = window.electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('backendUrl') ||
        'http://localhost:3334';

      if (token) {
        // Logout beim Backend
        await fetch(`${backendUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
    }
  };

  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user) return false;

    try {
      const backendUrl = window.electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('backendUrl') ||
        'http://localhost:3334';

      const response = await fetch(`${backendUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('CheckAuth error:', error);
      setConnectionError('Server nicht erreichbar.');
      return false;
    }
  };

  const setBackendUrl = (url: string) => {
    // URL normalisieren (kein Trailing Slash)
    const normalizedUrl = url.replace(/\/$/, '');
    localStorage.setItem('backendUrl', normalizedUrl);

    // Reset States
    setConnectionError(null);
    setIsLoading(true);

    // Reload to apply changes
    window.location.reload();
  };

  if (isLoading && !user && !connectionError) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#252525',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#D1D9E0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(163, 48, 201, 0.3)',
            borderTopColor: '#A330C9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '16px', fontWeight: 'bold' }}>Suche nach Server Verbindung...</p>
          {connectionStatus === 'waiting' && (
            <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '8px', maxWidth: '300px', margin: '8px auto' }}>
              Cloud-Server wird geweckt. Dies kann beim ersten Start bis zu 60 Sekunden dauern...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isSyncing,
      login,
      logout,
      checkAuth,
      syncCharacters,
      isAdmin: !!isAdmin,
      connectionError,
      setBackendUrl
    }}>
      {children}
    </AuthContext.Provider>
  );
};