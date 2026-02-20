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
      await loadKeys(selectedGuild.id);
    } catch (error) {
      console.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Listen for sync event from header button
  useEffect(() => {
    const handler = () => handleSync();
    window.addEventListener('mythic-sync-keys', handler);
    return () => window.removeEventListener('mythic-sync-keys', handler);
  }, [selectedGuild]);

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
  const signupsForMyKeys = myMains.flatMap(m => m.signups || []);
  const myOutgoingSignups = mains.flatMap(m => m.signups || []).filter(s => myCharacterIds.includes(s.characterId));

  // --- Helper functions ---
  const getRIOColor = (score: number | null) => {
    if (!score) return '#666';
    if (score >= 3500) return '#FF8000';
    if (score >= 3000) return '#A335EE';
    if (score >= 2000) return '#0070DD';
    return '#1EFF00';
  };

  const getDifficultyColor = (progress: string) => {
    if (!progress || progress === '-') return '#D1D9E0';
    if (progress.includes('M')) return '#FF8000';
    if (progress.includes('H')) return '#A335EE';
    if (progress.includes('N')) return '#0070DD';
    if (progress.includes('L')) return '#1EFF00';
    return '#ABD473';
  };

  const getIlvlColor = (ilvl: number | null) => {
    if (!ilvl) return '#666';
    if (ilvl >= 160) return '#1EFF00';
    if (ilvl >= 130) return '#FFFF00';
    if (ilvl >= 90) return '#FF8000';
    return '#FF0000';
  };

  const getRealmSlug = (realm: string) => realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');

  const renderCharRow = (char: any, isMain: boolean, key: any) => {
    const charUrlName = char.name.toLowerCase();
    const realmSlug = getRealmSlug(char.realm || '');

    return (
      <div
        style={{
          background: '#1D1E1F',
          padding: '6px 16px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: isMain ? '1px solid var(--accent)' : '1px solid #333',
          transition: 'border-color 0.2s',
          width: '100%',
          boxSizing: 'border-box' as const,
        }}
        className="group"
      >
        {/* Name */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <div
            onClick={() => (window as any).electronAPI?.openExternal(`https://worldofwarcraft.com/de-de/character/eu/${realmSlug}/${charUrlName}`)}
            style={{
              fontWeight: 'bold',
              fontSize: '1.1em',
              color: getClassColor(char.classId || char.class),
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Blizzard Arsenal öffnen"
          >
            {capitalizeName(char.name)}
            {isMain && (
              <span style={{
                fontSize: '8px',
                background: 'rgba(163,48,201,0.2)',
                color: 'var(--accent)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 900,
                letterSpacing: '1px',
                textTransform: 'uppercase' as const,
                border: '1px solid #333'
              }}>Main</span>
            )}
          </div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>{char.realm}</div>
        </div>

        {/* ILVL */}
        <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' as const }}>
          <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>ILVL</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getIlvlColor(char.averageItemLevel) }}>
            {char.averageItemLevel || '-'}
          </div>
        </div>

        {/* RIO */}
        <div
          onClick={() => (window as any).electronAPI?.openExternal(`https://raider.io/characters/eu/${realmSlug}/${charUrlName}`)}
          style={{ width: '100px', flexShrink: 0, textAlign: 'center' as const, cursor: 'pointer' }}
          title="Raider.IO öffnen"
        >
          <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>RIO</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getRIOColor(char.mythicRating) }}>
            {char.mythicRating?.toFixed(0) || '-'}
          </div>
        </div>

        {/* Raid Progress */}
        <div
          onClick={() => (window as any).electronAPI?.openExternal(`https://www.warcraftlogs.com/character/eu/${realmSlug}/${charUrlName}`)}
          style={{ width: '180px', flexShrink: 0, textAlign: 'center' as const, cursor: 'pointer' }}
          title="Warcraft Logs öffnen"
        >
          <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>Raid Progress</div>
          <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: getDifficultyColor(char.raidProgress || '') }}>
            {char.raidProgress || '-'}
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        {/* Key + Join */}
        <div style={{ width: '220px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          {key ? (
            <div className="flex items-center bg-[#111] rounded-lg border border-[#333] overflow-hidden group-hover:border-[#555] transition-colors shadow-inner">
              <div className="px-3 py-1 flex items-center gap-2">
                <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{key.dungeon}</span>
                <span className="text-[15px] font-black text-white leading-none">+{key.level}</span>
              </div>
              <button
                onClick={() => handleSignup(key)}
                className="bg-[#2a2a2a] hover:bg-accent text-gray-300 hover:text-white px-3 py-1.5 flex items-center justify-center font-bold text-[9px] uppercase tracking-wider transition-all border-l border-[#333] group-hover:border-[#555]"
              >
                Join
              </button>
            </div>
          ) : (
            <span style={{
              background: 'rgba(255,255,255,0.03)',
              color: '#555',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.7em',
              fontWeight: 'bold',
              border: '1px solid #333',
              textTransform: 'uppercase' as const
            }}>Kein Key</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <section className="page-container p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

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
                      <span className="bg-[#222] text-gray-300 px-2 py-1 rounded">Main: {s.primaryRole}</span>
                      {s.secondaryRole && (
                        <span className="bg-[#222] text-gray-500 px-2 py-1 rounded">Alt: {s.secondaryRole}</span>
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

      {/* --- Roster-Style Keys List (grouped by main with twink expand) --- */}
      <div className="flex flex-col gap-[2px]">
        {mains.map(main => {
          const mainKey = main.keys && main.keys.length > 0 ? main.keys[0] : null;
          const hasAlts = main.alts && main.alts.length > 0;
          const isExpanded = expandedMains.includes(main.id);

          return (
            <div key={main.id} className="flex flex-col">
              {/* Main row */}
              {renderCharRow(main, true, mainKey)}

              {/* Twink expand button */}
              {hasAlts && (
                <div style={{ marginLeft: '16px', marginTop: '-1px' }}>
                  <button
                    onClick={() => toggleExpand(main.id)}
                    style={{
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      color: '#818181',
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      padding: '3px 12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = '#818181'; e.currentTarget.style.borderColor = '#333'; }}
                  >
                    {main.alts.length} {main.alts.length === 1 ? 'Twink' : 'Twinks'}
                    <svg style={{ width: '10px', height: '10px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {/* Expanded twink rows */}
                  {isExpanded && (
                    <div className="flex flex-col gap-[2px] mt-[2px] ml-4 animate-in slide-in-from-top-2 duration-200">
                      {main.alts.map((alt: any) => {
                        const altKey = alt.keys && alt.keys.length > 0 ? alt.keys[0] : null;
                        return (
                          <div key={alt.id}>
                            {renderCharRow(alt, false, altKey)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {mains.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 bg-[#1a1a1a] rounded-2xl border border-dashed border-gray-800">
            <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            <p className="text-gray-400 font-bold text-lg">Keine Mythic+ Keys gefunden</p>
            <p className="text-gray-500 text-sm mt-1">Gildenmitglieder müssen die Desktop-App nutzen, um ihre Keys zu synchronisieren.</p>
          </div>
        )}
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
