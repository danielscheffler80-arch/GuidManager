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
            if (window.electronAPI?.getConfig) {
                const config = await window.electronAPI.getConfig();
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
        if (!window.electronAPI?.saveWoWPath) return;
        setPathStatus('Speichere...');
        try {
            const result = await window.electronAPI.saveWoWPath(wowPath);
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

    if (loading) return <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A330C9]"></div></div>;

    return (
        <div className="max-w-6xl mx-auto py-10 px-6">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent italic tracking-tight">Ränge & Admins</h1>
                    <p className="text-gray-500 mt-1">Verwalte Berechtigungen und Roster-Sichtbarkeit für deine Gilde.</p>
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

            {/* WoW Path Configuration */}
            <div className="mb-8 p-6 bg-[#1D1E1F] border border-gray-800 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-blue-400">📂</span> WoW Pfad Konfiguration
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                    Falls das Addon nicht automatisch installiert wurde, gib hier bitte den Pfad zu deinem
                    <code>World of Warcraft</code> Ordner an (nicht _retail_).
                </p>
                <div className="flex gap-4">
                    <input
                        type="text"
                        value={wowPath}
                        onChange={(e) => setWowPath(e.target.value)}
                        placeholder="z.B. E:\World of Warcraft"
                        className="flex-1 p-3 bg-black/30 border border-gray-700 rounded-xl text-gray-300 outline-none focus:border-blue-500 transition-all font-mono text-sm"
                    />
                    <button
                        onClick={handleSavePath}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        Speichern & Installieren
                    </button>
                </div>
                {pathStatus && <p className="mt-2 text-sm text-green-400 font-bold animate-pulse">{pathStatus}</p>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Admin Ranks Section */}
                <div className="card-premium p-8 bg-gradient-to-br from-[#121214] to-[#1a1a1e] border border-gray-800 rounded-2xl shadow-2xl hover:border-[#A330C9]/40 transition-all group/card relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#A330C9]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card:bg-[#A330C9]/10 transition-colors"></div>

                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="w-12 h-12 bg-[#A330C9]/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-[#A330C9]/20">🛡️</div>
                        <div>
                            <h3 className="font-bold text-xl text-white tracking-tight">Admins & Leiter</h3>
                            <p className="text-xs text-gray-500">Diese Ränge besitzen volle administrative Privilegien.</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                        {availableRanks.map(rank => {
                            const isActive = rank.id === 0 || adminRanks.includes(rank.id);
                            return (
                                <label
                                    key={rank.id}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${isActive ? 'bg-[#A330C9]/10 border-[#A330C9]/40 shadow-[0_0_15px_rgba(163,48,201,0.1)]' : 'bg-white/5 border-transparent hover:border-gray-700'
                                        } ${rank.id === 0 ? 'opacity-50 cursor-default' : 'hover:scale-[1.01]'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                disabled={rank.id === 0 || saving}
                                                onChange={() => toggleAdminRank(rank.id)}
                                                className="w-5 h-5 rounded border-gray-700 bg-black/40 text-[#A330C9] focus:ring-[#A330C9] focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:bg-[#A330C9] border-2"
                                            />
                                            {isActive && <span className="absolute text-white text-[10px] pointer-events-none">✓</span>}
                                        </div>
                                        <div>
                                            <span className={`font-bold text-sm ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                Rang {rank.id}: <span className="font-medium">{rank.name === 'Rank 0' ? 'Gildenleiter' : rank.name}</span>
                                            </span>
                                        </div>
                                    </div>
                                    {isActive && (
                                        <span className="text-[9px] bg-[#A330C9]/20 text-[#A330C9] px-2 py-1 rounded-md uppercase font-black tracking-widest border border-[#A330C9]/30">
                                            Authorized
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    <p className="mt-8 text-[11px] text-gray-600 font-medium italic border-t border-gray-800/30 pt-4 relative z-10">
                        * Der Gildenleiter (Rang 0) ist systemkritisch und besitzt permanenten Zugriff.
                    </p>
                </div>

                {/* Visibility Ranks Section */}
                <div className="card-premium p-8 bg-gradient-to-br from-[#121214] to-[#1a1a1e] border border-gray-800 rounded-2xl shadow-2xl hover:border-blue-500/40 transition-all group/card relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card:bg-blue-500/10 transition-colors"></div>

                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-blue-500/20">👁️</div>
                        <div>
                            <h3 className="font-bold text-xl text-white tracking-tight">Roster-Sichtbarkeit</h3>
                            <p className="text-xs text-gray-500">Definition des Kern-Rosters für die öffentliche Ansicht.</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                        {availableRanks.map(rank => {
                            const isVisible = visibleRanks.includes(rank.id);
                            return (
                                <label
                                    key={rank.id}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${isVisible ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-white/5 border-transparent hover:border-gray-700'
                                        } hover:scale-[1.01]`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={isVisible}
                                                disabled={saving}
                                                onChange={() => toggleVisibleRank(rank.id)}
                                                className="w-5 h-5 rounded border-gray-700 bg-black/40 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:bg-blue-500 border-2"
                                            />
                                            {isVisible && <span className="absolute text-white text-[10px] pointer-events-none">✓</span>}
                                        </div>
                                        <div>
                                            <span className={`font-bold text-sm ${isVisible ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                Rang {rank.id}: <span className="font-medium">{rank.name === 'Rank 0' ? 'Gildenleiter' : rank.name}</span>
                                            </span>
                                        </div>
                                    </div>
                                    {isVisible && (
                                        <span className="text-[9px] bg-blue-500/20 text-blue-500 px-2 py-1 rounded-md uppercase font-black tracking-widest border border-blue-500/30">
                                            Visible
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    <p className="mt-8 text-[11px] text-gray-600 font-medium italic border-t border-gray-800/30 pt-4 relative z-10">
                        * Gewählte Ränge werden im Haupt-Roster (Gilden-Roster) priorisiert angezeigt.
                    </p>
                </div>
            </div>
        </div >
    );
}
