import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const steps = [
    { id: 1, title: 'Sync Account Daten', description: 'Grundlegende Profil-Informationen werden abgerufen.' },
    { id: 2, title: 'Charaktere & Gilden entdecken', description: 'Suche nach all deinen Helden und ihren Communities.' },
    { id: 3, title: 'Gilden-Daten Deep Sync', description: 'Roster, RIO-Scores und Raid-Fortschritte werden geladen.' },
    { id: 4, title: 'Addon-Daten abgleichen', description: 'Lokale Keys und Addon-Informationen werden integriert.' },
    { id: 5, title: 'Chat-History laden', description: 'Letzte Nachrichten vom Server abrufen.' }
];

const InitialSync: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Initialisierung...');
    const [error, setError] = useState<string | null>(null);
    const { user, checkAuth, backendUrl } = useAuth();
    const navigate = useNavigate();
    const syncStarted = React.useRef(false); // Guard gegen Mehrfach-Execution

    const startSync = async () => {
        if (syncStarted.current) return;
        syncStarted.current = true;

        const token = localStorage.getItem('accessToken');

        if (!user) {
            console.log('[SYNC] Waiting for user context...');
            syncStarted.current = false; // Reset damit es später triggern kann
            return;
        }

        try {
            console.log('[SYNC] Initialization complete, starting phase 1...');

            // Step 1: Account Daten
            setCurrentStep(1);
            setStatus(steps[0].title);
            setProgress(5);

            const res1 = await fetch(`${backendUrl}/api/sync/initial/account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res1.ok) throw new Error('Account sync fehlgeschlagen. Bitte prüfe deine Battle.net Verbindung.');

            // Step 2: Discovery
            setProgress(25);
            setCurrentStep(2);
            setStatus(steps[1].title);

            // Wir warten hier nicht künstlich sondern gehen direkt weiter da Step 1 fertig ist

            // Step 3: Deep Guild Sync (The heavy part)
            // Dieser Schritt kann MINUTEN dauern. Wir setzen kein Timeout im Fetch.
            setProgress(45);
            setCurrentStep(3);
            setStatus(steps[2].title);

            const res2 = await fetch(`${backendUrl}/api/sync/initial/guilds`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res2.ok) throw new Error('Gilden deep-sync fehlgeschlagen. Der Server braucht eventuell länger, bitte versuche es erneut.');

            // Step 4: Addon Daten
            setProgress(75);
            setCurrentStep(4);
            setStatus(steps[3].title);

            // Step 5: Finalize
            setProgress(90);
            setCurrentStep(5);
            setStatus(steps[4].title);

            const res3 = await fetch(`${backendUrl}/api/sync/initial/finalize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res3.ok) throw new Error('Finalisierung fehlgeschlagen.');

            setProgress(100);
            setStatus('Abgeschlossen!');

            // Refresh user state
            console.log('[SYNC] Sync finished, refreshing auth state...');
            await checkAuth();

            // Redirect to account settings so user can choose main char
            setTimeout(() => {
                console.log('[SYNC] Redirecting to /account');
                navigate('/account');
            }, 1000);

        } catch (err: any) {
            console.error('[SYNC] Error during synchronization:', err);
            setError(err.message);
            syncStarted.current = false; // Allow retry
        }
    };

    useEffect(() => {
        // Wenn Sync bereits erledigt ist (z.B. durch Re-mount nach Layout-Switch), sofort weg hier
        if (user?.initialSyncCompletedAt) {
            console.log('[SYNC] Already completed, skipping to /account');
            navigate('/account');
            return;
        }

        // Nur starten wenn Backend URL bereit ist (nicht localhost fallback oder Render)
        if (backendUrl && !backendUrl.includes('localhost') && !backendUrl.includes('onrender')) {
            console.log(`[SYNC] Triggered by backendUrl: ${backendUrl}`);
            startSync();
        } else if (backendUrl && backendUrl.includes('localhost')) {
            // Im Dev Modus auch starten
            console.log(`[SYNC] Triggered by backendUrl (Dev): ${backendUrl}`);
            startSync();
        }
    }, [backendUrl, user?.initialSyncCompletedAt]); // React on backendUrl and sync status changes

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h1 style={titleStyle}>Initialer Daten-Abgleich</h1>

                <div style={animationContainer}>
                    <div style={circleAnimation}></div>
                    <div style={progressText}>{progress}%</div>
                </div>

                <div style={progressBarContainer}>
                    <div style={{ ...progressBar, width: `${progress}%` }}></div>
                </div>

                <div style={statusContainer}>
                    <h3 style={currentStepTitle}>{status}</h3>
                    <p style={descriptionStyle}>{steps[currentStep - 1]?.description || 'Warten...'}</p>
                </div>

                <div style={stepsList}>
                    {steps.map((step) => (
                        <div key={step.id} style={{
                            ...stepItem,
                            color: currentStep >= step.id ? 'var(--accent)' : '#666',
                            opacity: currentStep >= step.id ? 1 : 0.5
                        }}>
                            <div style={currentStep === step.id ? activeIndicator : dotIndicator}></div>
                            <span>{step.title}</span>
                        </div>
                    ))}
                </div>

                {error && (
                    <div style={errorStyle}>
                        <strong>Fehler:</strong> {error}
                        <button onClick={() => window.location.reload()} style={retryButton}>Erneut versuchen</button>
                    </div>
                )}

                <div style={infoFooter}>
                    <p>Dieser Vorgang findet nur beim ersten Start statt und kann mehrere Minuten dauern.</p>
                    <p style={{ fontSize: '0.85rem', color: '#888' }}>
                        Wir bereiten alles vor, um die Ladezeiten in der App später extrem zu verkürzen.
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#D1D9E0',
    fontFamily: 'system-ui, -apple-system, sans-serif'
};

