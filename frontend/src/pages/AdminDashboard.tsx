import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { openInternalWindow } from '../utils/windowUtils';

const AdminDashboard: React.FC = () => {
    const { backendUrl, user } = useAuth();
    const navigate = useNavigate();
    const [wiping, setWiping] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const isSuperuser = String(user?.battlenetId) === '100379014';

    const handleFullReset = async () => {
        if (!window.confirm('--- ABSOLUTE GEFAHR ---\n\nDies wird das GESAMTE SYSTEM zurücksetzen:\n1. ALLE Gilden werden gelöscht.\n2. ALLE Charaktere werden gelöscht.\n3. ALLE Logs werden gelöscht.\n4. ALLE User müssen sich neu synchronisieren.\n\nBist du ABSOLUT sicher?')) return;

        setWiping(true);
        setStatus('System-Wipe wird ausgeführt...');
        try {
            const res = await fetch(`${backendUrl}/api/admin/system/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const data = await res.json();
            if (data.success) {
                setStatus('System erfolgreich zurückgesetzt! App startet neu...');
                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = '/';
                }, 3000);
            } else {
                setStatus('Fehler: ' + data.error);
                setWiping(false);
            }
        } catch (e: any) {
            setStatus('Fehler: ' + e.message);
            setWiping(false);
        }
    };

    if (!isSuperuser) {
        return <div style={{ color: '#ef4444', textAlign: 'center', padding: '100px', fontWeight: 'bold' }}>Zugriff verweigert.</div>;
    }

    return (
        <div style={containerStyle}>
            <header style={headerStyle}>
                <h1 style={titleStyle}>🛡️ Superuser Admin Control Center</h1>
                <p style={{ color: '#888', margin: '10px 0 0 0' }}>Willkommen zurück, {user?.battletag}. Du hast vollen Systemzugriff.</p>
            </header>

            <div style={gridStyle}>
                {/* Database Card */}
                <div style={cardStyle} onClick={() => navigate('/admin/database')}>
                    <div style={iconStyle}>☁️</div>
                    <h3 style={cardTitleStyle}>Cloud Database Explorer</h3>
                    <p style={cardDescStyle}>Direkter Zugriff auf alle Tabellen. Einträge ansehen, bearbeiten oder löschen.</p>
                    <button style={actionBtn}>Explorer öffnen</button>
                </div>

                {/* Sync Logs Card */}
                <div style={cardStyle} onClick={() => openInternalWindow('/debug-logs')}>
                    <div style={iconStyle}>📜</div>
                    <h3 style={cardTitleStyle}>Live Sync Debugger</h3>
                    <p style={cardDescStyle}>Echtzeit-Überwachung des Synchronisations-Prozesses in einem neuen Fenster.</p>
                    <button style={actionBtn}>Logs anzeigen</button>
                </div>

                {/* Reset Card */}
                <div style={{ ...cardStyle, borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ ...iconStyle, filter: 'none' }}>☢️</div>
                    <h3 style={{ ...cardTitleStyle, color: '#ef4444' }}>System-Wide Reset</h3>
                    <p style={cardDescStyle}>Löscht alle Daten außer User-Profile und erzwingt einen kompletten Neu-Sync.</p>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleFullReset(); }}
                        disabled={wiping}
                        style={{ ...actionBtn, backgroundColor: '#ef4444' }}
                    >
                        {wiping ? 'Daten werden vernichtet...' : 'Full Wipe & Restart'}
                    </button>
                </div>
            </div>

            {status && (
                <div style={statusBanner}>
                    {status}
                </div>
            )}

            <style>{`
                @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
            `}</style>
        </div>
    );
};

// Styles
const containerStyle: React.CSSProperties = { padding: '40px', maxWidth: '1200px', margin: '0 auto', color: '#D1D9E0', fontFamily: 'Inter, sans-serif' };
const headerStyle: React.CSSProperties = { marginBottom: '40px', textAlign: 'center' };
const titleStyle: React.CSSProperties = { fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, #a330c9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' };
const cardStyle: React.CSSProperties = { backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '20px', border: '1px solid #333', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };
const iconStyle: React.CSSProperties = { fontSize: '3rem', marginBottom: '20px', filter: 'drop-shadow(0 0 10px rgba(163, 48, 201, 0.5))' };
const cardTitleStyle: React.CSSProperties = { fontSize: '1.25rem', fontWeight: 800, marginBottom: '15px' };
const cardDescStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#888', lineHeight: '1.6', marginBottom: '25px', minHeight: '3em' };
const actionBtn: React.CSSProperties = { width: '100%', padding: '12px', backgroundColor: '#a330c9', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'filter 0.2s' };
const statusBanner: React.CSSProperties = { marginTop: '40px', padding: '20px', backgroundColor: 'rgba(163, 48, 201, 0.2)', border: '1px solid #a330c9', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', animation: 'pulse 2s infinite' };

export default AdminDashboard;
