import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatRealm, capitalizeName } from '../utils/formatUtils';
import { CharacterService } from '../api/characterService';
import { GuildService } from '../api/guildService';
import { useGuild } from '../contexts/GuildContext';
import { storage } from '../utils/storage';

interface Character {
  id: number;
  name: string;
  realm: string;
  class: string;
  classId: number;
  level: number;
  faction: string;
  isMain: boolean;
  isFavorite: boolean;
  averageItemLevel?: number;
  mythicRating?: number;
  raidProgress?: string;
  role?: string;
  secondaryRole?: string;
  allowedGuildIds?: number[];
}

type SortField = 'ilvl' | 'rio' | 'progress';

export default function Settings() {
  const { user } = useAuth();
  const { settingsSortField } = useGuild();
  const [characters, setCharacters] = useState<Character[]>(() => storage.get('cache_settings_characters', []));
  const [isLoading, setIsLoading] = useState(!storage.get('cache_settings_characters', null));
  const [updatingChars, setUpdatingChars] = useState<number[]>([]);

  // Permissions & Ranks state
  const [availableRanks, setAvailableRanks] = useState<{ id: number, name: string }[]>([]);
  const [adminRanks, setAdminRanks] = useState<number[]>([]);
  const [visibleRanks, setVisibleRanks] = useState<number[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [currentGuildId, setCurrentGuildId] = useState<number | null>(null);

  const fetchRanks = async (guildId: number) => {
    try {
      const data = await GuildService.getRanks(guildId);
      if (data.success) {
        setAvailableRanks(data.ranks);
        setAdminRanks(data.currentAdminRanks || []);
        setVisibleRanks(data.currentVisibleRanks || []);
      }
    } catch (err) {
      console.error('Failed to fetch guild ranks:', err);
    }
  };

  const updateAdminRanks = async (newRanks: number[]) => {
    if (!currentGuildId) return;
    try {
      const data = await GuildService.updateAdminRanks(currentGuildId, newRanks);
      if (data.success) {
        setAdminRanks(newRanks);
      }
    } catch (err) {
      console.error('Failed to update admin ranks:', err);
    }
  };

  const toggleAdminRank = (rankId: number) => {
    const newRanks = adminRanks.includes(rankId)
      ? adminRanks.filter(id => id !== rankId)
      : [...adminRanks, rankId];
    updateAdminRanks(newRanks);
  };

  const updateVisibleRanks = async (newRanks: number[]) => {
    if (!currentGuildId) return;
    try {
      const data = await GuildService.updateVisibleRanks(currentGuildId, newRanks);
      if (data.success) {
        setVisibleRanks(newRanks);
      }
    } catch (err) {
      console.error('Failed to update visible ranks:', err);
    }
  };

  const toggleVisibleRank = (rankId: number) => {
    const newRanks = visibleRanks.includes(rankId)
      ? visibleRanks.filter(id => id !== rankId)
      : [...visibleRanks, rankId];
    updateVisibleRanks(newRanks);
  };

  const fetchCharacters = async () => {
    try {
      const data = await CharacterService.getMyCharacters();
      const allChars = data.user?.characters || data.characters || [];
      setCharacters(allChars);
      storage.set('cache_settings_characters', allChars);
    } catch (err) {
      console.error('Failed to fetch characters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedCharacters = [...characters].sort((a, b) => {
    // 1. Priorität: Main immer ganz oben
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;

    // 2. Priorität: Favoriten über Rest
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    // 3. Innerhalb der Gruppen nach gewähltem Feld sortieren
    if (settingsSortField === 'ilvl') {
      return (b.averageItemLevel || 0) - (a.averageItemLevel || 0);
    }
    if (settingsSortField === 'rio') {
      return (b.mythicRating || 0) - (a.mythicRating || 0);
    }
    // Progress sortiert alphabetisch als Fallback
    return (b.raidProgress || '').localeCompare(a.raidProgress || '');
  });

  const setMainCharacter = async (charId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const backendUrl = (window as any).electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
      const response = await fetch(`${backendUrl}/users/characters/main`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ characterId: charId })
      });

      if (response.ok) {
        fetchCharacters();
      }
    } catch (err) {
      console.error('Failed to set main character:', err);
    }
  };

  const toggleAllGuildVisibility = async (guildId: number, visible: boolean) => {
    setIsLoading(true);
    try {
      const data = await CharacterService.bulkUpdateVisibility(guildId, visible);
      if (data.success) {
        // Update all characters locally
        setCharacters(prev => prev.map(c => {
          let allowed = c.allowedGuildIds || [];
          if (visible && !allowed.includes(guildId)) {
            allowed = [...allowed, guildId];
          } else if (!visible && allowed.includes(guildId)) {
            allowed = allowed.filter(id => id !== guildId);
          }
          return { ...c, allowedGuildIds: allowed };
        }));
      }
    } catch (err) {
      console.error('Failed to update bulk guild visibility:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGuildVisibility = async (charId: number, guildId: number, currentAllowed: number[]) => {
    setUpdatingChars(prev => [...prev, charId]);
    try {
      const isAllowed = currentAllowed.includes(guildId);
      const newAllowed = isAllowed
        ? currentAllowed.filter(id => id !== guildId)
        : [...currentAllowed, guildId];

      const data = await CharacterService.updateVisibility(charId, newAllowed);
      if (data.success) {
        setCharacters(prev => prev.map(c => c.id === charId ? { ...c, allowedGuildIds: data.allowedGuildIds } : c));
      }
    } catch (err) {
      console.error('Failed to update guild visibility:', err);
    } finally {
      setUpdatingChars(prev => prev.filter(id => id !== charId));
    }
  };

  const toggleFavorite = async (charId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const backendUrl = (window as any).electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
      const response = await fetch(`${backendUrl}/auth/favorite-character`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ characterId: charId })
      });

      if (response.ok) {
        fetchCharacters();
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const updateCharacterRole = async (charId: number, role: string, isSecondary: boolean = false) => {
    setUpdatingChars(prev => [...prev, charId]);
    try {
      const field = isSecondary ? 'secondaryRole' : 'role';
      const data = await CharacterService.updateCharacter(charId, { [field]: role });
      if (data.success) {
        // Update local state immediately for fast feedback
        setCharacters(prev => prev.map(c => c.id === charId ? { ...c, [field]: role } : c));
      }
    } catch (err) {
      console.error(`Failed to update character ${isSecondary ? 'secondary ' : ''}role:`, err);
    } finally {
      setUpdatingChars(prev => prev.filter(id => id !== charId));
    }
  };

  const getRoleIcon = (role: string | null) => {
    const r = role?.toLowerCase();
    const baseUrl = 'https://render.worldofwarcraft.com/us/icons/56';
    if (r === 'tank') return `${baseUrl}/inv_shield_06.jpg`;
    if (r === 'healer') return `${baseUrl}/spell_holy_renew.jpg`;
    if (r === 'dps') return `${baseUrl}/inv_sword_04.jpg`;
    return null;
  };

  const RoleIcon = ({ role, size = 18 }: { role: string | null, size?: number }) => {
    const iconUrl = getRoleIcon(role);
    const fallbackEmoji = role?.toLowerCase() === 'tank' ? '🛡️' : role?.toLowerCase() === 'healer' ? '➕' : '⚔️';

    if (!iconUrl) return <span style={{ fontSize: `${size}px` }}>{fallbackEmoji}</span>;
    return (
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={iconUrl}
          alt={role || 'Unknown'}
          style={{ width: '100%', height: '100%', borderRadius: '3px' }}
          className="inline-block"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Fallback Emoji below the image (only shown if image fails, handled by img onError) */}
      </div>
    );
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  // Check leadership status when user or characters change
  useEffect(() => {
    if (user && user.guildMemberships && user.guildMemberships.length > 0) {
      // Suche nach einer Mitgliedschaft mit Rank 0 (Gildenleiter)
      const leaderMembership = user.guildMemberships.find(m => m.rank === 0);
      if (leaderMembership) {
        setIsLeader(true);
        setCurrentGuildId(leaderMembership.guildId);
        fetchRanks(leaderMembership.guildId);
      } else {
        setIsLeader(false);
        setCurrentGuildId(null);
      }
    }
  }, [user]);

  const getClassColor = (classId: number) => {
    const colors: Record<number, string> = {
      1: '#C79C6E', 2: '#F58CBA', 3: '#ABD473', 4: '#FFF569',
      5: '#FFFFFF', 6: '#C41F3B', 7: '#0070DE', 8: '#69CCF0',
      9: '#9482C9', 10: '#00FF96', 11: '#FF7D0A', 12: 'var(--accent)', 13: '#33937F'
    };
    return colors[classId] || '#D1D9E0';
  };

  const getDifficultyColor = (progress: string) => {
    if (!progress || progress === '-') return '#D1D9E0';
    if (progress.includes('M')) return '#FF8000'; // Mythic (Orange)
    if (progress.includes('H')) return '#A335EE'; // Heroic (Purple)
    if (progress.includes('N')) return '#0070DD'; // Normal (Blue)
    if (progress.includes('L')) return '#1EFF00'; // LFR (Green)
    return '#ABD473'; // Fallback Green
  };

  const getRIOColor = (score: number | undefined) => {
    if (score === undefined || score === 0) return '#666';
    if (score >= 3500) return '#FF8000'; // Orange
    if (score >= 3000) return '#A335EE'; // Purple
    if (score >= 2000) return '#0070DD'; // Blue
    return '#1EFF00'; // Green
  };

  const getIlvlColor = (ilvl: number | undefined) => {
    if (!ilvl) return '#666';
    if (ilvl >= 160) return '#1EFF00'; // Green
    if (ilvl >= 130) return '#FFFF00'; // Yellow
    if (ilvl >= 90) return '#FF8000';  // Orange
    return '#FF0000';                 // Red
  };

  const handleOpenLink = (type: 'armory' | 'rio' | 'wcl', name: string, realm: string) => {
    const nameLower = name.toLowerCase();
    const realmLower = realm.toLowerCase();
    let url = '';

    if (type === 'armory') {
      url = `https://worldofwarcraft.blizzard.com/de-de/character/eu/${realmLower}/${nameLower}`;
    } else if (type === 'rio') {
      url = `https://raider.io/characters/eu/${realmLower}/${nameLower}`;
    } else if (type === 'wcl') {
      url = `https://www.warcraftlogs.com/character/eu/${realmLower}/${nameLower}`;
    }

    if (url && (window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(url);
    }
  };

  return (
    <div className="page-container">
      <section style={{ marginTop: '5px' }}>
        {isLoading ? (
          <p>Lade Charaktere...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
            {/* Globale Gilden-Sichtbarkeit Cards */}
            {user?.guildMemberships && user.guildMemberships.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <h3 style={{ fontSize: '1em', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Globale Gilden-Sichtbarkeit</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                  {user.guildMemberships.map(ms => {
                    const isVisibleForAll = characters.length > 0 && characters.every(c => (c.allowedGuildIds || []).includes(ms.guildId));
                    const isVisibleForSome = characters.some(c => (c.allowedGuildIds || []).includes(ms.guildId));

                    return (
                      <div
                        key={ms.guildId}
                        onClick={() => toggleAllGuildVisibility(ms.guildId, !isVisibleForAll)}
                        style={{
                          background: isVisibleForAll ? 'rgba(163, 48, 201, 0.2)' : '#1D1E1F',
                          border: `1px solid ${isVisibleForAll ? 'var(--accent)' : (isVisibleForSome ? 'rgba(163, 48, 201, 0.4)' : '#333')}`,
                          padding: '15px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          textAlign: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={(e) => {
                          if (!isVisibleForAll) e.currentTarget.style.borderColor = isVisibleForSome ? 'rgba(163, 48, 201, 0.4)' : '#333';
                        }}
                      >
                        <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: isVisibleForAll ? 'var(--accent)' : '#fff' }}>{ms.guild.name}</div>
                        <div style={{ fontSize: '0.8em', color: '#666' }}>{ms.guild.realm}</div>
                        <div style={{
                          marginTop: '5px',
                          fontSize: '0.75em',
                          color: isVisibleForAll ? 'var(--accent)' : (isVisibleForSome ? 'rgba(163, 48, 201, 0.8)' : '#444'),
                          fontWeight: 'bold'
                        }}>
                          {isVisibleForAll ? 'ALLE CHARS SICHTBAR' : (isVisibleForSome ? 'TEILWEISE SICHTBAR' : 'NICHT SICHTBAR')}
                        </div>
                        {/* Progress Bar (Subtle) */}
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          height: '3px',
                          background: 'var(--accent)',
                          width: `${(characters.filter(c => (c.allowedGuildIds || []).includes(ms.guildId)).length / characters.length) * 100}%`,
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Characters Section */}
            {sortedCharacters.map(char => (
              <div
                key={char.id}
                style={{
                  background: '#1D1E1F',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: char.isMain ? '1px solid var(--accent)' : '1px solid #333',
                  transition: 'border-color 0.2s',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {/* 1. Spalte: Favoriten-Stern */}
                <div style={{ width: '40px', flexShrink: 0 }}>
                  <div
                    onClick={() => toggleFavorite(char.id)}
                    style={{
                      cursor: 'pointer', fontSize: '1.4em',
                      color: char.isFavorite ? '#FFD700' : '#333',
                      userSelect: 'none'
                    }}
                    title={char.isFavorite ? 'Von Favoriten entfernen' : 'Als Favorit markieren'}
                  >★</div>
                </div>

                {/* 2. Spalte: Name & Realm */}
                <div style={{ flex: '2', minWidth: '150px', flexShrink: 0 }}>
                  <div
                    onClick={() => handleOpenLink('armory', char.name, char.realm)}
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1.1em',
                      color: getClassColor(char.classId),
                      cursor: 'pointer',
                      display: 'inline-block'
                    }}
                    title="Im Arsenal öffnen"
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {capitalizeName(char.name)}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>{formatRealm(char.realm)}</div>
                </div>

                {/* 3. Spalte: Item Level */}
                <div style={{ flex: '1', minWidth: '70px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Ilvl</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getIlvlColor(char.averageItemLevel) }}>{char.averageItemLevel || '-'}</div>
                </div>

                <div
                  onClick={() => handleOpenLink('rio', char.name, char.realm)}
                  style={{ flex: '1', minWidth: '70px', flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}
                  title="Auf Raider.io öffnen"
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>RIO</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getRIOColor(char.mythicRating) }}>{char.mythicRating?.toFixed(0) || '-'}</div>
                </div>

                <div
                  onClick={() => handleOpenLink('wcl', char.name, char.realm)}
                  style={{ flex: '1', minWidth: '90px', flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}
                  title="Auf Warcraft Logs öffnen"
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Raid</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getDifficultyColor(char.raidProgress || '') }}>{char.raidProgress || '-'}</div>
                </div>

                {/* 6. Spalte: Rolle */}
                <div style={{ flex: '1.2', minWidth: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.70em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Main Role</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { id: 'tank', label: 'Tank' },
                      { id: 'healer', label: 'Heal' },
                      { id: 'dps', label: 'DPS' }
                    ].map(r => (
                      <button
                        key={r.id}
                        onClick={() => updateCharacterRole(char.id, r.id, false)}
                        title={r.label}
                        style={{
                          background: char.role?.toLowerCase() === r.id ? 'var(--accent)' : '#121214',
                          border: '1px solid #333',
                          borderRadius: '6px',
                          padding: '5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          opacity: updatingChars.includes(char.id) ? 0.3 : (char.role?.toLowerCase() === r.id ? 1 : 0.4),
                          pointerEvents: updatingChars.includes(char.id) ? 'none' : 'auto'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => {
                          if (char.role?.toLowerCase() !== r.id) e.currentTarget.style.opacity = '0.4';
                        }}
                      >
                        <RoleIcon role={r.id} size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 7. Spalte: 2nd Role */}
                <div style={{ flex: '1.2', minWidth: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.70em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2nd Role</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { id: 'tank', label: '2nd Tank' },
                      { id: 'healer', label: '2nd Heal' },
                      { id: 'dps', label: '2nd DPS' }
                    ].map(r => (
                      <button
                        key={r.id}
                        onClick={() => updateCharacterRole(char.id, r.id, true)}
                        title={r.label}
                        style={{
                          background: char.secondaryRole?.toLowerCase() === r.id ? 'var(--accent)' : '#121214',
                          border: '1px solid #333',
                          borderRadius: '6px',
                          padding: '5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          opacity: updatingChars.includes(char.id) ? 0.3 : (char.secondaryRole?.toLowerCase() === r.id ? 1 : 0.4),
                          pointerEvents: updatingChars.includes(char.id) ? 'none' : 'auto'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => {
                          if (char.secondaryRole?.toLowerCase() !== r.id) e.currentTarget.style.opacity = '0.4';
                        }}
                      >
                        <RoleIcon role={r.id} size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 8. Spalte: Sichtbar in: */}
                {/* 8. Spalte: Gilden (Sichtbarkeit) */}
                <div style={{ flex: '1.8', minWidth: '140px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {user?.guildMemberships?.map(ms => {
                      const isAllowed = (char.allowedGuildIds || []).includes(ms.guildId);
                      return (
                        <button
                          key={ms.guildId}
                          onClick={() => toggleGuildVisibility(char.id, ms.guildId, char.allowedGuildIds || [])}
                          title={isAllowed ? `In ${ms.guild.name} verstecken` : `In ${ms.guild.name} anzeigen`}
                          style={{
                            padding: '4px 8px',
                            background: isAllowed ? 'rgba(163, 48, 201, 0.2)' : '#121214',
                            border: `1px solid ${isAllowed ? 'var(--accent)' : '#333'}`,
                            borderRadius: '15px',
                            fontSize: '0.75em',
                            color: isAllowed ? 'var(--accent)' : '#666',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            opacity: updatingChars.includes(char.id) ? 0.3 : 1,
                            pointerEvents: updatingChars.includes(char.id) ? 'none' : 'auto'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onMouseLeave={(e) => {
                            if (!isAllowed) e.currentTarget.style.borderColor = '#333';
                          }}
                        >
                          {ms.guild.name.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ width: '150px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  {char.isMain ? (
                    <span style={{
                      background: 'rgba(163, 48, 201, 0.2)', color: 'var(--accent)', padding: '6px 15px',
                      borderRadius: '20px', fontSize: '0.75em', fontWeight: '900', border: '1px solid var(--accent)',
                      letterSpacing: '1px'
                    }}>MAIN</span>
                  ) : (
                    <button
                      onClick={() => setMainCharacter(char.id)}
                      style={{
                        background: 'transparent', border: '1px solid #444',
                        color: '#818181', padding: '6px 15px', borderRadius: '20px',
                        fontSize: '0.75em', cursor: 'pointer', transition: 'all 0.2s',
                        fontWeight: 'bold'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.color = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        if (!char.isMain) {
                          e.currentTarget.style.borderColor = '#444';
                          e.currentTarget.style.color = '#818181';
                        }
                      }}
                    >Als Main setzen</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: '50px', padding: '20px', background: '#2D2D2D', borderRadius: '12px', border: '1px solid #444' }}>
        <h3 style={{ marginTop: 0 }}>Account-Informationen</h3>
        <p>Eingeloggt als: <strong>{capitalizeName(user?.battletag)}</strong></p>
        <p style={{ fontSize: '0.9em', color: '#888' }}>Battle.net ID: {user?.battlenetId}</p>

        {String(user?.battlenetId) === '100379014' && (
          <p style={{ color: 'var(--accent)', fontWeight: 'bold', marginTop: '10px' }}>✨ Superuser-Modus aktiv (Debug/Test)</p>
        )}
      </section>
    </div>
  );
}
