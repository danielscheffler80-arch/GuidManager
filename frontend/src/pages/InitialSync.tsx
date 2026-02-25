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
    const [status, setStatus] = useState('Bereit für den Datenabgleich');
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<'idle' | 'syncing' | 'completed'>('idle');
    const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0); // 0=Intro, 1=Account, 2=Guilds, 3=Finalize, 4=Done

    const { user, checkAuth, backendUrl, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Wenn Auth noch lädt (Backend-Check), warten wir ab
        if (isLoading) return;

        // Wenn Sync bereits erledigt ist, sofort weg hier
        if (user?.initialSyncCompletedAt) {
            console.log('[SYNC] Already completed, skipping to /account');
            navigate('/account');
        }
    }, [user?.initialSyncCompletedAt, navigate, isLoading]);

    const runPhase1 = async () => {
        setPhase('syncing');
        setError(null);
        const token = localStorage.getItem('accessToken');

        try {
            setCurrentStep(1);
            setStatus(steps[0].title);
            setProgress(10);

            const res1 = await fetch(`${backendUrl}/api/sync/initial/account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res1.ok) throw new Error('Account sync fehlgeschlagen.');

            setProgress(25);
            setCurrentStep(2);
            setStatus(steps[1].title);

            setPhase('completed');
            setCurrentPhaseIndex(1);
            setStatus('Phase 1 abgeschlossen!');
        } catch (err: any) {
            setError(err.message);
            setPhase('idle');
        }
    };

    const runPhase2 = async () => {
        setPhase('syncing');
        setError(null);
        const token = localStorage.getItem('accessToken');

        try {
            // Hol frische Daten vom Backend, um sicherzustellen dass guildMemberships da sind
            console.log('[SYNC] Phase 2: Fetching fresh user data...');
            const freshUser = await checkAuth();

            if (!freshUser) {
                throw new Error('Sitzung abgelaufen. Bitte neu einloggen.');
            }

            const memberships = freshUser.guildMemberships || [];
            console.log(`[SYNC] Phase 2: Found ${memberships.length} guilds to sync`);

            if (memberships.length === 0) {
                console.warn('[SYNC] No guilds found after Phase 1. Skipping to Phase 3.');
                setProgress(75);
                setPhase('completed');
                setCurrentPhaseIndex(2);
                setStatus('Phase 2 abgeschlossen (Keine Gilden gefunden)');
                return;
            }

            for (let i = 0; i < memberships.length; i++) {
                const membership = memberships[i];
                const guildName = membership.guild?.name || 'Unbekannte Gilde';
                const guildId = membership.guild?.id;

                setCurrentStep(3);
                setStatus(`Syncing Gilde ${i + 1} von ${memberships.length}: ${guildName}`);
                // Progress zwischen 25% und 75% verteilen
                const guildProgress = 25 + Math.floor(((i + 1) / memberships.length) * 50);
                setProgress(guildProgress);

                const res = await fetch(`${backendUrl}/api/sync/initial/guild/${guildId}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errData = await res.json();
                    console.error(`[SYNC] Failed to sync guild ${guildName}:`, errData);
                    // Wir machen trotzdem weiter bei anderen Gilden
                }
            }

            setProgress(75);
            setPhase('completed');
            setCurrentPhaseIndex(2);
            setStatus('Phase 2 abgeschlossen!');
            console.log('[SYNC] Phase 2 completed successfully');
        } catch (err: any) {
            console.error('[SYNC] Phase 2 error:', err);
            setError(err.message || 'Gilden-Sync fehlgeschlagen.');
            setPhase('idle');
        }
    };

    const runPhase3 = async () => {
        setPhase('syncing');
        setError(null);
        const token = localStorage.getItem('accessToken');

        try {
            console.log('[SYNC] Phase 3: Finalizing sync...');
            setCurrentStep(4);
            setStatus(steps[3].title);
            setProgress(85);

            const res3 = await fetch(`${backendUrl}/api/sync/initial/finalize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res3.ok) throw new Error('Finalisierung fehlgeschlagen.');

            setProgress(95);
            setStatus('Warte auf Bestätigung...');

            // Polling bis initialSyncCompletedAt im User-Objekt erscheint
            let persisted = false;
            let attempts = 0;
            while (!persisted && attempts < 10) {
                attempts++;
                console.log(`[SYNC] Persistence check attempt ${attempts}/10...`);
                const updatedUser = await checkAuth();
                if (updatedUser?.initialSyncCompletedAt) {
                    persisted = true;
                    console.log('[SYNC] initialSyncCompletedAt is now persisted!');
                } else {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            setProgress(100);
            setPhase('completed');
            setCurrentPhaseIndex(3);
            setStatus('Synchronisation vollständig!');
            console.log('[SYNC] Phase 3 completed successfully');
        } catch (err: any) {
            console.error('[SYNC] Phase 3 error:', err);
            setError(err.message || 'Abschluss fehlgeschlagen.');
            setPhase('idle');
        }
    };

    const handleNext = () => {
        setPhase('idle');
        if (currentPhaseIndex === 1) runPhase2();
        else if (currentPhaseIndex === 2) runPhase3();
        else if (currentPhaseIndex === 3) navigate('/account');
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h1 style={titleStyle}>Initialer Daten-Abgleich</h1>

                <div style={animationContainer}>
                    <div style={{ ...circleAnimation, animation: phase === 'syncing' ? 'spin 2s linear infinite' : 'none', borderTopColor: phase === 'completed' ? '#4CAF50' : 'var(--accent)' }}></div>
                    <div style={progressText}>{progress}%</div>
                </div>

                <div style={progressBarContainer}>
                    <div style={{ ...progressBar, width: `${progress}%`, backgroundColor: phase === 'completed' ? '#4CAF50' : 'var(--accent)' }}></div>
                </div>

                <div style={statusContainer}>
                    <h3 style={currentStepTitle}>{status}</h3>
                    <p style={descriptionStyle}>{steps[currentStep - 1]?.description || 'Bereit zum Starten.'}</p>
                </div>

                <div style={stepsList}>
                    {steps.map((step) => (
                        <div key={step.id} style={{
                            ...stepItem,
                            color: currentStep >= step.id ? (currentPhaseIndex >= 3 ? '#4CAF50' : 'var(--accent)') : '#666',
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
                    {phase === 'idle' && currentPhaseIndex === 0 && (
                        <button onClick={runPhase1} style={primaryButton}>Starten</button>
                    )}
                    {phase === 'completed' && currentPhaseIndex < 3 && (
                        <button onClick={handleNext} style={nextButton}>Weiter zu Phase {currentPhaseIndex + 1}</button>
                    )}
                    {phase === 'completed' && currentPhaseIndex === 3 && (
                        <button onClick={handleNext} style={primaryButton}>App öffnen</button>
                    )}
                    {phase === 'syncing' && (
                        <div style={loadingText}>Synchronisiere... Bitte warten.</div>
                    )}
                </div>

                <div style={infoFooter}>
                    <p>Wähle "Weiter", um den nächsten Schritt manuell zu starten.</p>
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
const containerStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D9E0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const cardStyle: React.CSSProperties = { backgroundColor: '#252525', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center', border: '1px solid #333' };
const titleStyle: React.CSSProperties = { margin: '0 0 30px 0', fontSize: '1.5rem', background: 'linear-gradient(90deg, #fff, var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 };
const animationContainer: React.CSSProperties = { position: 'relative', width: '120px', height: '120px', margin: '0 auto 30px' };
const circleAnimation: React.CSSProperties = { width: '100%', height: '100%', border: '4px solid rgba(163, 48, 201, 0.1)', borderTop: '4px solid var(--accent)', borderRadius: '50%' };
const progressText: React.CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.2rem', fontWeight: 'bold' };
const progressBarContainer: React.CSSProperties = { width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' };
const progressBar: React.CSSProperties = { height: '100%', transition: 'width 0.5s ease-in-out', boxShadow: '0 0 10px var(--accent)' };
const statusContainer: React.CSSProperties = { marginBottom: '30px' };
const currentStepTitle: React.CSSProperties = { margin: '0 0 8px 0', fontSize: '1.1rem' };
const descriptionStyle: React.CSSProperties = { color: '#888', fontSize: '0.9rem', margin: 0 };
const stepsList: React.CSSProperties = { textAlign: 'left', marginBottom: '30px', padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '12px' };
const stepItem: React.CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '12px', fontSize: '0.9rem', transition: 'all 0.3s ease' };
const dotIndicator: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#444', marginRight: '12px' };
const doneIndicator: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4CAF50', marginRight: '12px' };
const activeIndicator: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', marginRight: '12px', boxShadow: '0 0 10px var(--accent)', animation: 'pulse 1.5s infinite' };
const infoFooter: React.CSSProperties = { borderTop: '1px solid #333', paddingTop: '20px', fontSize: '0.9rem', color: '#aaa' };
const errorStyle: React.CSSProperties = { backgroundColor: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: '#ff4444', fontSize: '0.9rem' };
const actionContainer: React.CSSProperties = { marginBottom: '30px' };
const primaryButton: React.CSSProperties = { width: '100%', padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' };
const nextButton: React.CSSProperties = { width: '100%', padding: '12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' };
const loadingText: React.CSSProperties = { color: 'var(--accent)', fontStyle: 'italic' };

export default InitialSync;
