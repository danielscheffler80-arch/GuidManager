import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const steps = [
    { id: 1, title: 'Phase 1: Sync Account Daten', description: 'Check Battle.net ID und Profil-Verifizierung.' },
    { id: 2, title: 'Phase 2: Charaktere & Gilden entdecken', description: 'Suche nach all deinen Helden und ihren Communities.' },
    { id: 3, title: 'Phase 3: Gilden-Daten Deep Sync', description: 'Deep Sync der Gilden-Roster (ilvl, RIO, Raid Progress).' },
    { id: 4, title: 'Phase 4: Addon-Daten abgleichen', description: 'Integriere aktuelle Keys von Blizzard & AlterEgo.' },
    { id: 5, title: 'Phase 5: Chat-History laden', description: 'Gilden-Chat Nachrichten vom Server laden.' }
];

const InitialSync: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Bereit für den Datenabgleich');
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<'idle' | 'syncing' | 'completed'>('idle');

    const { user, checkAuth, backendUrl, isLoading } = useAuth();
    const navigate = useNavigate();

    const [syncFinished, setSyncFinished] = useState(false);
    const isSuperuser = String(user?.battlenetId) === '100379014';

    useEffect(() => {
        if (isLoading) return;
        // Only auto-redirect if we didn't JUST finish the sync on this page
        if (user?.initialSyncCompletedAt && !syncFinished) {
            navigate('/account');
        }
    }, [user?.initialSyncCompletedAt, navigate, isLoading, syncFinished]);

    const runFullSync = async () => {
        setPhase('syncing');
        setError(null);
        const token = localStorage.getItem('accessToken');

        try {
            // Phase 1: Account
            setCurrentStep(1);
            setStatus(steps[0].title);
            setProgress(10);
            const res1 = await fetch(`${backendUrl}/api/sync/initial/account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res1.ok) throw new Error('Phase 1 fehlgeschlagen.');

            // Phase 2: Discover
            setCurrentStep(2);
            setStatus(steps[1].title);
            setProgress(30);
            const res2 = await fetch(`${backendUrl}/api/sync/initial/discover`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res2.ok) throw new Error('Phase 2 fehlgeschlagen.');

            // Phase 3: Deep Sync Guilds
            setCurrentStep(3);
            setStatus(steps[2].title);
            setProgress(60);
            const res3 = await fetch(`${backendUrl}/api/sync/initial/guilds`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res3.ok) throw new Error('Phase 3 fehlgeschlagen.');

            // Phase 4: Addon Data
            setCurrentStep(4);
            setStatus(steps[3].title);
            setProgress(80);
            const res4 = await fetch(`${backendUrl}/api/sync/initial/addon`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res4.ok) throw new Error('Phase 4 fehlgeschlagen.');

            // Phase 5: Chat History
            setCurrentStep(5);
            setStatus(steps[4].title);
            setProgress(90);
            const res5 = await fetch(`${backendUrl}/api/sync/initial/history`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res5.ok) throw new Error('Phase 5 fehlgeschlagen.');

            // Finalize
            setStatus('Finalisiere...');
            setProgress(95);
            const resFinal = await fetch(`${backendUrl}/api/sync/initial/finalize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resFinal.ok) throw new Error('Finalisierung fehlgeschlagen.');

            // Success
            setProgress(100);
            setSyncFinished(true); // Verhindert Auto-Redirect
            setPhase('completed');
            setStatus('Synchronisation vollständig!');
            await checkAuth(); // User-Objekt aktualisieren
        } catch (err: any) {
            setError(err.message);
            setPhase('idle');
        }
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>

                {/* Main Sync UI */}
                <div style={{ minWidth: '400px', textAlign: 'center' }}>
                    <h1 style={titleStyle}>Initialer Daten-Abgleich</h1>

                    <div style={animationContainer}>
                        <div style={{ ...circleAnimation, animation: phase === 'syncing' ? 'spin 2s linear infinite' : 'none', borderTopColor: phase === 'completed' ? '#4CAF50' : '#a330c9' }}></div>
                        <div style={progressText}>{progress}%</div>
                    </div>

                    <div style={progressBarContainer}>
                        <div style={{ ...progressBar, width: `${progress}%`, backgroundColor: phase === 'completed' ? '#4CAF50' : '#a330c9' }}></div>
                    </div>

                    <div style={statusContainer}>
                        <h3 style={currentStepTitle}>{status}</h3>
                        <p style={descriptionStyle}>{steps[currentStep - 1]?.description || 'Bereit zum Starten.'}</p>
                    </div>

                    <div style={stepsList}>
                        {steps.map((step) => (
                            <div key={step.id} style={{
                                ...stepItem,
                                color: currentStep >= step.id ? (phase === 'completed' ? '#4CAF50' : '#a330c9') : '#666',
                                opacity: currentStep >= step.id ? 1 : 0.5
                            }}>
                                <div style={currentStep === step.id ? activeIndicator : (currentStep > step.id ? doneIndicator : dotIndicator)}></div>
                                <span>{step.title}</span>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div style={errorStyle}>
                            <strong>Fehler:</strong> {error}
                        </div>
                    )}

                    <div style={actionContainer}>
                        {phase === 'idle' && (
                            <button onClick={runFullSync} style={primaryButton}>Sync Starten</button>
                        )}

                        {phase === 'completed' && (
                            <button onClick={() => navigate('/account')} style={nextButton}>Initialisierung abgeschlossen - App öffnen</button>
                        )}

                        {phase === 'syncing' && (
                            <div style={loadingText}>Synchronisiere... Bitte warten.</div>
                        )}

                        {isSuperuser && (
                            <button
                                onClick={() => window.open('/#/debug-logs', '_blank', 'width=1000,height=800')}
                                style={{ marginTop: '20px', background: 'rgba(163, 48, 201, 0.1)', border: '1px solid #a330c9', color: '#a330c9', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                🛠 Debugger in neuem Fenster öffnen
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 0.5; } }
            `}</style>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D9E0', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' };
const cardStyle: React.CSSProperties = { backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '16px', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', maxWidth: '500px' };
const titleStyle: React.CSSProperties = { margin: '0 0 30px 0', fontSize: '1.75rem', background: 'linear-gradient(135deg, #fff 0%, #a330c9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800, letterSpacing: '-0.025em' };
const animationContainer: React.CSSProperties = { position: 'relative', width: '120px', height: '120px', margin: '0 auto 30px' };
const circleAnimation: React.CSSProperties = { width: '100%', height: '100%', border: '4px solid rgba(163, 48, 201, 0.1)', borderTop: '4px solid #a330c9', borderRadius: '50%' };
const progressText: React.CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem', fontWeight: 800, color: '#fff' };
const progressBarContainer: React.CSSProperties = { width: '100%', height: '6px', backgroundColor: '#333', borderRadius: '3px', overflow: 'hidden', marginBottom: '25px' };
const progressBar: React.CSSProperties = { height: '100%', transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 0 15px rgba(163, 48, 201, 0.5)' };
const statusContainer: React.CSSProperties = { marginBottom: '30px' };
const currentStepTitle: React.CSSProperties = { margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600, color: '#fff' };
const descriptionStyle: React.CSSProperties = { color: '#9ca3af', fontSize: '0.9rem', lineHeight: '1.5' };
const stepsList: React.CSSProperties = { textAlign: 'left', marginBottom: '30px', padding: '24px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' };
const stepItem: React.CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '14px', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.3s ease' };
const dotIndicator: React.CSSProperties = { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#374151', marginRight: '14px' };
const doneIndicator: React.CSSProperties = { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '14px', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' };
const activeIndicator: React.CSSProperties = { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a330c9', marginRight: '14px', boxShadow: '0 0 12px rgba(163, 48, 201, 0.6)', animation: 'pulse 2s infinite' };
const actionContainer: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const primaryButton: React.CSSProperties = { width: '100%', padding: '14px', backgroundColor: '#a330c9', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' };
const nextButton: React.CSSProperties = { width: '100%', padding: '14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' };
const loadingText: React.CSSProperties = { color: '#a330c9', fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' };
const errorStyle: React.CSSProperties = { backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '10px', marginBottom: '25px', color: '#ef4444', fontSize: '0.9rem', textAlign: 'left' };

export default InitialSync;
