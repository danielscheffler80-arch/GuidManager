import React, { useEffect, useState } from 'react';
import { CharacterService } from '../api/characterService';
import { MythicPlusService } from '../api/mythicPlusService';
import { capitalizeName, getClassColor } from '../utils/formatUtils';
import { useGuild } from '../contexts/GuildContext';
import { useAuth } from '../contexts/AuthContext';

interface SignupModalProps {
    selectedKey: any;
    onClose: () => void;
    onSuccess: () => void;
}

export const SignupModal: React.FC<SignupModalProps> = ({ selectedKey, onClose, onSuccess }) => {
    const { selectedGuild } = useGuild();
    const { user } = useAuth();
    const [myCharacters, setMyCharacters] = useState<any[]>([]);
    const [signups, setSignups] = useState<any[]>(selectedKey.signups || []);
    const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
    const [primaryRole, setPrimaryRole] = useState<string>('DPS');
    const [secondaryRole, setSecondaryRole] = useState<string>('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const isOwner = selectedKey.character?.userId === user?.id;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const charData = await CharacterService.getMyCharacters();
            const chars = charData.user?.characters || [];
            // Hide own keyholder chars from selection if someone else's key
            // Actually, just show main + favorites for selection
            const filtered = chars.filter((c: any) => c.isMain || c.isFavorite);
            setMyCharacters(filtered);

            const main = filtered.find((c: any) => c.isMain);
            if (main) setSelectedCharId(main.id);
            else if (filtered.length > 0) setSelectedCharId(filtered[0].id);

            // Fetch latest signups for this key
            if (selectedGuild) {
                const guildKeys = await MythicPlusService.getGuildKeys(selectedGuild.id);
                // Find this specific key in the response to get fresh signups
                let foundKey = null;
                for (const mainChar of guildKeys.keys) {
                    if (mainChar.keys?.[0]?.id === selectedKey.id) foundKey = mainChar.keys[0];
                    if (!foundKey && mainChar.alts) {
                        for (const alt of mainChar.alts) {
                            if (alt.keys?.[0]?.id === selectedKey.id) foundKey = alt.keys[0];
                        }
                    }
                }
                if (foundKey) setSignups(foundKey.signups || []);
            }
        } catch (error) {
            console.error('Failed to load modal data');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!selectedCharId || !selectedGuild) return;
        setSubmitting(true);
        try {
            await MythicPlusService.signup(selectedGuild.id, selectedKey.id, selectedCharId, primaryRole, secondaryRole || undefined, message);
            onSuccess();
        } catch (error) {
            console.error('Signup failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (signupId: number, status: string) => {
        if (!selectedGuild) return;
        try {
            await MythicPlusService.updateSignupStatus(selectedGuild.id, signupId, status);
            loadData(); // Refresh to show updated status
        } catch (error) {
            console.error('Update failed');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className={`bg-[#121212] rounded-3xl border border-gray-800 shadow-2xl w-full ${isOwner ? 'max-w-lg' : 'max-w-4xl'} overflow-hidden animate-in zoom-in duration-200 flex flex-col lg:flex-row relative`}>

                {/* Header Overlay (Close Button) */}
                <button onClick={onClose} className="absolute top-5 right-5 z-10 text-gray-500 hover:text-white transition-colors p-2 bg-black/20 rounded-full hover:bg-black/40">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Left Side: Form (Only if not owner) */}
                {!isOwner && (
                    <div className="flex-1 p-8 lg:border-r border-gray-800/50">
                        <div className="mb-8">
                            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-1">Anmeldung</h2>
                            <p className="text-gray-500 text-sm">Für <span className="text-accent font-bold">+{selectedKey.level} {selectedKey.dungeon}</span></p>
                        </div>

                        <div className="space-y-6">
                            {/* Character Selection */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Charakter wählen</label>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {myCharacters.map(char => (
                                        <button
                                            key={char.id}
                                            onClick={() => setSelectedCharId(char.id)}
                                            className={`px-4 py-3 rounded-xl border transition-all text-left flex justify-between items-center ${selectedCharId === char.id
                                                ? 'bg-accent/10 border-accent text-white shadow-[0_0_20px_rgba(163,48,201,0.15)]'
                                                : 'bg-[#1a1a1a] border-gray-800/50 text-gray-400 hover:border-gray-600'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full" style={{ background: getClassColor(char.classId || char.class) }}></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold">{capitalizeName(char.name)}</span>
                                                    <span className="text-[10px] opacity-40">{char.class}</span>
                                                </div>
                                            </div>
                                            {selectedCharId === char.id && (
                                                <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Roles */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Hauptrolle</label>
                                    <div className="flex flex-col gap-1.5">
                                        {['Tank', 'Healer', 'DPS'].map(role => (
                                            <button
                                                key={`primary-${role}`}
                                                onClick={() => {
                                                    setPrimaryRole(role);
                                                    if (secondaryRole === role) setSecondaryRole('');
                                                }}
                                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${primaryRole === role ? 'bg-accent/20 border-accent text-white' : 'bg-[#1a1a1a] border-gray-800/50 text-gray-500'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Zweitrolle</label>
                                    <div className="flex flex-col gap-1.5">
                                        {['Tank', 'Healer', 'DPS'].map(role => {
                                            if (role === primaryRole) return null;
                                            return (
                                                <button
                                                    key={`secondary-${role}`}
                                                    onClick={() => setSecondaryRole(role)}
                                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${secondaryRole === role ? 'bg-gray-800/50 border-gray-600 text-white' : 'bg-[#1a1a1a] border-gray-800/50 text-gray-600'}`}
                                                >
                                                    {role === 'Healer' ? 'Heal' : role}
                                                </button>
                                            );
                                        })}
                                        {secondaryRole === '' && (
                                            <div className="py-2 px-3 rounded-lg text-[10px] border border-dashed border-gray-800 text-gray-700 text-center font-bold">OPTIONAL</div>
                                        )}
                                        {secondaryRole && (
                                            <button onClick={() => setSecondaryRole('')} className="text-[10px] text-red-500/50 hover:text-red-500 font-bold uppercase mt-1">Löschen</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Nachricht</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="z.B. Tank/DPS ready!"
                                    className="w-full bg-[#111] border border-gray-800/80 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                                    rows={2}
                                />
                            </div>

                            <button
                                onClick={handleSignup}
                                disabled={submitting || !selectedCharId}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${submitting || !selectedCharId
                                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                    : 'bg-accent hover:bg-[#8e29af] text-white shadow-[0_0_20px_rgba(163,48,201,0.3)] active:scale-95'
                                    }`}
                            >
                                {submitting ? 'Sende...' : 'Anmeldung absenden'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Right Side: Group Sidebar */}
                <div className={`flex-1 p-8 bg-[#161616]/50 flex flex-col ${isOwner ? 'w-full' : 'lg:max-w-[360px]'}`}>
                    <div className="mb-8">
                        <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <span className="w-2 h-6 bg-accent rounded-full"></span>
                            Gruppe
                        </h2>
                        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mt-1">Status der Anmeldung</p>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto">
                        {/* Keyholder Row */}
                        <div className="bg-[#1D1E1F] p-4 rounded-xl border border-accent/30 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 px-2 py-0.5 bg-accent text-[8px] font-black uppercase text-white rounded-bl-lg">Keyholder</div>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm" style={{ color: getClassColor(selectedKey.character?.classId || selectedKey.character?.class) }}>
                                        {capitalizeName(selectedKey.character?.name)}
                                    </span>
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Bereit</span>
                                </div>
                            </div>
                        </div>

                        {/* Signups */}
                        {signups.map((s: any) => (
                            <div key={s.id} className={`p-4 rounded-xl border ${s.status === 'accepted' ? 'bg-green-500/5 border-green-500/20' : 'bg-[#1a1a1a] border-gray-800/50'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm" style={{ color: getClassColor(s.character?.classId || s.character?.class) }}>
                                            {capitalizeName(s.character?.name)}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase">{s.primaryRole}</span>
                                            {s.secondaryRole && <span className="text-[9px] text-gray-600 font-bold uppercase">/ {s.secondaryRole === 'Healer' ? 'Heal' : s.secondaryRole}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {s.status === 'accepted' ? (
                                            <div className="w-5 h-5 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        ) : s.status === 'declined' ? (
                                            <span className="text-[8px] font-black uppercase text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded">Abgelehnt</span>
                                        ) : (
                                            <span className="text-[8px] font-black uppercase text-yellow-500/70 border border-yellow-500/10 px-1.5 py-0.5 rounded">Warten</span>
                                        )}
                                    </div>
                                </div>

                                {/* Management (Accept/Decline) for Owner */}
                                {isOwner && s.status === 'pending' && (
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => handleUpdateStatus(s.id, 'accepted')}
                                            className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                        >
                                            Annehmen
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(s.id, 'declined')}
                                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                        >
                                            Ablehnen
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {signups.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-800 rounded-2xl">
                                <span className="text-gray-700 font-black uppercase text-[10px] tracking-widest">Keine Anmeldungen</span>
                            </div>
                        )}
                    </div>

                    {isOwner && (
                        <div className="mt-6 pt-6 border-t border-gray-800">
                            <p className="text-[10px] text-gray-600 font-bold uppercase text-center leading-relaxed">
                                Verwalte hier die Anfragen für deinen <br /> <span className="text-accent">+{selectedKey.level} {selectedKey.dungeon}</span> Key.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