const cardStyle: React.CSSProperties = {
    backgroundColor: '#252525',
    padding: '40px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    textAlign: 'center',
    border: '1px solid #333'
};

const titleStyle: React.CSSProperties = {
    margin: '0 0 30px 0',
    fontSize: '1.5rem',
    background: 'linear-gradient(90deg, #fff, var(--accent))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 800
};

const animationContainer: React.CSSProperties = {
    position: 'relative',
    width: '120px',
    height: '120px',
    margin: '0 auto 30px'
};

const circleAnimation: React.CSSProperties = {
    width: '100%',
    height: '100%',
    border: '4px solid rgba(163, 48, 201, 0.1)',
    borderTop: '4px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 2s linear infinite'
};

const progressText: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '1.2rem',
    fontWeight: 'bold'
};

const progressBarContainer: React.CSSProperties = {
    width: '100%',
    height: '8px',
    backgroundColor: '#333',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '20px'
};

const progressBar: React.CSSProperties = {
    height: '100%',
    backgroundColor: 'var(--accent)',
    transition: 'width 0.5s ease-in-out',
    boxShadow: '0 0 10px var(--accent)'
};

const statusContainer: React.CSSProperties = {
    marginBottom: '30px'
};

const currentStepTitle: React.CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: '1.1rem'
};

const descriptionStyle: React.CSSProperties = {
    color: '#888',
    fontSize: '0.9rem',
    margin: 0
};

const stepsList: React.CSSProperties = {
    textAlign: 'left',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#1e1e1e',
    borderRadius: '12px'
};

const stepItem: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '0.9rem',
    transition: 'all 0.3s ease'
};

const dotIndicator: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#444',
    marginRight: '12px'
};

const activeIndicator: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    marginRight: '12px',
    boxShadow: '0 0 10px var(--accent)',
    animation: 'pulse 1.5s infinite'
};

const infoFooter: React.CSSProperties = {
    borderTop: '1px solid #333',
    paddingTop: '20px',
    fontSize: '0.9rem',
    color: '#aaa',
    lineHeight: '1.4'
};

const errorStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    color: '#ff4444',
    fontSize: '0.9rem'
};

const retryButton: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: '10px',
    padding: '8px',
    backgroundColor: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
};

export default InitialSync;
