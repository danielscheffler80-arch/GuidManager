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

  // Selection for which guild we are currently managing visibility
  const [selectedVisibilityGuildId, setSelectedVisibilityGuildId] = useState<number | null>(() => {
    if (user?.guildMemberships && user.guildMemberships.length > 0) {
      return user.guildMemberships[0].guildId;
    }
    return null;
  });

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

  const updateCharacterField = async (charId: number, fieldData: any) => {
    setUpdatingChars(prev => [...prev, charId]);
    try {
      const data = await CharacterService.updateCharacter(charId, fieldData);
      if (data.success) {
        setCharacters(prev => prev.map(c => c.id === charId ? { ...c, ...fieldData } : c));
      }
    } catch (err) {
      console.error('Failed to update character field:', err);
    } finally {
      setUpdatingChars(prev => prev.filter(id => id !== charId));
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

  const getRoleIcon = (role: string | null) => {
    const r = role?.toLowerCase();
    const baseUrl = 'https://render.worldofwarcraft.com/us/icons/56';
    if (r === 'tank') return `${baseUrl}/inv_shield_06.jpg`;
    if (r === 'healer' || r === 'heal') return `${baseUrl}/spell_holy_renew.jpg`;
    if (r === 'dps') return `${baseUrl}/inv_sword_04.jpg`;
    return null;
  };

  const RoleIcon = ({ role, size = 18 }: { role: string | null, size?: number }) => {
    const iconUrl = getRoleIcon(role);
    const fallbackEmoji = role?.toLowerCase() === 'tank' ? '🛡️' : (role?.toLowerCase() === 'healer' || role?.toLowerCase() === 'heal' ? '➕' : '⚔️');

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
      </div>
    );
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  useEffect(() => {
    if (user?.guildMemberships && user.guildMemberships.length > 0 && !selectedVisibilityGuildId) {
      setSelectedVisibilityGuildId(user.guildMemberships[0].guildId);
    }
  }, [user, selectedVisibilityGuildId]);

  // Check leadership status when user or characters change
  useEffect(() => {
    if (user && user.guildMemberships && user.guildMemberships.length > 0) {
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
    if (progress.includes('M')) return '#FF8000'; // Mythic
    if (progress.includes('H')) return '#A335EE'; // Heroic
    if (progress.includes('N')) return '#0070DD'; // Normal
    if (progress.includes('L')) return '#1EFF00'; // LFR
    return '#ABD473';
  };

  const getRIOColor = (score: number | undefined) => {
    if (score === undefined || score === 0) return '#666';
    if (score >= 3500) return '#FF8000';
    if (score >= 3000) return '#A335EE';
    if (score >= 2000) return '#0070DD';
    return '#1EFF00';
  };

  const getIlvlColor = (ilvl: number | undefined) => {
    if (!ilvl) return '#666';
    if (ilvl >= 160) return '#1EFF00';
    if (ilvl >= 130) return '#FFFF00';
    if (ilvl >= 90) return '#FF8000';
    return '#FF0000';
  };

  const handleOpenLink = (type: 'armory' | 'rio' | 'wcl', name: string, realm: string) => {
    const nameLower = name.toLowerCase();
    const realmLower = realm.toLowerCase();
    let url = '';

    if (type === 'armory') url = `https://worldofwarcraft.blizzard.com/de-de/character/eu/${realmLower}/${nameLower}`;
    else if (type === 'rio') url = `https://raider.io/characters/eu/${realmLower}/${nameLower}`;
    else if (type === 'wcl') url = `https://www.warcraftlogs.com/character/eu/${realmLower}/${nameLower}`;

    if (url && (window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(url);
    }
  };

  return (
    <div className="page-container p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Configuration Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#1D1E1F] p-6 rounded-2xl border border-[#333] shadow-xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white tracking-tight">Account Management</h2>
          <p className="text-gray-400 text-sm">Manage your characters, roles, and guild visibility.</p>
        </div>

        <div className="flex flex-col gap-2 min-w-[240px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Visibility focus</label>
          <div className="relative">
            <select
              value={selectedVisibilityGuildId || ''}
              onChange={(e) => setSelectedVisibilityGuildId(Number(e.target.value))}
              className="w-full bg-[#121214] border border-[#333] text-white py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-accent transition-all appearance-none cursor-pointer pr-10"
            >
              <option value="" disabled>Select Guild...</option>
              {user?.guildMemberships?.map(ms => (
                <option key={ms.guildId} value={ms.guildId}>{ms.guild.name} ({ms.guild.realm})</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sortedCharacters.map(char => {
              const classColor = getClassColor(char.classId);
              const isUpdating = updatingChars.includes(char.id);
              const isVisibleInSelected = selectedVisibilityGuildId ? (char.allowedGuildIds || []).includes(selectedVisibilityGuildId) : false;

              return (
                <div
                  key={char.id}
                  className={`bg-[#1D1E1F] rounded-xl flex flex-col md:flex-row md:items-center justify-between p-4 border transition-all duration-300 ${char.isMain ? 'border-accent shadow-[0_0_15px_rgba(163,48,201,0.15)]' : 'border-[#333] hover:border-[#444]'}`}
                >
                  {/* Left Section: Fav + Identification */}
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={() => toggleFavorite(char.id)}
                      className={`text-xl transition-all hover:scale-125 ${char.isFavorite ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]' : 'text-gray-700 hover:text-gray-500'}`}
                    >
                      ★
                    </button>

                    <div className="min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenLink('armory', char.name, char.realm)}
                          className="font-bold text-lg hover:underline transition-all"
                          style={{ color: classColor }}
                        >
                          {capitalizeName(char.name)}
                        </button>
                        {char.isMain && (
                          <span className="text-[10px] font-black bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30 tracking-wider">MAIN</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs font-medium">{formatRealm(char.realm)}</p>
                    </div>
                  </div>

                  {/* Middle Section: Stats & Links */}
                  <div className="flex items-center md:justify-center gap-8 flex-[1.5] py-4 md:py-0 border-y md:border-y-0 border-[#333] my-4 md:my-0">
                    <div className="text-center group cursor-help">
                      <p className="text-[9px] font-black uppercase text-gray-600 tracking-tighter mb-0.5">Ilvl</p>
                      <p className="font-bold text-sm" style={{ color: getIlvlColor(char.averageItemLevel) }}>{char.averageItemLevel || '-'}</p>
                    </div>

                    <button
                      onClick={() => handleOpenLink('rio', char.name, char.realm)}
                      className="text-center group transition-transform hover:-translate-y-0.5"
                    >
                      <p className="text-[9px] font-black uppercase text-gray-600 tracking-tighter mb-0.5">RIO</p>
                      <p className="font-bold text-sm" style={{ color: getRIOColor(char.mythicRating) }}>{char.mythicRating?.toFixed(0) || '-'}</p>
                    </button>

                    <button
                      onClick={() => handleOpenLink('wcl', char.name, char.realm)}
                      className="text-center group transition-transform hover:-translate-y-0.5"
                    >
                      <p className="text-[9px] font-black uppercase text-gray-600 tracking-tighter mb-0.5">Prog</p>
                      <p className="font-bold text-sm" style={{ color: getDifficultyColor(char.raidProgress || '') }}>{char.raidProgress || '-'}</p>
                    </button>
                  </div>

                  {/* Right Section: Roles & Visibility */}
                  <div className="flex items-center justify-between md:justify-end gap-6 flex-1">
                    {/* Role Pickers */}
                    <div className="flex flex-col gap-2">
                      {/* Main Role */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-gray-600 uppercase w-8">Main:</span>
                        <div className="flex gap-1">
                          {['tank', 'healer', 'dps'].map(r => (
                            <button
                              key={`main-${r}`}
                              onClick={() => updateCharacterField(char.id, { role: r })}
                              className={`p-1.5 rounded-lg border transition-all ${char.role?.toLowerCase() === (r === 'healer' ? 'healer' : r) ? 'bg-accent border-accent text-white' : 'bg-[#121214] border-[#333] text-gray-600 hover:border-gray-500 hover:text-gray-400'}`}
                              disabled={isUpdating}
                            >
                              <RoleIcon role={r} size={16} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Secondary Role */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-gray-600 uppercase w-8">Off:</span>
                        <div className="flex gap-1">
                          {['tank', 'healer', 'dps'].map(r => (
                            <button
                              key={`off-${r}`}
                              onClick={() => updateCharacterField(char.id, { secondaryRole: r })}
                              className={`p-1.5 rounded-lg border transition-all ${char.secondaryRole?.toLowerCase() === (r === 'healer' ? 'healer' : r) ? 'bg-accent/40 border-accent/60 text-white' : 'bg-[#121214] border-[#333] text-gray-600 hover:border-gray-500 hover:text-gray-400'}`}
                              disabled={isUpdating}
                            >
                              <RoleIcon role={r} size={16} />
                            </button>
                          ))}
                          <button
                            onClick={() => updateCharacterField(char.id, { secondaryRole: null })}
                            className={`p-1.5 rounded-lg border transition-all ${!char.secondaryRole ? 'bg-red-500/20 border-red-500/30 text-red-500' : 'bg-[#121214] border-[#333] text-gray-600 hover:border-red-500/50 hover:text-red-400'}`}
                            title="No off-spec"
                          >
                            <span className="text-xs">✕</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Visibility & Main Toggle */}
                    <div className="flex flex-col items-end gap-3 min-w-[100px]">
                      {selectedVisibilityGuildId && (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => toggleGuildVisibility(char.id, selectedVisibilityGuildId, char.allowedGuildIds || [])}>
                          <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${isVisibleInSelected ? 'text-accent' : 'text-gray-600'}`}>Visible</span>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${isVisibleInSelected ? 'bg-accent' : 'bg-[#333]'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isVisibleInSelected ? 'left-[17px]' : 'left-0.5'}`} />
                          </div>
                        </div>
                      )}

                      {!char.isMain && (
                        <button
                          onClick={() => setMainCharacter(char.id)}
                          className="text-[10px] font-black text-gray-500 hover:text-accent uppercase tracking-tighter border border-[#333] hover:border-accent px-3 py-1 rounded-full transition-all"
                        >
                          Make Main
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Account Info Footer */}
      <div className="bg-[#1D1E1F] p-6 rounded-2xl border border-[#333] shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center text-accent text-2xl">
            👤
          </div>
          <div>
            <p className="text-white font-bold text-lg">{capitalizeName(user?.battletag)}</p>
            <p className="text-gray-500 text-xs">Battle.net ID: {user?.battlenetId}</p>
          </div>
        </div>

        {String(user?.battlenetId) === '100379014' && (
          <div className="bg-accent/10 border border-accent/20 px-4 py-2 rounded-xl">
            <p className="text-accent font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
              <span className="animate-pulse">✨</span> Superuser-Modus aktive
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
