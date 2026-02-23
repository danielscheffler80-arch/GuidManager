import React, { useEffect, useState } from 'react';
import { MythicPlusService } from '../api/mythicPlusService';
import { capitalizeName, getClassColor } from '../utils/formatUtils';
import { useGuild } from '../contexts/GuildContext';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { SignupModal } from '../components/SignupModal';
import { CharacterService } from '../api/characterService';
import MessagePopup from '../components/MessagePopup';

export default function MythicPlus() {
  const { selectedGuild, loading: guildLoading } = useGuild();
  const { user } = useAuth();

  const [mains, setMains] = useState<any[]>([]);
  const [myCharacterIds, setMyCharacterIds] = useState<number[]>([]);
  const [expandedMains, setExpandedMains] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedKey, setSelectedKey] = useState<any>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [keyFilter, setKeyFilter] = useState({ search: '', min: 0, max: 99 });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, charId: number, charName: string } | null>(null);
  const [messageReceiver, setMessageReceiver] = useState<{ id: number, name: string } | null>(null);

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
      let mainsData = data.keys || [];

      // Merge with user characters from Account Management context (user.characters)
      if (user && user.characters) {
        mainsData = mainsData.map((m: any) => {
          const userChars = user.characters || [];
          const userMatch = userChars.find((uc: any) => uc.id === m.id);
          const updatedAlts = (m.alts || []).map((alt: any) => {
            const altMatch = userChars.find((uc: any) => uc.id === alt.id);
            return altMatch ? { ...alt, mythicRating: altMatch.mythicRating } : alt;
          });

          // Merge for signups!
          const updatedSignups = (m.signups || []).map((sig: any) => {
            if (!sig.character) return sig;
            const charMatch = userChars.find((uc: any) => uc.id === sig.characterId);
            if (charMatch && charMatch.mythicRating !== undefined && charMatch.mythicRating !== null) {
              return {
                ...sig,
                character: { ...sig.character, mythicRating: charMatch.mythicRating }
              };
            }
            return sig;
          });

          return {
            ...m,
            mythicRating: (userMatch && userMatch.mythicRating !== undefined && userMatch.mythicRating !== null) ? userMatch.mythicRating : m.mythicRating,
            alts: updatedAlts,
            signups: updatedSignups
          };
        });
      }

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

  const handleStartKey = async (key: any) => {
    const confirmedPlayers = key.signups?.filter((s: any) => s.status === 'accepted') || [];
    if (confirmedPlayers.length === 0) {
      alert('Keine Spieler in der Gruppe ausgewählt!');
      return;
    }

    const dungeon = key.dungeon;
    const level = key.level;
    const message = `Der Key für ${dungeon} +${level} startet jetzt! Bitte online kommen / inviten.`;

    const senderChar = user?.characters?.find((c: any) => (c as any).isMain) || user?.characters?.[0];
    if (!senderChar) {
      alert('Kein Charakter zum Senden gefunden.');
      return;
    }

    let successCount = 0;
    for (const player of confirmedPlayers) {
      if (player.characterId === senderChar.id) continue; // Don't send to self

      try {
        const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/messages/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            senderId: senderChar.id,
            receiverId: player.characterId,
            content: message
          })
        });
        if (resp.ok) successCount++;
      } catch (err) {
        console.error('Failed to send start message to', player.character?.name);
      }
    }

    alert(`${successCount} Start-Nachrichten wurden an die Gruppenmitglieder gesendet!`);
  };

  const handleKeyholderSelfAssign = async (keyId: number, charId: number, role: string) => {
    if (!selectedGuild) return;
    try {
      // 1. Signup the keyholder themselves
      const signupResp = await MythicPlusService.signup(selectedGuild.id, keyId, charId, role);
      if (signupResp.signup?.id) {
        // 2. Immediately accept the signup
        await MythicPlusService.updateSignupStatus(selectedGuild.id, signupResp.signup.id, 'accepted');
        loadKeys(selectedGuild.id);
      }
    } catch (e) {
      console.error('Self-assignment failed', e);
    }
  };

  // Listen for sync event from header button
  useEffect(() => {
    const handler = () => handleSync();
    window.addEventListener('mythic-sync-keys', handler);
    return () => window.removeEventListener('mythic-sync-keys', handler);
  }, [selectedGuild]);

  // Listen for key filter from header search
  useEffect(() => {
    const filterHandler = (e: any) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') {
        setKeyFilter(prev => ({ ...prev, search: detail }));
      } else if (detail) {
        setKeyFilter(detail);
      }
    };
    window.addEventListener('mythic-key-filter', filterHandler);
    return () => window.removeEventListener('mythic-keys-filter', filterHandler);
  }, []);

  // Handle right-click on character name
  const handleCharContextMenu = (e: React.MouseEvent, charId: number, charName: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      charId,
      charName
    });
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

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

  const getClassIcon = (classId: number | string) => {
    const classMap: Record<number | string, string> = {
      1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue', 5: 'priest', 6: 'deathknight',
      7: 'shaman', 8: 'mage', 9: 'warlock', 10: 'monk', 11: 'druid', 12: 'demonhunter', 13: 'evoker'
    };
    const key = classMap[classId] || String(classId).toLowerCase().replace(/\s+/g, '');
    return `https://render.worldofwarcraft.com/us/icons/56/classicon_${key}.jpg`;
  };

  const getPossibleRoles = (classId: any) => {
    const id = Number(classId);
    if ([2, 10, 11].includes(id)) return ['Tank', 'Healer', 'DPS'];
    if ([1, 6, 12].includes(id)) return ['Tank', 'DPS'];
    if ([5, 7, 13].includes(id) || classId === 'Priest' || classId === 'Shaman' || classId === 'Evoker') return ['Healer', 'DPS'];
    return ['DPS'];
  };

  const RoleIcon = ({ role, size = 12, char, isSlot = false }: { role: string, size?: number, char?: any, isSlot?: boolean }) => {
    if (char) {
      return (
        <img
          src={getClassIcon(char.classId || char.class)}
          style={{ width: size, height: size, borderRadius: '2px', objectFit: 'cover' }}
          alt={char.class}
        />
      );
    }
    const color = isSlot ? (role === 'Tank' ? '#3B82F6' : (role === 'Healer' || role === 'Heal' ? '#10B981' : '#EF4444')) : (role === 'Tank' ? '#3B82F6' : (role === 'Healer' || role === 'Heal' ? '#10B981' : '#EF4444'));
    if (role === 'Tank') return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2L4 5V11C4 16.17 7.41 20.94 12 22C16.59 20.94 20 16.17 20 11V5L12 2Z" /></svg>;
    if (role === 'Healer' || role === 'Heal') return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M19 11H13V5C13 4.45 12.55 4 12 4C11.45 4 11 4.45 11 5V11H5C4.45 11 4 11.45 4 12C4 12.55 4.45 13 5 13H11V19C11 19.55 11.45 20 12 20C12.55 20 13 19.55 13 19V13H19C19.55 13 20 12.55 20 12C20 11.45 19.55 11 19 11Z" /></svg>;
    return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M11 2L9 7L3 9L9 11L11 17L13 11L19 9L13 7L11 2Z" /></svg>;
  };

  const MythicGroupSlots = ({ fullKey, isMyKey = false }: { fullKey: any, isMyKey?: boolean }) => {
    if (!fullKey) return null;
    const keyholder = fullKey.character;
    const allSignups = fullKey.signups || [];
    const confirmedSignups = allSignups.filter((sig: any) => sig.status === 'accepted');
    const pendingSignups = allSignups.filter((sig: any) => sig.status === 'pending');

    const slots = [
      { role: 'Tank', char: null as any, signup: null as any },
      { role: 'Healer', char: null as any, signup: null as any },
      { role: 'DPS', char: null as any, signup: null as any },
      { role: 'DPS', char: null as any, signup: null as any },
      { role: 'DPS', char: null as any, signup: null as any }
    ];

    // Place Confirmed - Priority to signups
    confirmedSignups.forEach((sig: any) => {
      const role = (sig.primaryRole === 'Heal' || sig.primaryRole === 'Healer') ? 'Healer' : (sig.primaryRole === 'Tank' ? 'Tank' : 'DPS');
      if (role === 'Tank' && !slots[0].char) { slots[0].char = sig.character; slots[0].signup = sig; }
      else if (role === 'Healer' && !slots[1].char) { slots[1].char = sig.character; slots[1].signup = sig; }
      else {
        const freeDpsIdx = slots.findIndex(sl => sl.role === 'DPS' && !sl.char);
        if (freeDpsIdx !== -1) { slots[freeDpsIdx].char = sig.character; slots[freeDpsIdx].signup = sig; }
      }
    });

    // Check if keyholder is already in a slot (was manually selected or confirmed via a signup)
    const isKHInSlot = slots.some(s => s.char?.id === keyholder?.id);

    return (
      <div className="flex flex-row w-full overflow-x-auto pb-2 custom-scrollbar" style={{ gap: '2px', justifyContent: 'space-between' }}>
        {slots.map((slot, idx) => {
          const rolePending = pendingSignups.filter((sig: any) => {
            const sigRole = (sig.primaryRole === 'Heal' || sig.primaryRole === 'Healer') ? 'Healer' : (sig.primaryRole === 'Tank' ? 'Tank' : 'DPS');
            return sigRole === slot.role;
          });

          // Also include keyholder in dropdown if they can fill this role and aren't in a slot yet
          const khCanFill = !isKHInSlot && getPossibleRoles(keyholder.classId || keyholder.class).includes(slot.role);

          return (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                height: '44px',
                flex: 1,
                minWidth: '155px'
              }}
              className="hover:border-white/10"
            >
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RoleIcon role={slot.role} size={22} char={null} isSlot={true} />
                {slot.char && (
                  <img
                    src={getClassIcon(slot.char.classId || slot.char.class)}
                    style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    alt={slot.char.class}
                  />
                )}
              </div>

              {slot.char ? (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      onContextMenu={(e) => handleCharContextMenu(e, slot.char.id, slot.char.name)}
                      style={{
                        color: getClassColor(slot.char.classId || slot.char.class),
                        fontSize: '0.85em',
                        fontWeight: '800',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: '1.1',
                        cursor: 'context-menu'
                      }}
                    >
                      {capitalizeName(slot.char.name)}
                    </span>
                    <span style={{ fontSize: '0.65em', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {slot.char.id === keyholder?.id ? 'Leader' : (slot.char.realm || 'Blackrock')}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '0.75em',
                    fontWeight: '800',
                    color: getRIOColor(slot.char.mythicRating),
                    marginLeft: 'auto',
                    marginRight: '8px'
                  }}>
                    {slot.char.mythicRating !== undefined && slot.char.mythicRating !== null ?
                      slot.char.mythicRating.toFixed(0) : '-'}
                  </span>

                  {isMyKey && slot.char.id !== keyholder?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (slot.signup) {
                          handleUpdateSignup(slot.signup.id, 'pending');
                        } else {
                          // If it was the leader themselves or manually added without signup (future case)
                        }
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '4px',
                        padding: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      className="hover:bg-red-500 hover:text-white"
                      title="Remove from group"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  {isMyKey && (rolePending.length > 0 || khCanFill) ? (
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        if (e.target.value === 'KEYHOLDER') {
                          handleKeyholderSelfAssign(fullKey.id, keyholder.id, slot.role);
                        } else {
                          handleUpdateSignup(Number(e.target.value), 'accepted');
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: '0.75em',
                        fontWeight: '900',
                        width: '100%',
                        cursor: 'pointer',
                        outline: 'none',
                        appearance: 'none',
                        padding: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      <option value="" style={{ background: '#1D1E1F' }}>{slot.role} Slot ({rolePending.length + (khCanFill ? 1 : 0)})</option>
                      {khCanFill && (
                        <option value="KEYHOLDER" style={{ background: '#1D1E1F', color: getClassColor(keyholder.classId || keyholder.class) }}>
                          [ICH] {capitalizeName(keyholder.name)} ({keyholder.mythicRating !== undefined && keyholder.mythicRating !== null ? keyholder.mythicRating.toFixed(0) : '-'})
                        </option>
                      )}
                      {rolePending.map((sig: any) => (
                        <option key={sig.id} value={sig.id} style={{ background: '#1D1E1F', color: '#fff' }}>
                          {capitalizeName(sig.character?.name)} ({sig.character?.mythicRating !== undefined && sig.character?.mythicRating !== null ? sig.character.mythicRating.toFixed(0) : '-'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: '0.75em', color: '#444', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {slot.role} Slot
                    </span>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>
    );
  };

  const renderCharRow = (char: any, isMain: boolean, key: any) => {
    const charUrlName = char.name.toLowerCase();
    const realmSlug = getRealmSlug(char.realm || '');

    return (
      <div
        style={{
          background: '#1D1E1F',
          padding: '12px 20px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: isMain ? '1px solid rgba(163,48,201,0.3)' : '1px solid #333',
          transition: 'border-color 0.2s',
          width: '100%',
          boxSizing: 'border-box' as const,
        }}
        className="group"
      >
        <div className="flex items-center justify-between w-full">
          {/* Name */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            <div
              onClick={() => (window as any).electronAPI?.openExternal(`https://worldofwarcraft.com/de-de/character/eu/${realmSlug}/${charUrlName}`)}
              onContextMenu={(e) => handleCharContextMenu(e, char.id, char.name)}
              style={{
                fontWeight: 'bold',
                fontSize: '1.1em',
                color: getClassColor(char.classId || char.class),
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Blizzard Arsenal öffnen (Rechtsklick für Nachricht)"
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
              {char.mythicRating !== undefined && char.mythicRating !== null ?
                char.mythicRating.toFixed(0) : '-'}
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
          <div style={{ width: '280px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            {key ? (
              <>
                <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#ccc', whiteSpace: 'nowrap' as const }}>
                  {key.dungeon} +{key.level}
                </div>
                {myCharacterIds.includes(char.id) ? (
                  /* Own character's key - Show START button */
                  <button
                    onClick={() => handleStartKey(key)}
                    style={{
                      background: '#10B981',
                      border: '1px solid #10B981',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '9px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap' as const,
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#059669'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#10B981'; }}
                  >
                    Start
                  </button>
                ) : (
                  /* Other account's key - Show JOIN button */
                  !myCharacterIds.some(id => id === char.id) && (
                    <button
                      onClick={() => handleSignup(key)}
                      style={{
                        background: '#A330C9',
                        border: '1px solid #A330C9',
                        color: '#fff',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '9px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap' as const,
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#b84ddb'; e.currentTarget.style.borderColor = '#b84ddb'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#A330C9'; e.currentTarget.style.borderColor = '#A330C9'; }}
                    >
                      Join
                    </button>
                  )
                )}
              </>
            ) : (
              <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#555' }}>-</div>
            )}
          </div>
        </div>

        {/* New 5-Slot Card for Guild Keys */}
        {key && (
          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
            <MythicGroupSlots fullKey={{ ...key, character: char }} isMyKey={myCharacterIds.includes(char.id)} />
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const matchesFilter = (char: any) => {
    const q = keyFilter.search?.toLowerCase() || '';
    const nameMatch = char.name?.toLowerCase().includes(q);
    const key = char.keys?.[0];

    // Dungeon Name Match
    const dungeonMatch = key && key.dungeon?.toLowerCase().includes(q);

    // Level Range Match
    const levelMatch = key ? (key.level >= keyFilter.min && key.level <= keyFilter.max) : false;

    // If searching for text, must match name or dungeon
    const textMatch = q ? (nameMatch || dungeonMatch) : true;

    // If we have level filtering, it must match the key level
    const isLevelFiltering = keyFilter.min > 0 || keyFilter.max < 99;
    if (isLevelFiltering && !key) return false;

    return textMatch && (isLevelFiltering ? levelMatch : true);
  };

  const filteredMains = mains.filter(main => {
    const mainMatch = matchesFilter(main);
    const altMatch = main.alts?.some((alt: any) => matchesFilter(alt));
    return mainMatch || altMatch;
  });

  return (
    <section className="page-container p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* --- Dashboard: Mythic+ Signups --- */}
      {myOutgoingSignups.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* MY Signups */}
          {myOutgoingSignups.length > 0 && (
            <div className="flex flex-col gap-3 mt-4">
              <h2 className="text-[13px] font-black uppercase tracking-[0.4em] text-gray-500 mb-2 ml-1 px-1 border-l-2 border-accent pl-4">
                Meine Anmeldungen
              </h2>
              <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {myOutgoingSignups.map((s: any) => {
                  const char = s.character;
                  if (!char) return null;
                  const charUrlName = char.name?.toLowerCase();
                  const realmSlug = getRealmSlug(char.realm || '');

                  // Build the 5 slots STRICTLY: Tank, Heal, DPS, DPS, DPS
                  let fullKey = filteredMains.find(m => m.id === s.key?.character?.mainId)?.keys?.[0] ||
                    filteredMains.flatMap(m => m.alts || []).find(a => a.id === s.key?.characterId)?.keys?.[0];

                  if (fullKey) {
                    const khChar = filteredMains.find(m => m.id === s.key?.characterId) ||
                      filteredMains.flatMap(m => m.alts || []).find(a => a.id === s.key?.characterId);
                    if (khChar) fullKey = { ...fullKey, character: khChar };
                  }
                  const confirmedSignups = fullKey?.signups?.filter((sig: any) => sig.status === 'accepted') || [];
                  const keyholder = s.key?.character;


                  return (
                    <div key={s.id} className="bg-[#1D1E1F] border border-[#333] rounded-[12px] flex flex-col gap-4" style={{ padding: '16px' }}>
                      {/* Row 1: Unified Char Row Design */}
                      <div className="flex items-center justify-between w-full">
                        {/* Name Column */}
                        <div style={{ width: '220px', flexShrink: 0 }}>
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '1.1em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span style={{ color: getClassColor(char.classId || char.class) }}>
                              {capitalizeName(char.name)}
                            </span>
                            <span style={{
                              fontSize: '8px',
                              background: s.status === 'accepted' ? 'rgba(16,185,129,0.1)' : s.status === 'declined' ? 'rgba(239,68,68,0.1)' : 'rgba(163,48,201,0.2)',
                              color: s.status === 'accepted' ? '#10B981' : s.status === 'declined' ? '#EF4444' : 'var(--accent)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 900,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              border: '1px solid #333'
                            }}>
                              {s.status === 'accepted' ? 'Accepted' : s.status === 'declined' ? 'Declined' : 'Pending'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8em', color: '#666' }}>{char.realm || 'Blackrock'}</div>
                        </div>

                        {/* ILVL Column */}
                        <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>ILVL</div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getIlvlColor(char.averageItemLevel) }}>
                            {char.averageItemLevel || '-'}
                          </div>
                        </div>

                        {/* RIO Column */}
                        <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>RIO</div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getRIOColor(char.mythicRating) }}>
                            {char.mythicRating !== undefined && char.mythicRating !== null ?
                              char.mythicRating.toFixed(0) : '-'}
                          </div>
                        </div>

                        {/* Raid Progress Column */}
                        <div style={{ width: '180px', flexShrink: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>Raid Progress</div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: getDifficultyColor(char.raidProgress || '') }}>
                            {char.raidProgress || '-'}
                          </div>
                        </div>

                        <div className="flex-1"></div>

                        {/* Key Info + Actions */}
                        <div className="flex items-center " style={{ gap: '15px' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#fff', whiteSpace: 'nowrap' }}>
                            {s.key?.dungeon} +{s.key?.level}
                          </div>

                          <button
                            onClick={() => handleRemoveSignup(s.id)}
                            style={{
                              background: 'rgba(163,48,201,0.05)',
                              border: '1px solid rgba(163,48,201,0.2)',
                              color: '#666',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              fontSize: '10px',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap' as const,
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(163,48,201,0.05)'; e.currentTarget.style.borderColor = 'rgba(163,48,201,0.2)'; e.currentTarget.style.color = '#666'; }}
                          >
                            Quit
                          </button>
                        </div>
                      </div>

                      {/* Row 2: 5 Member Slots moved to MythicGroupSlots */}
                      <div className="border-t border-white/5 pt-4">
                        <MythicGroupSlots fullKey={fullKey} isMyKey={false} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Roster-Style Keys List --- */}
      <h2 className="text-[13px] font-black uppercase tracking-[0.4em] text-gray-500 mb-4 mt-6 ml-1 px-1 border-l-2 border-accent pl-4">
        Keys from the Guild
      </h2>
      <div className="flex flex-col gap-[2px]">
        {filteredMains.map(main => {
          const mainKey = main.keys && main.keys.length > 0 ? main.keys[0] : null;
          const hasAlts = main.alts && main.alts.length > 0;

          const altMatches = main.alts?.filter((alt: any) => matchesFilter(alt)) || [];
          const filterActive = keyFilter.search || keyFilter.min > 0 || keyFilter.max < 99;

          const anyAltMatches = filterActive && altMatches.length > 0;

          const isExpanded = expandedMains.includes(main.id) || anyAltMatches;

          return (
            <div key={main.id} className="flex flex-col">
              {renderCharRow(main, true, mainKey)}

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

                  {isExpanded && (
                    <div className="flex flex-col gap-[2px] mt-[2px] ml-4 animate-in slide-in-from-top-2 duration-200">
                      {(filterActive ? altMatches : main.alts).map((alt: any) => {
                        const altKey = alt.keys && alt.keys.length > 0 ? alt.keys[0] : null;
                        return <div key={alt.id}>{renderCharRow(alt, false, altKey)}</div>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredMains.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 bg-[#1a1a1a] rounded-2xl border border-dashed border-gray-800">
            <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            <p className="text-gray-400 font-bold text-lg">Keine Mythic+ Keys gefunden</p>
            <p className="text-gray-500 text-sm mt-1">Gildenmitglieder müssen die Desktop-App nutzen, um ihre Keys zu synchronisieren.</p>
          </div>
        )}
      </div>

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

      {/* Character Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 10000,
            background: '#1D1E1F',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            minWidth: '160px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setMessageReceiver({ id: contextMenu.charId, name: contextMenu.charName });
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: '#d1d5db',
              fontSize: '12px',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            className="hover:bg-accent hover:text-white"
          >
            <span>💬</span> Nachricht senden
          </button>
        </div>
      )}

      {/* Message Popup */}
      {messageReceiver && (
        <MessagePopup
          receiverId={messageReceiver.id}
          receiverName={messageReceiver.name}
          onClose={() => setMessageReceiver(null)}
          onSuccess={() => {
            // Optional: Show a subtle toast or notification
            console.log('Message sent successfully');
          }}
        />
      )}
    </section>
  );
}
