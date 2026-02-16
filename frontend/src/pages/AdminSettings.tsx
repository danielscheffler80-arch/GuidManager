import React, { useState, useEffect } from 'react';
import { GuildService } from '../api/guildService';
import { useAuth } from '../contexts/AuthContext';
import { usePreferredGuild } from '../hooks/usePreferredGuild';

export default function AdminSettings() {
    const { user, isAdmin } = useAuth();
    const {
        guilds,
        selectedGuild,
        setSelectedGuild,
        loading: guildLoading
    } = usePreferredGuild();

    const [availableRanks, setAvailableRanks] = useState<{ id: number, name: string }[]>([]);
    const [adminRanks, setAdminRanks] = useState<number[]>([]);
    const [visibleRanks, setVisibleRanks] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [wowPath, setWowPath] = useState('');
    const [pathStatus, setPathStatus] = useState('');

    useEffect(() => {
        if (selectedGuild) {
            handleGuildSelect(selectedGuild);
        } else if (!guildLoading) {
            setLoading(false);
        }
    }, [selectedGuild, guildLoading]);

    // Removed the loadGuilds function as its logic is now handled by usePreferredGuild

    const handleGuildSelect = async (guild: any) => {
        if (!guild) return;
        setLoading(true);
        try {
            const data = await GuildService.getRanks(guild.id);
            if (data.success) {
                setAvailableRanks(data.ranks);
                setAdminRanks(data.currentAdminRanks || []);
                setVisibleRanks(data.currentVisibleRanks || []);
            }

            // Load current WoW Path from Electron config
            if ((window as any).electronAPI?.getConfig) {
                const config = await (window as any).electronAPI.getConfig();
                if (config.wowPath) setWowPath(config.wowPath);
            }
        } catch (err) {
            console.error('Failed to fetch guild ranks');
        } finally {
            setLoading(false);
        }
    };

    const toggleAdminRank = async (rankId: number) => {
        if (!selectedGuild) return;
        const newRanks = adminRanks.includes(rankId)
            ? adminRanks.filter(id => id !== rankId)
            : [...adminRanks, rankId];

        try {
            setSaving(true);
            const data = await GuildService.updateAdminRanks(selectedGuild.id, newRanks);
            if (data.success) setAdminRanks(newRanks);
        } catch (err) {
            console.error('Failed to update admin ranks');
        } finally {
            setSaving(false);
        }
    };

    const toggleVisibleRank = async (rankId: number) => {
        if (!selectedGuild) return;
        const newRanks = visibleRanks.includes(rankId)
            ? visibleRanks.filter(id => id !== rankId)
            : [...visibleRanks, rankId];

        try {
            setSaving(true);
            const data = await GuildService.updateVisibleRanks(selectedGuild.id, newRanks);
            if (data.success) setVisibleRanks(newRanks);
        } catch (err) {
            console.error('Failed to update visible ranks');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePath = async () => {
        if (!(window as any).electronAPI?.saveWoWPath) return;
        setPathStatus('Speichere...');
        try {
            const result = await (window as any).electronAPI.saveWoWPath(wowPath);
            if (result.success) {
                setPathStatus('Gespeichert & Addon installiert! ✅');
                setTimeout(() => setPathStatus(''), 3000);
            } else {
                setPathStatus('Fehler beim Speichern ❌');
            }
        } catch (e) {
            setPathStatus('Fehler: ' + e);
        }
    };

    // Ensure we have 10 ranks (0-9) even if API returns fewer
    const displayRanks = Array.from({ length: 10 }, (_, i) => {
        const found = availableRanks.find(r => r.id === i);
        return found || { id: i, name: `Rang ${i}` };
    });

    if (loading) return <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A330C9]"></div></div>;

    return (
        <div className="max-w-6xl mx-auto py-10 px-6">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent italic tracking-tight">Ränge & Admins</h1>
                    <p className="text-gray-500 mt-1">Verwalte Berechtigungen und Roster-Sichtbarkeit.</p>
                </div>
                <div className="flex flex-col gap-1 min-w-[240px]">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Gilde wählen</label>
                    <select
                        value={selectedGuild?.id || ''}
                        onChange={(e) => handleGuildSelect(guilds.find(g => g.id === Number(e.target.value)))}
                        className="p-3 bg-[#121214] border border-gray-800 rounded-xl text-sm text-gray-300 outline-none focus:border-[#A330C9] transition-all"
                    >
                        {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '20px' }}>
                {displayRanks.map(rank => {
                    const isAdminRank = rank.id === 0 || adminRanks.includes(rank.id);
                    const isVisibleRank = visibleRanks.includes(rank.id);

                    return (
                        <div
                            key={rank.id}
                            style={{
                                background: '#1D1E1F',
                                padding: '8px 20px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                border: rank.id === 0 ? '1px solid #A330C9' : '1px solid #333',
                                transition: 'border-color 0.2s',
                            }}
                        >
                            {/* 1. Spalte: Sichtbarkeit-Checkbox (Position des Sterns) */}
                            <div style={{ width: '50px', flexShrink: 0 }}>
                                <div
                                    onClick={() => toggleVisibleRank(rank.id)}
                                    style={{
                                        cursor: 'pointer',
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        border: '2px solid',
                                        borderColor: isVisibleRank ? '#3B82F6' : '#333',
                                        background: isVisibleRank ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title={isVisibleRank ? 'Vom Roster entfernen' : 'Im Roster anzeigen'}
                                >
                                    {isVisibleRank && <span style={{ color: '#3B82F6', fontSize: '14px', fontWeight: '900' }}>✓</span>}
                                </div>
                            </div>

                            {/* 2. Spalte: Rang ID & Name */}
                            <div style={{ width: '220px', flexShrink: 0 }}>
                                <div style={{
                                    fontWeight: 'bold',
                                    fontSize: '1.1em',
                                    color: (isAdminRank || rank.id === 0) ? '#A330C9' : '#D1D9E0'
                                }}>
                                    Rang {rank.id}
                                </div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>
                                    {rank.name === 'Rank 0' ? 'Gildenleiter' : (rank.name || `Mitglied`)}
                                </div>
                            </div>

                            {/* 3. Spalte: Administrator Badge (Style wie "MAIN" Button in Settings.tsx) */}
                            <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <div
                                    onClick={() => rank.id !== 0 && toggleAdminRank(rank.id)}
                                    style={{
                                        cursor: rank.id === 0 ? 'default' : 'pointer',
                                        background: isAdminRank ? 'rgba(163, 48, 201, 0.2)' : 'transparent',
                                        color: isAdminRank ? '#A330C9' : '#444',
                                        padding: '6px 15px',
                                        borderRadius: '20px',
                                        fontSize: '0.75em',
                                        fontWeight: '900',
                                        border: isAdminRank ? '1px solid #A330C9' : '1px solid #444',
                                        letterSpacing: '1px',
                                        transition: 'all 0.2s',
                                        textAlign: 'center',
                                        minWidth: '120px'
                                    }}
                                >
                                    ADMINISTRATOR
                                </div>
                            </div>

                            {/* 4. Spalte: Status-Info */}
                            <div style={{ flex: 1, paddingLeft: '20px' }}>
                                {rank.id === 0 ? (
                                    <span style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic' }}>Systemleiter (Permanent)</span>
                                ) : (
                                    <span style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic' }}>
                                        {isAdminRank ? 'Berechtigt zum Editieren' : 'Eingeschränkt'}
                                    </span>
                                )}
                            </div>

                            {/* 5. Spalte: Visibility Label */}
                            <div style={{ width: '130px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                                {isVisibleRank ? (
                                    <span style={{
                                        color: '#3B82F6', padding: '6px 15px',
                                        fontSize: '0.75em', fontWeight: '900',
                                        letterSpacing: '1px'
                                    }}>SICHTBAR</span>
                                ) : (
                                    <span style={{
                                        color: '#444', padding: '6px 15px',
                                        fontSize: '0.75em', fontWeight: 'bold'
                                    }}>VERBORGEN</span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* WoW Path Configuration attached at the bottom */}
                <div style={{
                    marginTop: '30px',
                    background: '#1D1E1F',
                    padding: '15px 25px',
                    borderRadius: '10px',
                    border: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>WoW Pfad für Addon-Installation</div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={wowPath}
                                onChange={(e) => setWowPath(e.target.value)}
                                placeholder="z.B. C:\Games\World of Warcraft"
                                style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    color: '#D1D9E0',
                                    fontSize: '0.9em',
                                    outline: 'none',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <button
                                onClick={handleSavePath}
                                style={{
                                    background: '#A330C9',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 20px',
                                    fontWeight: 'bold',
                                    fontSize: '0.9em',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.2)'}
                                onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                            >
                                Speichern
                            </button>
                        </div>
                        {pathStatus && <p style={{ marginTop: '8px', fontSize: '0.8em', color: '#1EFF00', fontWeight: 'bold' }}>{pathStatus}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
