// Login Page Component
// Battle.net OAuth Login Integration

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/login.css';

interface LoginProps {
  onLoginSuccess?: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { login, connectionError, setBackendUrl } = useAuth();

  // Local state for the input field
  const [backendInput, setBackendInput] = useState('');

  useEffect(() => {
    // Prüfe ob wir in Electron laufen
    const electronDetected = !!window.electronAPI;
    console.log(`[LOGIN] Electron detected: ${electronDetected}`);
    setIsElectron(electronDetected);

    // Initialize input with current URL
    const currentUrl = (window as any).electronAPI?.getBackendUrl?.() ||
      localStorage.getItem('backendUrl') ||
      'http://localhost:3334';
    setBackendInput(currentUrl);
  }, []);

  const remoteLog = async (message: string, data?: any) => {
    try {
      const backendUrl = window.electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('backendUrl') ||
        'http://localhost:3334';

      await fetch(`${backendUrl}/auth/debug/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, data })
      });
    } catch (e) {
      console.error('Failed to send remote log:', e);
    }
  };

  const handleBattleNetLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Hole Backend URL
      const backendUrl = window.electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('backendUrl') ||
        'http://localhost:3334';

      // Starte OAuth Flow
      const authUrl = `${backendUrl}/auth/battlenet`;
      console.log(`[AUTH] Fetching from ${authUrl}`);

      const response = await fetch(`${authUrl}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Login failed');
      }

      await remoteLog('Login initiated', { state: data.state, authUrl: data.authUrl, isElectron });

      if (isElectron) {
        // In Electron: Öffne externen Browser
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(data.authUrl);

          // Starte Polling für Login-Status
          pollLoginStatus(data.state);
        } else {
          throw new Error('Electron API nicht verfügbar');
        }
      } else {
        // Im Browser: Normale Weiterleitung
        window.location.href = data.authUrl;
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
      setIsLoading(false);
    }
  };

  const pollLoginStatus = async (state: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const backendUrl = window.electronAPI?.getBackendUrl?.() ||
          localStorage.getItem('backendUrl') ||
          'http://localhost:3334';

        const response = await fetch(`${backendUrl}/auth/status/${state}`);

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.user && data.tokens) {
            await remoteLog('Login success via polling', { state });
            localStorage.setItem('accessToken', data.tokens.accessToken);
            localStorage.setItem('refreshToken', data.tokens.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.user));

            login(data.user);

            if (onLoginSuccess) {
              onLoginSuccess(data.user);
            }
            return;
          }

          if (data.pending) {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 1000);
            } else {
              await remoteLog('Login timeout', { state, attempts });
              setError('Login-Timeout: Bitte versuche es erneut');
              setIsLoading(false);
            }
          } else if (!data.success) {
            await remoteLog('Login failed from polling', { state, error: data.error });
            setError(data.error || 'Login fehlgeschlagen');
            setIsLoading(false);
          }
        } else {
          await remoteLog('Polling response NOT OK', { state, status: response.status });
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 1000);
          } else {
            setError('Verbindung zum Server unterbrochen');
            setIsLoading(false);
          }
        }
      } catch (err) {
        await remoteLog('Polling network error', { state, error: err instanceof Error ? err.message : String(err) });
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 1000);
        } else {
          setError('Netzwerkfehler beim Polling');
          setIsLoading(false);
        }
      }
    };

    checkStatus();
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const backendUrl = window.electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('backendUrl') ||
        'http://localhost:3334';

      const response = await fetch(`${backendUrl}/auth/callback?code=${code}&state=${state}`);
      const data = await response.json().catch(() => ({ success: true, isDelayed: true }));

      if (data.isDelayed) return;

      if (!data.success) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      login(data.user);

      window.history.replaceState({}, document.title, window.location.pathname);

      if (onLoginSuccess) onLoginSuccess(data.user);

    } catch (err) {
      console.error('OAuth Callback Error:', err);
      setError(err instanceof Error ? err.message : 'Authentication fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state && !isElectron) {
      handleOAuthCallback(code, state);
    }
  }, [isElectron]);

  const handleSaveSettings = () => {
    if (backendInput) {
      console.log('[LOGIN] Saving new backend URL:', backendInput);
      setBackendUrl(backendInput);
      setShowSettings(false);
    }
  };

  return (
    <div className="login-container">
      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#1E1E1E',
            padding: '2rem',
            borderRadius: '12px',
            width: '400px',
            border: '1px solid #333',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: '#D1D9E0', marginTop: 0 }}>Verbindungseinstellungen</h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.9rem' }}>
                Backend URL
              </label>
              <input
                type="text"
                value={backendInput}
                onChange={(e) => setBackendInput(e.target.value)}
                placeholder="http://localhost:3334"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#111',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>
                Beispiel: http://192.168.178.65:3334
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #333',
                  color: '#ccc',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveSettings}
                style={{
                  backgroundColor: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Speichern & Neustart
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="login-card" style={{ position: 'relative' }}>
        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Einstellungen"
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
        >
          ⚙️
        </button>

        <div className="login-header">
          <div className="login-icon">
            <span>GM</span>
          </div>
          <h2 className="login-title">Willkommen zurück</h2>
          <p className="login-description">
            Melde dich mit deinem Battle.net Account an
          </p>
        </div>

        {/* Global Connection Error */}
        {connectionError && (
          <div className="error-alert" style={{ marginBottom: '1rem', border: '1px solid #ff4444', backgroundColor: 'rgba(255, 68, 68, 0.1)' }}>
            <p className="error-alert-text" style={{ color: '#ff4444' }}>{connectionError}</p>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                marginTop: '8px',
                background: 'rgba(255, 68, 68, 0.2)',
                border: 'none',
                color: '#ff4444',
                fontSize: '0.8rem',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Einstellungen öffnen
            </button>
          </div>
        )}

        {error && (
          <div className="error-alert">
            <p className="error-alert-text">{error}</p>
          </div>
        )}

        <button
          onClick={handleBattleNetLogin}
          disabled={isLoading || !!connectionError}
          className="login-button"
          style={{ opacity: connectionError ? 0.5 : 1, cursor: connectionError ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? (
            <>
              <span className="login-spinner">●</span>
              <span>Anmeldung läuft...</span>
            </>
          ) : (
            <>
              <span>⚔️</span>
              <span>Mit Battle.net anmelden</span>
            </>
          )}
        </button>

        <div className="login-footer">
          <p>Du wirst zu Battle.net weitergeleitet,</p>
          <p>um deine Identität zu bestätigen.</p>
        </div>

        {isElectron && (
          <div className="electron-notice">
            <p className="electron-notice-text">
              Desktop App: Die Anmeldung öffnet in deinem Browser.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
