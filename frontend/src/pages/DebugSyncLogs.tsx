import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugSyncLogs: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const { backendUrl, user } = useAuth();

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${backendUrl}/api/sync/debug/logs`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data.logs);
                }
            } catch (e) {
                console.error('Failed to fetch logs', e);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [backendUrl]);

    // Force scroll to bottom on new logs
    useEffect(() => {
        const container = document.getElementById('log-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [logs]);

    if (!user || String(user.battlenetId) !== '100379014') {
        return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>Nur für Superuser zugänglich.</div>;
    }

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1 style={titleStyle}>Sync Log Debugger</h1>
                    <span style={pulsatingDot}></span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Live Polling active</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    User: {user.battletag} | Backend: {backendUrl}
                </div>
            </div>

            <div id="log-container" style={logContainerStyle}>
                {logs.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#555' }}>
                        Warte auf Synchronisations-Logs...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={logItemStyle}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                <span style={batchStyle(log.phase)}>Phase {log.phase}</span>
                                <span style={categoryStyle(log.category)}>{log.category}</span>
                                <span style={{ color: '#666', fontSize: '0.75rem' }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#eee' }}>{log.message}</div>
                            {log.data && (
                                <pre style={dataStyle}>
                                    {JSON.stringify(log.data, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))
                )}
            </div>

            <style>{`
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
            `}</style>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = { height: '100vh', backgroundColor: '#0f0f0f', color: '#D1D9E0', display: 'flex', flexDirection: 'column', fontFamily: 'monospace' };
const headerStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' };
const pulsatingDot: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 1.5s infinite' };
const logContainerStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '20px' };
const logItemStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #222', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px', marginBottom: '8px' };
const dataStyle: React.CSSProperties = { marginTop: '10px', padding: '12px', backgroundColor: '#000', color: '#10b981', borderRadius: '6px', overflowX: 'auto', fontSize: '0.8rem', border: '1px solid #222' };

const batchStyle = (phase: number) => ({ padding: '2px 8px', borderRadius: '4px', backgroundColor: phase === 1 ? '#2563eb' : phase === 2 ? '#7c3aed' : phase === 3 ? '#db2777' : '#059669', color: 'white', fontSize: '0.7rem', fontWeight: 800 });
const categoryStyle = (cat: string) => ({ padding: '2px 8px', borderRadius: '4px', border: `1px solid ${cat === 'ERROR' ? '#ef4444' : cat.includes('API') ? '#3b82f6' : '#10b981'}`, color: cat === 'ERROR' ? '#ef4444' : cat.includes('API') ? '#3b82f6' : '#10b981', fontSize: '0.7rem', fontWeight: 600 });

export default DebugSyncLogs;
