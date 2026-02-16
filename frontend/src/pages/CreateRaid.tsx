import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RaidService } from '../api/raidService';
import { useAuth } from '../contexts/AuthContext';
import { usePreferredGuild } from '../hooks/usePreferredGuild';

export default function CreateRaid() {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const {
        guilds,
        selectedGuild,
        setSelectedGuild,
        loading: guildLoading
    } = usePreferredGuild();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newRaid, setNewRaid] = useState({
        title: '',
        description: '',
        difficulty: 'Normal',
        startTime: '',
        maxPlayers: 20,
        recruitmentType: 'everyone',
        allowedRanks: [] as number[],
        isRecurring: false,
        recurrenceWeeks: 4,
        imageUrl: 'https://wow.zamimg.com/uploads/screenshots/normal/1167440.jpg'
    });

    const RAID_IMAGES = [
        { name: 'Nerub-ar Palace', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1167440.jpg' },
        { name: 'Amirdrassil', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1126780.jpg' },
        { name: 'Aberrus', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1105423.jpg' },
        { name: 'Vault of the Incarnates', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1083424.jpg' },
        { name: 'Generic', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1167439.jpg' }
    ];

    useEffect(() => {
        if (!isAdmin && !guildLoading) {
            navigate('/dashboard');
            return;
        }
        if (!guildLoading) {
            // Default start time to tomorrow 20:00
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(20, 0, 0, 0);
            const tzOffset = tomorrow.getTimezoneOffset() * 60000;
            const startTimeStr = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
            setNewRaid(prev => ({ ...prev, startTime: startTimeStr }));
            setLoading(false);
        }
    }, [isAdmin, guildLoading]);


    const handleCreateRaid = async () => {
        if (!selectedGuild) return;
        setSaving(true);
        try {
            await RaidService.createRaid(selectedGuild.id, newRaid);
            navigate('/raids');
            navigate('/raids'); // Redirect to calendar
        } catch (error) {
            console.error('Failed to create raid');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#A330C9]"></div></div>;

    return (
        <div className="max-w-2xl mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent italic tracking-tight">Raid planen</h1>
                <p className="text-gray-500 mt-1 font-medium">Erstelle einen neuen Raid-Termin für deine Gilde.</p>
            </header>

            <div className="card-premium p-8 bg-gradient-to-br from-[#121214] to-[#1a1a1e] border border-gray-800 rounded-2xl shadow-2xl space-y-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#A330C9]/5 blur-3xl rounded-full -mr-24 -mt-24 group-hover:bg-[#A330C9]/10 transition-colors pointer-events-none"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Gilde auswählen</label>
                        <select
                            value={selectedGuild?.id || ''}
                            onChange={(e) => {
                                const guild = guilds.find(g => g.id === Number(e.target.value));
                                setSelectedGuild(guild);
                                if (guild) localStorage.setItem('selectedGuildId', guild.id.toString());
                            }}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl p-3.5 text-sm text-gray-200 focus:border-[#A330C9] outline-none transition-all hover:border-gray-700"
                        >
                            {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Raid Titel</label>
                        <input
                            type="text"
                            value={newRaid.title}
                            onChange={e => setNewRaid({ ...newRaid, title: e.target.value })}
                            placeholder="z.B. Liberat-Sanktum Mythisch"
                            className="w-full bg-black/40 border border-gray-800 rounded-xl p-3.5 text-sm text-white placeholder-gray-700 focus:border-[#A330C9] outline-none transition-all hover:border-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Schwierigkeit</label>
                        <select
                            value={newRaid.difficulty}
                            onChange={e => setNewRaid({ ...newRaid, difficulty: e.target.value })}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl p-3.5 text-sm text-gray-200 focus:border-[#A330C9] outline-none transition-all hover:border-gray-700"
                        >
                            <option value="LFR">LFR (Looking For Raid)</option>
                            <option value="Normal">Normal</option>
                            <option value="Heroisch">Heroisch</option>
                            <option value="Mythisch">Mythisch</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Max. Spieler</label>
                        <input
                            type="number"
                            value={newRaid.maxPlayers}
                            onChange={e => setNewRaid({ ...newRaid, maxPlayers: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl p-3.5 text-sm text-white focus:border-[#A330C9] outline-none transition-all hover:border-gray-700"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Startdatum & Uhrzeit</label>
                        <input
                            type="datetime-local"
                            value={newRaid.startTime}
                            onChange={e => setNewRaid({ ...newRaid, startTime: e.target.value })}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl p-3.5 text-sm text-white focus:border-[#A330C9] outline-none transition-all hover:border-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Hintergrund-Grafik</label>
                        <select
                            value={newRaid.imageUrl}
                            onChange={e => setNewRaid({ ...newRaid, imageUrl: e.target.value })}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl p-3.5 text-sm text-gray-200 focus:border-[#A330C9] outline-none transition-all hover:border-gray-700"
                        >
                            {RAID_IMAGES.map(img => (
                                <option key={img.url} value={img.url}>{img.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="h-[100px] w-full max-w-[200px] rounded-lg overflow-hidden border border-gray-800 relative">
                            <img src={newRaid.imageUrl} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">Berechtigte Ränge</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-black/20 border border-gray-800 rounded-2xl max-h-48 overflow-y-auto custom-scrollbar">
                        {selectedGuild?.ranks ? (selectedGuild.ranks as any[]).map((rank: any) => {
                            const isSelected = newRaid.allowedRanks.includes(rank.id);
                            return (
                                <label key={rank.id} className={`flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer group/rank ${isSelected ? 'bg-[#A330C9]/10 border-[#A330C9]/40 text-white' : 'bg-transparent border-transparent text-gray-500 hover:border-gray-800 hover:bg-white/5'}`}>
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                const ranks = e.target.checked
                                                    ? [...newRaid.allowedRanks, rank.id]
                                                    : newRaid.allowedRanks.filter(r => r !== rank.id);
                                                setNewRaid({ ...newRaid, allowedRanks: ranks });
                                            }}
                                            className="w-4 h-4 rounded border-gray-700 bg-black/40 text-[#A330C9] focus:ring-[#A330C9] transition-all appearance-none checked:bg-[#A330C9] border-2"
                                        />
                                        {isSelected && <span className="absolute text-white text-[8px] pointer-events-none">✓</span>}
                                    </div>
                                    <span className="text-xs font-bold truncate group-hover/rank:text-gray-200">
                                        Rang {rank.id}: <span className="font-medium">{rank.name}</span>
                                    </span>
                                </label>
                            );
                        }) : <p className="text-xs text-gray-600 italic p-2">Keine Ränge geladen</p>}
                    </div>
                </div>

                <div className="p-6 bg-gradient-to-r from-[#A330C9]/5 to-transparent border border-[#A330C9]/20 rounded-2xl relative z-10">
                    <label className="flex items-center gap-4 cursor-pointer group/rec">
                        <div className="relative flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={newRaid.isRecurring}
                                onChange={e => setNewRaid({ ...newRaid, isRecurring: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-700 bg-black/40 text-[#A330C9] focus:ring-[#A330C9] transition-all appearance-none checked:bg-[#A330C9] border-2"
                            />
                            {newRaid.isRecurring && <span className="absolute text-white text-[10px] pointer-events-none">✓</span>}
                        </div>
                        <span className="text-sm font-black text-white uppercase tracking-widest">Wöchentlich wiederholen</span>
                    </label>
                    {newRaid.isRecurring && (
                        <div className="mt-6 flex items-center gap-5 animate-in fade-in slide-in-from-top-2 duration-400 p-3 bg-black/20 rounded-xl border border-gray-800/50">
                            <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Zeitraum:</span>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1" max="12"
                                    value={newRaid.recurrenceWeeks}
                                    onChange={e => setNewRaid({ ...newRaid, recurrenceWeeks: Number(e.target.value) })}
                                    className="w-16 bg-black/40 border border-gray-700 rounded-lg p-2 text-center text-sm font-bold text-[#A330C9]"
                                />
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Wochen insgesamt</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative z-10">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Zusätzliche Infos</label>
                    <textarea
                        value={newRaid.description}
                        onChange={e => setNewRaid({ ...newRaid, description: e.target.value })}
                        rows={3}
                        className="w-full bg-black/40 border border-gray-800 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-700 focus:border-[#A330C9] outline-none resize-none transition-all hover:border-gray-700"
                        placeholder="Mitzubringende Items, Raid-Planung, Taktik-Hinweise..."
                    />
                </div>

                <div className="flex gap-4 pt-6 relative z-10">
                    <button
                        onClick={() => navigate('/raids')}
                        className="flex-1 py-4 bg-transparent border border-gray-800 hover:border-gray-600 hover:bg-white/5 text-gray-500 font-bold rounded-2xl transition-all uppercase tracking-widest text-xs"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleCreateRaid}
                        disabled={saving || !newRaid.title || !newRaid.startTime}
                        className="flex-[2] py-4 bg-[#A330C9] hover:bg-[#A330C9]/80 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-[#A330C9]/20"
                    >
                        {saving ? 'Raids werden generiert...' : 'Raid jetzt veröffentlichen'}
                    </button>
                </div>
            </div>
        </div>
    );
}
