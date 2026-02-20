import React, { useEffect, useState } from 'react';
import { CharacterService } from '../api/characterService';
import { MythicPlusService } from '../api/mythicPlusService';
import { capitalizeName } from '../utils/formatUtils';
import { useGuild } from '../contexts/GuildContext';

interface SignupModalProps {
    selectedKey: any;
    onClose: () => void;
    onSuccess: () => void;
}

export const SignupModal: React.FC<SignupModalProps> = ({ selectedKey, onClose, onSuccess }) => {
    const { selectedGuild } = useGuild();
    const [myCharacters, setMyCharacters] = useState<any[]>([]);
    const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
    const [primaryRole, setPrimaryRole] = useState<string>('DPS');
    const [secondaryRole, setSecondaryRole] = useState<string>('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadMyCharacters();
    }, []);

    const loadMyCharacters = async () => {
        try {
            const data = await CharacterService.getMyCharacters();
            const chars = data.user?.characters || [];
            // Only show main + favorites
            const filtered = chars.filter((c: any) => c.isMain || c.isFavorite);
            setMyCharacters(filtered);
            // Auto-select main if available
            const main = filtered.find((c: any) => c.isMain);
            if (main) setSelectedCharId(main.id);
            else if (filtered.length > 0) setSelectedCharId(filtered[0].id);
        } catch (error) {
            console.error('Failed to load my characters');
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Anmeldung</h2>
                            <p className="text-gray-400 text-sm">Für Key: <span className="text-[var(--accent)]">+{selectedKey.level} {selectedKey.dungeon}</span></p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Charakter auswählen</label>
                            {loading ? (
                                <div className="animate-pulse bg-gray-800 h-10 rounded-lg"></div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1.5">
                                    {myCharacters.map(char => (
                                        <button
                                            key={char.id}
                                            onClick={() => setSelectedCharId(char.id)}
                                            className={`px-3 py-2 rounded-lg border transition-all text-left flex justify-between items-center ${selectedCharId === char.id
                                                ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-white shadow-[0_0_15px_rgba(163,48,201,0.2)]'
                                                : 'bg-[#222] border-gray-800 text-gray-400 hover:border-gray-600'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold">{capitalizeName(char.name)}</span>
                                                <span className="text-[10px] opacity-50">{char.class}</span>
                                                {char.isMain && <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold uppercase">Main</span>}
                                            </div>
                                            {selectedCharId === char.id && (
                                                <div className="w-4 h-4 bg-[var(--accent)] rounded-full flex items-center justify-center">
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                    {myCharacters.length === 0 && (
                                        <p className="text-sm text-yellow-500/80 italic p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                            Keine eigenen Charaktere gefunden.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Hauptrolle (Pflicht)</label>
                            <div className="flex gap-2">
                                {['Tank', 'Healer', 'DPS'].map(role => (
                                    <button
                                        key={`primary-${role}`}
                                        onClick={() => {
                                            setPrimaryRole(role);
                                            if (secondaryRole === role) setSecondaryRole('');
                                        }}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${primaryRole === role ? 'bg-accent/20 border-accent text-white' : 'bg-[#222] border-gray-800 text-gray-400 hover:border-gray-600'}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 flex justify-between items-end">
                                <span>Zweitrolle (Optional)</span>
                                {secondaryRole && (
                                    <button onClick={() => setSecondaryRole('')} className="text-[10px] text-gray-600 hover:text-red-400">Zurücksetzen</button>
                                )}
                            </label>
                            <div className="flex gap-2">
                                {['Tank', 'Healer', 'DPS'].map(role => {
                                    if (role === primaryRole) return null;
                                    return (
                                        <button
                                            key={`secondary-${role}`}
                                            onClick={() => setSecondaryRole(role)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${secondaryRole === role ? 'bg-gray-700/50 border-gray-500 text-white' : 'bg-[#222] border-gray-800 text-gray-500 hover:border-gray-600'}`}
                                        >
                                            {role === 'Healer' ? 'Heal' : role}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Nachricht (Optional)</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="z.B. Tank/DPS ready!"
                                className="w-full bg-[#111] border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                                rows={2}
                            />
                        </div>

                        <button
                            onClick={handleSignup}
                            disabled={submitting || !selectedCharId}
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${submitting || !selectedCharId
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                : 'bg-[var(--accent)] hover:bg-[#8e29af] text-white shadow-lg active:scale-95'
                                }`}
                        >
                            {submitting ? 'Sende Anfrage...' : 'Anmeldung absenden'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
