import React, { useState, useEffect } from 'react';
import { GuildService } from '../api/guildService';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';

export default function AdminSettings() {
    const { user, isAdmin } = useAuth();
    const { guilds, selectedGuild, setSelectedGuild, loading: guildLoading, refreshRosters } = useGuild();

    const [availableRanks, setAvailableRanks] = useState<{ id: number, name: string }[]>([]);
    const [adminRanks, setAdminRanks] = useState<number[]>([]);
    const [visibleRanks, setVisibleRanks] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [wowPath, setWowPath] = useState('');
    const [pathStatus, setPathStatus] = useState('');
    const [rosters, setRosters] = useState<any[]>([]);
    const [editingRoster, setEditingRoster] = useState<any>(null);
    const [newRosterName, setNewRosterName] = useState('');
    const [newRosterRanks, setNewRosterRanks] = useState<number[]>([]);

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

            // Fetch Rosters
            const rosterData = await GuildService.getRosters(guild.id);
            if (rosterData.success) {
                setRosters(rosterData.rosters || []);
            }
        } catch (err) {
            console.error('Failed to update settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRoster = async () => {
        if (!selectedGuild || !newRosterName) return;
        try {
            setSaving(true);
            const data = await GuildService.saveRoster(selectedGuild.id, {
                id: editingRoster?.id,
                name: newRosterName,
                allowedRanks: newRosterRanks
            });
            if (data.success) {
                // Refresh rosters
                const rData = await GuildService.getRosters(selectedGuild.id);
                setRosters(rData.rosters || []);
                await refreshRosters();
                setEditingRoster(null);
                setNewRosterName('');
                setNewRosterRanks([]);
            }
        } catch (err) {
            console.error('Failed to save roster');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRoster = async (rosterId: number) => {
        if (!selectedGuild) return;
        if (!window.confirm('Roster wirklich löschen?')) return;
        try {
            setSaving(true);
            await GuildService.deleteRoster(selectedGuild.id, rosterId);
            setRosters(prev => prev.filter(r => r.id !== rosterId));
            await refreshRosters();
        } catch (err) {
            console.error('Failed to delete roster');
        } finally {
            setSaving(false);
        }
    };

    const startEditRoster = (roster: any) => {
        setEditingRoster(roster);
        setNewRosterName(roster.name);
        setNewRosterRanks(roster.allowedRanks || []);
        // Scroll to form
        document.getElementById('roster-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    const toggleRosterRank = (rankId: number) => {
        setNewRosterRanks(prev =>
            prev.includes(rankId) ? prev.filter(id => id !== rankId) : [...prev, rankId]
        );
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

    if (loading) return <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[var(--accent)]"></div></div>;

    return (
        <div className="page-container">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4 p-2 bg-black/20 rounded-2xl">
                <div className="flex items-center gap-3 px-3">
                    <span className="text-lg">⚙️</span>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90">Gilden-Verwaltung</span>
                </div>
                <div className="flex gap-4 items-center">
                    {/* Gilden-Auswahl wurde in die Topbar verschoben */}
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
                                padding: '8px 16px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'border-color 0.2s',
                                width: '100%',
                                boxSizing: 'border-box'
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
                                    color: (isAdminRank || rank.id === 0) ? 'var(--accent)' : '#D1D9E0'
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
                                        color: isAdminRank ? 'var(--accent)' : '#444',
                                        padding: '6px 15px',
                                        borderRadius: '20px',
                                        fontSize: '0.75em',
                                        fontWeight: '900',
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
                                    <span style={{ color: '#666', fontSize: '0.8em' }}>Systemleiter (Permanent)</span>
                                ) : (
                                    <span style={{ color: '#666', fontSize: '0.8em' }}>
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

                {/* --- ROSTER MANAGEMENT SECTION --- */}
                <div style={{ marginTop: '40px' }}>
                    <header className="mb-6 flex items-center gap-3 px-3 py-2 bg-black/20 rounded-2xl">
                        <span className="text-lg">🛡️</span>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90">Roster Definitionen</span>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* List existing rosters */}
                        <div className="space-y-4">
                            {rosters.map(roster => (
                                <div key={roster.id} className="bg-[#1D1E1F] p-5 rounded-2xl border border-white/5 flex justify-between items-center group">
                                    <div>
                                        <h4 className="font-black text-white uppercase tracking-tight">{roster.name}</h4>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                            {roster.allowedRanks?.length || 0} Ränge enthalten
                                        </p>
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                            {roster.allowedRanks?.map((rid: number) => (
                                                <span key={rid} className="px-2 py-0.5 bg-black/40 rounded text-[9px] text-gray-400 font-mono">
                                                    Rang {rid}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEditRoster(roster)}
                                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                                            title="Editieren"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRoster(roster.id)}
                                            className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                            title="Löschen"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {rosters.length === 0 && (
                                <div className="p-10 text-center border-2 border-dashed border-white/5 rounded-3xl text-gray-700 text-xs font-bold uppercase tracking-widest">
                                    Noch keine Roster definiert
                                </div>
                            )}
                        </div>

                        {/* Create/Edit Form */}
                        <div id="roster-form" className="bg-[#1D1E1F] p-6 rounded-2xl border-2 border-[var(--accent)]/20">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)] mb-6">
                                {editingRoster ? 'Roster editieren' : 'Neues Roster erstellen'}
                            </h4>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-2 mb-2 block">Name (z.B. Main-Roster)</label>
                                    <input
                                        type="text"
                                        value={newRosterName}
                                        onChange={e => setNewRosterName(e.target.value)}
                                        placeholder="Name eingeben..."
                                        className="w-full bg-black/20 rounded-xl px-4 py-3 text-sm font-medium outline-none border border-white/5 focus:border-[var(--accent)]/50 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-2 mb-3 block">Zugeordnete Ränge</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {displayRanks.map(rank => {
                                            const isActive = newRosterRanks.includes(rank.id);
                                            return (
                                                <button
                                                    key={rank.id}
                                                    onClick={() => toggleRosterRank(rank.id)}
                                                    className={`px-3 py-2 rounded-xl text-left text-[10px] font-bold transition-all border ${isActive
                                                        ? 'bg-[var(--accent)]/10 border-[var(--accent)] shadow-[0_0_10px_rgba(163,48,201,0.1)] text-white'
                                                        : 'bg-black/10 border-white/5 text-gray-600 hover:border-white/20'
                                                        }`}
                                                >
                                                    <span className="opacity-40 mr-2">#{rank.id}</span>
                                                    {rank.id === 0 ? 'Gildenleiter' : (rank.name || `Mitglied`)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSaveRoster}
                                        disabled={saving || !newRosterName}
                                        className="flex-1 py-4 bg-[var(--accent)] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Speichere...' : (editingRoster ? 'Update Speichern' : 'Roster Anlegen')}
                                    </button>
                                    {editingRoster && (
                                        <button
                                            onClick={() => { setEditingRoster(null); setNewRosterName(''); setNewRosterRanks([]); }}
                                            className="px-6 py-4 bg-white/5 text-gray-500 rounded-xl font-black uppercase tracking-widest text-[10px]"
                                        >
                                            Abbruch
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* WoW Path Configuration attached at the bottom */}
                <div style={{
                    marginTop: '30px',
                    background: '#1D1E1F',
                    padding: '15px 25px',
                    borderRadius: '10px',
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
                                    background: 'var(--accent)',
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
