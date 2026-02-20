import React, { useEffect, useState } from 'react';
import { MythicPlusService } from '../api/mythicPlusService';
import { capitalizeName, getClassColor } from '../utils/formatUtils';
import { useGuild } from '../contexts/GuildContext';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { SignupModal } from '../components/SignupModal';
import { CharacterService } from '../api/characterService';

export default function MythicPlus() {
  const { guilds, selectedGuild, setSelectedGuild, loading: guildLoading } = useGuild();
  const { user } = useAuth();

  const [mains, setMains] = useState<any[]>([]);
  const [myCharacterIds, setMyCharacterIds] = useState<number[]>([]);
  const [expandedMains, setExpandedMains] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedKey, setSelectedKey] = useState<any>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  useEffect(() => {
    loadMyCharacters();
  }, []);

  const loadMyCharacters = async () => {
    try {
      const data = await CharacterService.getMyCharacters();
      setMyCharacterIds(data.user?.characters?.map((c: any) => c.id) || []);
    } catch (e) {
      console.error('Failed to load my characters');
    }
  };

  useEffect(() => {
    if (selectedGuild) {
      // SWR: Load from cache
      const cachedKeys = storage.get(`cache_mythic_keys_${selectedGuild.id}`, []);
      if (cachedKeys.length > 0) {
        setMains(cachedKeys);
        setLoading(false);
      }
      loadKeys(selectedGuild.id);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, guildLoading]);


  const loadKeys = async (guildId: number) => {
    try {
      const data = await MythicPlusService.getGuildKeys(guildId);
      const mainsData = data.keys || [];
      setMains(mainsData);
      storage.set(`cache_mythic_keys_${guildId}`, mainsData);
    } catch (error) {
      console.error('Failed to load keys');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (mainId: number) => {
    setExpandedMains(prev =>
      prev.includes(mainId) ? prev.filter(id => id !== mainId) : [...prev, mainId]
    );
  };

  const handleSignup = (key: any) => {
    setSelectedKey(key);
    setShowSignupModal(true);
  };

  const handleSync = async () => {
    if (!selectedGuild) return;
    setSyncing(true);
    try {
      await MythicPlusService.syncKeys(selectedGuild.id);
      loadKeys(selectedGuild.id);
    } catch (error) {
      console.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateSignup = async (signupId: number, status: string) => {
    if (!selectedGuild) return;
    try {
      await MythicPlusService.updateSignupStatus(selectedGuild.id, signupId, status);
      loadKeys(selectedGuild.id);
    } catch (error) {
      console.error('Update failed');
    }
  };

  const handleRemoveSignup = async (signupId: number) => {
    if (!selectedGuild) return;
    try {
      await MythicPlusService.removeSignup(selectedGuild.id, signupId);
      loadKeys(selectedGuild.id);
    } catch (error) {
      console.error('Remove failed');
    }
  };

  // --- Compute Dashboard Data ---
  const myMains = mains.filter(m => m.userId === user?.id);
  // All signups for keys I OWN
  const signupsForMyKeys = myMains.flatMap(m => m.signups || []);

  // All signups I HAVE MADE (where my character applied)
  const myOutgoingSignups = mains.flatMap(m => m.signups || []).filter(s => myCharacterIds.includes(s.characterId));

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <section className="page-container p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-end items-center gap-4 bg-[#1a1a1a]/80 backdrop-blur-md p-4 rounded-2xl border border-gray-800 shadow-2xl">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-accent/10 hover:bg-accent border border-accent/30 hover:border-accent text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-3 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(163,48,201,0.4)]"
        >
          {syncing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Synchronisiere...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-accent group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span>Sync Keys</span>
            </>
          )}
        </button>
      </div>

      {/* --- Dashboard: Mythic+ Signups --- */}
      {(signupsForMyKeys.length > 0 || myOutgoingSignups.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Signups for MY Keys */}
          {signupsForMyKeys.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 shadow-xl overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-[#222] to-[#1a1a1a] p-4 border-b border-gray-800">
                <h2 className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                  Anfragen für meine Keys
                </h2>
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[400px]">
                {signupsForMyKeys.map((s: any) => (
                  <div key={s.id} className="bg-[#111] border border-gray-800 p-3 rounded-xl hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-sm" style={{ color: getClassColor(s.character.classId || s.character.class) }}>
                          {capitalizeName(s.character.name)}
                        </p>
                        <p className="text-xs text-gray-500">Möchte mit für <span className="text-accent font-bold">+{s.key.level} {s.key.dungeon}</span></p>
                      </div>
                      <span className={`px-2 py-1 rounded-md uppercase tracking-wider font-bold text-[9px] ${s.status === 'accepted' ? 'text-green-500 bg-green-500/10 border border-green-500/20' : s.status === 'declined' ? 'text-red-500 bg-red-500/10 border border-red-500/20' : 'text-yellow-500 bg-yellow-500/10 border border-yellow-500/20'}`}>
                        {s.status === 'pending' ? 'Ausstehend' : s.status === 'accepted' ? 'Angenommen' : 'Abgelehnt'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold tracking-wider mb-3">
                      <span className="bg-[#222] text-gray-300 px-2 py-1 rounded">
                        Main: {s.primaryRole}
                      </span>
                      {s.secondaryRole && (
                        <span className="bg-[#222] text-gray-500 px-2 py-1 rounded">
                          Alt: {s.secondaryRole}
                        </span>
                      )}
                    </div>
                    {s.message && (
                      <p className="text-xs text-gray-400 italic bg-[#222]/50 p-2 rounded-lg mb-3 border border-gray-800/50 block w-full whitespace-normal break-words">"{s.message}"</p>
                    )}

                    <div className="flex gap-2">
                      {s.status === 'pending' && (
                        <>
                          <button onClick={() => handleUpdateSignup(s.id, 'accepted')} className="flex-1 text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 py-1.5 rounded-lg text-xs font-bold transition-all">Annehmen</button>
                          <button onClick={() => handleUpdateSignup(s.id, 'declined')} className="flex-1 text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 py-1.5 rounded-lg text-xs font-bold transition-all">Ablehnen</button>
                        </>
                      )}
                      <button onClick={() => handleRemoveSignup(s.id)} className="px-3 text-gray-500 hover:text-white bg-[#222] hover:bg-red-500/20 hover:border-red-500/30 border border-gray-800 rounded-lg transition-all" title="Löschen">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MY Signups */}
          {myOutgoingSignups.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 shadow-xl overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-[#222] to-[#1a1a1a] p-4 border-b border-gray-800">
                <h2 className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Meine Anmeldungen
                </h2>
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[400px]">
                {myOutgoingSignups.map((s: any) => (
                  <div key={s.id} className="bg-[#111] border border-gray-700/50 p-3 rounded-xl flex justify-between items-center group">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm" style={{ color: getClassColor(s.character.classId || s.character.class) }}>
                          {capitalizeName(s.character.name)}
                        </span>
                        <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest bg-[#222] px-1.5 py-0.5 rounded">
                          {s.primaryRole} {s.secondaryRole ? `/ ${s.secondaryRole}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Angemeldet für <span className="text-white font-bold">+{s.key.level} {s.key.dungeon}</span></p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-md uppercase tracking-wider font-bold text-[9px] ${s.status === 'accepted' ? 'text-green-500 bg-green-500/10' : s.status === 'declined' ? 'text-red-500 bg-red-500/10' : 'text-yellow-500 bg-yellow-500/10'}`}>
                        {s.status === 'pending' ? 'Ausstehend' : s.status === 'accepted' ? 'Angenommen' : 'Abgelehnt'}
                      </span>
                      <button onClick={() => handleRemoveSignup(s.id)} className="text-[10px] text-red-500/70 hover:text-red-400 uppercase font-bold tracking-widest transition-colors">
                        Zurückziehen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Roster Keys List --- */}
      <div className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-widest text-white mt-12 mb-6 border-b border-gray-800 pb-4">Verfügbare Gilden-Keys</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {mains.map(main => (
            <div key={main.id} className="bg-[#1D1E1F] rounded-2xl overflow-hidden border border-[#333] hover:border-accent transition-all group flex flex-col w-full">

              {/* Main Character Header */}
              <div className="p-4 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden">
                <div className="flex items-center gap-4 w-full sm:w-auto relative z-10 flex-1">
                  <div
                    className="w-[42px] h-[42px] rounded-lg flex items-center justify-center font-black text-xl shadow-inner border border-[#444]"
                    style={{ backgroundColor: `${getClassColor(main.classId || main.class)}15`, color: getClassColor(main.classId || main.class) }}
                  >
                    {main.name[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[15px] leading-tight truncate" style={{ color: getClassColor(main.classId || main.class) }}>
                        {capitalizeName(main.name)}
                      </h3>
                      <span className="px-1.5 py-[2px] rounded text-[8px] font-black tracking-widest uppercase bg-[#111] text-accent border border-[#333]">Main</span>
                    </div>
                    <div className="flex items-center gap-x-2 text-[10px] mt-1 font-medium flex-wrap">
                      <span className="text-gray-400 capitalize">{main.class}</span>
                      <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                      <span className="text-gray-400">ILVL <span className="text-white font-bold">{main.averageItemLevel || '-'}</span></span>
                      <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                      <span className="text-gray-400">RIO <span className="text-[#FF8000] font-black">{Math.round(main.mythicRating || 0) || '-'}</span></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 sm:mt-0 w-full sm:w-auto z-10 flex-shrink-0">
                  {main.keys && main.keys.length > 0 ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                      {main.keys.map((key: any) => (
                        <div key={key.id} className="flex min-w-fit items-stretch bg-[#111] rounded-lg border border-[#333] overflow-hidden group-hover:border-[#555] transition-colors shadow-inner">
                          <div className="px-3 py-1 flex flex-col justify-center items-center min-w-[65px] h-[40px]">
                            <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[70px] leading-none mb-1">{key.dungeon}</p>
                            <p className="text-lg font-black text-white leading-none">+{key.level}</p>
                          </div>
                          <button
                            onClick={() => handleSignup(key)}
                            className="bg-[#2a2a2a] hover:bg-accent text-gray-300 hover:text-white px-3 flex items-center justify-center font-bold text-[10px] uppercase tracking-wider transition-all border-l border-[#333] group-hover:border-[#555]"
                          >
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-600 text-[10px] uppercase tracking-widest font-black px-4 bg-[#111] h-[40px] flex items-center rounded-lg border border-[#333]">Kein Key</span>
                  )}
                </div>
              </div>

              {/* Twink Toggle */}
              {main.alts && main.alts.length > 0 && (
                <div className="bg-[#1D1E1F]">
                  <div className="flex justify-center -mt-[1px]">
                    <button
                      onClick={() => toggleExpand(main.id)}
                      className="w-full h-[30px] flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#818181] hover:text-white bg-[#1D1E1F] hover:bg-[#2a2a2a] transition-colors border-t border-[#333] rounded-b-lg"
                    >
                      <span>{main.alts.length} {main.alts.length === 1 ? 'Twink' : 'Twinks'}</span>
                      <svg className={`w-3.5 h-3.5 transition-transform ${expandedMains.includes(main.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  {/* Expanded Twinks */}
                  {expandedMains.includes(main.id) && (
                    <div className="p-3 bg-[#111] shadow-inner flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200 pl-8 border-t border-[#222]">
                      {main.alts.map((alt: any) => (
                        <div key={alt.id} className="bg-[#1D1E1F] p-2.5 rounded-lg border border-[#333] hover:border-accent/50 transition-colors flex items-center justify-between group/twink relative">
                          {/* Indentation Visual Connectors */}
                          <div className="absolute -left-6 top-1/2 w-6 h-[1px] bg-[#333]"></div>
                          <div className="absolute -left-6 top-[-15px] w-[1px] h-[calc(50%+15px)] bg-[#333]"></div>

                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner border border-[#444] flex-shrink-0"
                              style={{ backgroundColor: `${getClassColor(alt.classId || alt.class)}15`, color: getClassColor(alt.classId || alt.class) }}
                            >
                              {alt.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-2 truncate">
                                <p className="font-bold text-[13px] truncate" style={{ color: getClassColor(alt.classId || alt.class) }}>
                                  {capitalizeName(alt.name)}
                                </p>
                                <span className="text-[9px] text-gray-500 font-medium capitalize">{alt.class}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[9px] mt-0.5">
                                <span className="text-gray-400">ILVL <span className="text-white font-bold">{alt.averageItemLevel || '-'}</span></span>
                                <span className="text-gray-400">RIO <span className="text-[#FF8000] font-bold">{Math.round(alt.mythicRating || 0) || '-'}</span></span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            {alt.keys && alt.keys.length > 0 ? (
                              <div className="flex items-center gap-2 w-full">
                                <div className="flex min-w-fit items-stretch bg-[#111] rounded-lg border border-[#333] overflow-hidden group-hover/twink:border-[#555] transition-colors shadow-inner w-full">
                                  <div className="px-2 py-1 flex flex-col justify-center items-center flex-1 h-[32px]">
                                    <div className="flex items-center gap-2 w-full justify-center">
                                      <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] leading-none">{alt.keys[0].dungeon}</p>
                                      <p className="text-sm font-black text-white leading-none">+{alt.keys[0].level}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleSignup(alt.keys[0])}
                                    className="bg-[#2a2a2a] hover:bg-accent text-gray-300 hover:text-white px-3 flex items-center justify-center font-bold text-[10px] uppercase tracking-wider transition-all border-l border-[#333] group-hover/twink:border-[#555]"
                                    title="Anmelden"
                                  >
                                    Join
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[9px] text-gray-600 uppercase font-black tracking-widest px-3 bg-[#111] h-[32px] flex items-center justify-center rounded-lg border border-[#333] w-full">Kein Key registriert</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {mains.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 bg-[#1a1a1a] rounded-2xl border border-dashed border-gray-800">
              <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p className="text-gray-400 font-bold text-lg">Keine Mythic+ Keys gefunden</p>
              <p className="text-gray-500 text-sm mt-1">Gildenmitglieder müssen die Desktop-App nutzen, um ihre Keys zu synchronisieren.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Modals --- */}
      {showSignupModal && (
        <SignupModal
          selectedKey={selectedKey}
          onClose={() => setShowSignupModal(false)}
          onSuccess={() => {
            setShowSignupModal(false);
            if (selectedGuild) {
              setLoading(true);
              loadKeys(selectedGuild.id);
            }
          }}
        />
      )}
    </section>
  );
}
