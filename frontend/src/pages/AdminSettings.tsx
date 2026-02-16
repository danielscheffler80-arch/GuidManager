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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main List Section */}
                <div className="lg:col-span-3">
                    {/* Header for the list */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-black/20 rounded-t-xl border-x border-t border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <div className="col-span-1">ID</div>
                        <div className="col-span-5">Rang Name</div>
                        <div className="col-span-3 text-center">Administrator</div>
                        <div className="col-span-3 text-center">Sichtbarkeit</div>
                    </div>

                    {/* Rank Rows with 4px gap */}
                    <div className="flex flex-col gap-[4px] mt-[4px]">
                        {displayRanks.map(rank => {
                            const isAdminRank = rank.id === 0 || adminRanks.includes(rank.id);
                            const isVisibleRank = visibleRanks.includes(rank.id);

                            return (
                                <div
                                    key={rank.id}
                                    className={`grid grid-cols-12 gap-4 px-6 py-3 bg-[#1D1E1F] border border-gray-800/50 rounded-lg items-center transition-all hover:bg-[#242526] ${rank.id === 0 ? 'border-l-4 border-l-[#A330C9]' : ''
                                        }`}
                                >
                                    {/* ID */}
                                    <div className="col-span-1 font-mono text-[#A330C9] font-black">{rank.id}</div>

                                    {/* Name */}
                                    <div className="col-span-5">
                                        <span className={`font-bold text-sm ${isAdminRank ? 'text-white' : 'text-gray-400'}`}>
                                            {rank.name === 'Rank 0' ? 'Gildenleiter' : (rank.name || `Rang ${rank.id}`)}
                                        </span>
                                    </div>

                                    {/* Admin Checkbox */}
                                    <div className="col-span-3 flex justify-center">
                                        <div
                                            onClick={() => rank.id !== 0 && toggleAdminRank(rank.id)}
                                            className={`p-1.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${isAdminRank ? 'bg-[#A330C9]/10 border-[#A330C9]/40' : 'bg-black/20 border-gray-800 grayscale opacity-40 hover:grayscale-0 hover:opacity-100'
                                                } ${rank.id === 0 ? 'cursor-default' : 'active:scale-95'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isAdminRank ? 'bg-[#A330C9] border-[#A330C9]' : 'border-gray-700'}`}>
                                                {isAdminRank && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Admin</span>
                                        </div>
                                    </div>

                                    {/* Visibility Checkbox */}
                                    <div className="col-span-3 flex justify-center">
                                        <div
                                            onClick={() => toggleVisibleRank(rank.id)}
                                            className={`p-1.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${isVisibleRank ? 'bg-blue-500/10 border-blue-500/40' : 'bg-black/20 border-gray-800 grayscale opacity-40 hover:grayscale-0 hover:opacity-100'
                                                } active:scale-95`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isVisibleRank ? 'bg-blue-500 border-blue-500' : 'border-gray-700'}`}>
                                                {isVisibleRank && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Visible</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar Section */}
                <div className="space-y-4">
                    <div className="p-6 bg-[#1D1E1F] border border-gray-800 rounded-2xl">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Einstellungen</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">WoW Pfad (Addon)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={wowPath}
                                        onChange={(e) => setWowPath(e.target.value)}
                                        className="flex-1 p-2 bg-black/40 border border-gray-800 rounded-lg text-gray-400 outline-none focus:border-[#A330C9] text-[10px] font-mono"
                                    />
                                    <button
                                        onClick={handleSavePath}
                                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-[10px]"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-gray-500">Admins:</span>
                                    <span className="text-[#A330C9] font-black text-xs">{adminRanks.length + 1}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500">Visible:</span>
                                    <span className="text-blue-400 font-black text-xs">{visibleRanks.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                        <p className="text-[10px] text-gray-500 leading-relaxed italic">
                            Änderungen werden sofort gespeichert. Sichtbare Ränge werden im Haupt-Roster priorisiert angezeigt.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
