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

    const [activeRank, setActiveRank] = useState(0);

    // Ensure we have 10 ranks (0-9) even if API returns fewer
    const displayRanks = Array.from({ length: 10 }, (_, i) => {
        const found = availableRanks.find(r => r.id === i);
        return found || { id: i, name: `Rang ${i}` };
    });

    if (loading) return <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A330C9]"></div></div>;

    const currentRank = displayRanks.find(r => r.id === activeRank) || displayRanks[0];
    const isAdminRank = activeRank === 0 || adminRanks.includes(activeRank);
    const isVisibleRank = visibleRanks.includes(activeRank);

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

            {/* Registerkarten (Tabs) für Ränge */}
            <div className="flex flex-wrap gap-2 mb-8 p-2 bg-black/20 rounded-2xl border border-gray-800/50">
                {displayRanks.map(rank => (
                    <button
                        key={rank.id}
                        onClick={() => setActiveRank(rank.id)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeRank === rank.id
                            ? 'bg-[#A330C9] text-white shadow-[0_0_20px_rgba(163,48,201,0.3)] scale-105'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        Rang {rank.id}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Linke Seite: Rang-Details & Actions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card-premium p-8 bg-gradient-to-br from-[#121214] to-[#1a1a1e] border border-gray-800 rounded-2xl shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="w-20 h-20 bg-[#A330C9]/10 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-[#A330C9]/20 font-black text-[#A330C9]">
                                {activeRank}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                    {currentRank.name === 'Rank 0' ? 'Gildenleiter' : currentRank.name}
                                </h2>
                                <p className="text-gray-500 text-sm">Einstellungen für diesen Rang anpassen.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Admin Checkbox Card */}
                            <div
                                onClick={() => activeRank !== 0 && toggleAdminRank(activeRank)}
                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group ${isAdminRank ? 'bg-[#A330C9]/10 border-[#A330C9]/40' : 'bg-white/5 border-transparent hover:border-gray-700'
                                    } ${activeRank === 0 ? 'opacity-50 !cursor-default' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-2xl">🛡️</span>
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isAdminRank ? 'bg-[#A330C9] border-[#A330C9]' : 'border-gray-700'}`}>
                                        {isAdminRank && <span className="text-white text-[10px]">✓</span>}
                                    </div>
                                </div>
                                <h4 className="font-bold text-white mb-1">Administrator</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">Erlaubt den Zugriff auf Gilden-Einstellungen, Raids und Rollen-Management.</p>
                            </div>

                            {/* Visibility Checkbox Card */}
                            <div
                                onClick={() => toggleVisibleRank(activeRank)}
                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer group ${isVisibleRank ? 'bg-blue-500/10 border-blue-500/40' : 'bg-white/5 border-transparent hover:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-2xl">👁️</span>
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isVisibleRank ? 'bg-blue-500 border-blue-500' : 'border-gray-700'}`}>
                                        {isVisibleRank && <span className="text-white text-[10px]">✓</span>}
                                    </div>
                                </div>
                                <h4 className="font-bold text-white mb-1">Roster-Sichtbarkeit</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">Mitglieder dieses Ranges werden standardmäßig im Haupt-Roster (Gilden-Übersicht) angezeigt.</p>
                            </div>
                        </div>

                        {activeRank === 0 && (
                            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
                                <span className="text-xl">⚠️</span>
                                <p className="text-[11px] text-yellow-500/80 font-medium">
                                    Der Gildenleiter (Rang 0) ist systemkritisch und besitzt permanenten Administrator-Zugriff.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* WoW Path Configuration moved here for layout balance */}
                    <div className="p-6 bg-[#1D1E1F] border border-gray-800 rounded-2xl shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="text-blue-400">📂</span> WoW Pfad (Addon)
                        </h3>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={wowPath}
                                onChange={(e) => setWowPath(e.target.value)}
                                placeholder="z.B. E:\World of Warcraft"
                                className="flex-1 p-3 bg-black/30 border border-gray-700 rounded-xl text-gray-300 outline-none focus:border-[#A330C9] transition-all font-mono text-xs"
                            />
                            <button
                                onClick={handleSavePath}
                                className="px-5 py-3 bg-[#121214] border border-gray-700 hover:border-[#A330C9] text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                            >
                                Speichern
                            </button>
                        </div>
                        {pathStatus && <p className="mt-2 text-[10px] text-green-400 font-bold animate-pulse">{pathStatus}</p>}
                    </div>
                </div>

                {/* Rechte Seite: Info / Quick Stats */}
                <div className="space-y-6">
                    <div className="card-premium p-6 bg-[#121214]/50 border border-gray-800 rounded-2xl">
                        <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs opacity-50">Zusammenfassung</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Admins:</span>
                                <span className="text-[#A330C9] font-black">{adminRanks.length + 1}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Sichtbare Ränge:</span>
                                <span className="text-blue-400 font-black">{visibleRanks.length}</span>
                            </div>
                            <div className="pt-4 border-t border-gray-800">
                                <p className="text-[10px] text-gray-600 leading-relaxed italic">
                                    Änderungen werden sofort in der Datenbank gespeichert und sind für alle Gildenmitglieder nach einem Refresh sichtbar.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl">
                        <h4 className="font-bold text-blue-400 text-sm mb-2">Tipp</h4>
                        <p className="text-xs text-gray-500 leading-normal">
                            Nutze die Roster-Sichtbarkeit, um nur Raider und Offiziere anzuzeigen. Social-Ränge oder Twinks können so aus der Hauptansicht ausgeblendet werden.
                        </p>
                    </div>
                </div>
            </div>
        </div >
    );
}
