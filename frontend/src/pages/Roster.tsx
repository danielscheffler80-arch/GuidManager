import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GuildService } from '../api/guildService';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';
import { capitalizeName, formatRealm } from '../utils/formatUtils';
import { storage } from '../utils/storage';

interface Member {
  id: number;
  name: string;
  realm: string;
  level: number;
  class: string;
  classId: number;
  race: string;
  role: string | null;
  averageItemLevel: number | null;
  mythicRating: number | null;
  raidProgress: string | null;
  lastSync: string;
}

export default function Roster() {
  const { user } = useAuth();
  const {
    guilds,
    selectedGuild,
    setSelectedGuild,
    loading: guildLoading,
    selectedRosterView,
    setSelectedRosterView,
    isRosterSyncing,
    lastRosterSyncAt
  } = useGuild();

  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);

  // ... (existing useEffects)

  // ... (existing loadInitialData, fetchRanks, updateAdminRanks, updateVisibleRanks, toggleAdminRank, toggleVisibleRank, loadRoster, triggerSync, toggleShowFiltered, getClassColor, getRIOColor, getDifficultyColor)

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
      <img
        src={iconUrl}
        alt={role || 'Unknown'}
        style={{ width: `${size}px`, height: `${size}px`, borderRadius: '4px' }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          const next = (e.target as HTMLImageElement).nextElementSibling;
          if (next) (next as HTMLElement).style.display = 'inline';
        }}
      />
    );
  };

  const { rosterSortField } = useGuild();

  const filteredRosterMembers = roster.filter(member => {
    if (selectedRosterView === 'main') {
      return metadata?.visibleRanks?.includes(Number((member as any).rank));
    }
    return true;
  }).sort((a, b) => {
    if (rosterSortField === 'rank') {
      const rankA = (a as any).rank ?? 99;
      const rankB = (b as any).rank ?? 99;
      if (rankA !== rankB) return rankA - rankB;

      const roleOrder: Record<string, number> = { 'tank': 1, 'dps': 2, 'healer': 3 };
      const roleA = roleOrder[a.role?.toLowerCase() || ''] || 4;
      const roleB = roleOrder[b.role?.toLowerCase() || ''] || 4;
      if (roleA !== roleB) return roleA - roleB;
    } else if (rosterSortField === 'role') {
      const roleOrder: Record<string, number> = { 'tank': 1, 'dps': 2, 'healer': 3 };
      const roleA = roleOrder[a.role?.toLowerCase() || ''] || 4;
      const roleB = roleOrder[b.role?.toLowerCase() || ''] || 4;
      if (roleA !== roleB) return roleA - roleB;

      const rankA = (a as any).rank ?? 99;
      const rankB = (b as any).rank ?? 99;
      if (rankA !== rankB) return rankA - rankB;
    } else if (rosterSortField === 'ilvl') {
      const ilvlA = a.averageItemLevel || 0;
      const ilvlB = b.averageItemLevel || 0;
      if (ilvlA !== ilvlB) return ilvlB - ilvlA;

      const rankA = (a as any).rank ?? 99;
      const rankB = (b as any).rank ?? 99;
      if (rankA !== rankB) return rankA - rankB;
    }

    return a.name.localeCompare(b.name);
  });
  const [availableRanks, setAvailableRanks] = useState<{ id: number, name: string }[]>([]);
  const [adminRanks, setAdminRanks] = useState<number[]>([]);
  const [visibleRanks, setVisibleRanks] = useState<number[]>([]);
  const [isLeader, setIsLeader] = useState(false);

  const [sessionSyncs, setSessionSyncs] = useState<number[]>([]);
  const [showFiltered, setShowFiltered] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      loadRoster(selectedGuild.id);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, selectedRosterView, guildLoading, lastRosterSyncAt]);

  useEffect(() => {
    if (user && selectedGuild) {
      loadRoster(selectedGuild.id);
    }
  }, [user, selectedGuild]);


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
    if (!selectedGuild) return;
    try {
      const data = await GuildService.updateAdminRanks(selectedGuild.id, newRanks);
      if (data.success) {
        setAdminRanks(newRanks);
      }
    } catch (err) {
      console.error('Failed to update admin ranks:', err);
    }
  };

  const updateVisibleRanks = async (newRanks: number[]) => {
    if (!selectedGuild) return;
    try {
      const data = await GuildService.updateVisibleRanks(selectedGuild.id, newRanks);
      if (data.success) {
        setVisibleRanks(newRanks);
        loadRoster(selectedGuild.id); // Reload filtered roster
      }
    } catch (err) {
      console.error('Failed to update visible ranks:', err);
    }
  };

  const toggleAdminRank = (rankId: number) => {
    const newRanks = adminRanks.includes(rankId)
      ? adminRanks.filter(id => id !== rankId)
      : [...adminRanks, rankId];
    updateAdminRanks(newRanks);
  };

  const toggleVisibleRank = (rankId: number) => {
    const newRanks = visibleRanks.includes(rankId)
      ? visibleRanks.filter(id => id !== rankId)
      : [...visibleRanks, rankId];
    updateVisibleRanks(newRanks);
  };

  const loadRoster = async (guildId: number, forceShowFiltered = false) => {
    setLoading(true);
    try {
      const showAll = selectedRosterView === 'all' || forceShowFiltered || showFiltered;
      const data = await GuildService.getRoster(guildId, showAll);
      setRoster(data.roster || []);
      setMetadata(data.metadata || null);

      // Update cache
      storage.set(`cache_roster_data_${guildId}`, data.roster || []);
      storage.set(`cache_roster_metadata_${guildId}`, data.metadata || null);

      if (data.metadata?.ranks) {
        const mappedRanks = data.metadata.ranks.map((r: any) => ({
          id: r.rank !== undefined ? r.rank : r.id,
          name: r.name
        })).sort((a: any, b: any) => a.id - b.id);

        setAvailableRanks(mappedRanks);
      }
    } catch (error) {
      console.error('Failed to load roster', error);
    } finally {
      setLoading(false);
    }
  };



  const toggleShowFiltered = () => {
    const newState = !showFiltered;
    setShowFiltered(newState);
    if (selectedGuild) loadRoster(selectedGuild.id, newState);
  };

  const getClassColor = (classId: number | string) => {
    // If we get a string (fallback), try to map it or return default
    if (typeof classId === 'string') {
      const stringColors: Record<string, string> = {
        'Warrior': '#C79C6E', 'Paladin': '#F58CBA', 'Hunter': '#ABD473', 'Rogue': '#FFF569',
        'Priest': '#FFFFFF', 'Death Knight': '#C41F3B', 'Shaman': '#0070DE', 'Mage': '#69CCF0',
        'Warlock': '#9482C9', 'Monk': '#00FF96', 'Druid': '#FF7D0A', 'Demon Hunter': '#A330C9',
        'Evoker': '#33937F'
      };
      return stringColors[classId] || '#D1D9E0';
    }

    const colors: Record<number, string> = {
      1: '#C79C6E', 2: '#F58CBA', 3: '#ABD473', 4: '#FFF569',
      5: '#FFFFFF', 6: '#C41F3B', 7: '#0070DE', 8: '#69CCF0',
      9: '#9482C9', 10: '#00FF96', 11: '#FF7D0A', 12: '#A330C9', 13: '#33937F'
    };
    return colors[classId] || '#D1D9E0';
  };

  const getRIOColor = (score: number | null) => {
    if (!score) return '#666';
    if (score >= 3500) return '#FF8000';
    if (score >= 3000) return '#A335EE';
    if (score >= 2000) return '#0070DD';
    return '#1EFF00';
  };

  const getDifficultyColor = (progress: string) => {
    if (!progress || progress === '-') return '#D1D9E0';
    if (progress.includes('M')) return '#FF8000'; // Mythic (Orange)
    if (progress.includes('H')) return '#A335EE'; // Heroic (Purple)
    if (progress.includes('N')) return '#0070DD'; // Normal (Blue)
    if (progress.includes('L')) return '#1EFF00'; // LFR (Green)
    return '#ABD473'; // Fallback Green
  };

  const getIlvlColor = (ilvl: number | null) => {
    if (!ilvl) return '#666';
    if (ilvl >= 160) return '#1EFF00'; // Green
    if (ilvl >= 130) return '#FFFF00'; // Yellow
    if (ilvl >= 90) return '#FF8000';  // Orange
    return '#FF0000';                 // Red
  };

  const groupedRoster = {
    Tanks: roster.filter(m => m.role?.toLowerCase() === 'tank'),
    Healers: roster.filter(m => m.role?.toLowerCase() === 'healer'),
    DPS: roster.filter(m => m.role?.toLowerCase() === 'dps'),
    Unassigned: roster.filter(m => !m.role || (m.role.toLowerCase() !== 'tank' && m.role.toLowerCase() !== 'healer' && m.role.toLowerCase() !== 'dps'))
  };


  useEffect(() => {
    if (selectedGuild) {
      loadRoster(selectedGuild.id);
    }
  }, [selectedRosterView]);



  const getRankName = (rankId: number | null) => {
    if (rankId === null || rankId === undefined) return 'Kein Rang';
    const found = availableRanks.find(r => r.id === rankId);
    return found ? found.name : `Rang ${rankId}`;
  };

  return (
    <div className="page-container">
      <style>{`
        .group:hover {
          border-color: #A330C9 !important;
        }
      `}</style>

      <header className="sticky top-0 z-20 bg-[#252525] pt-[20px] -mt-[20px] pb-4" style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
        <div className="flex items-center justify-end px-6 pt-2">
          {isRosterSyncing && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-[#A330C9]"></div>
              <span className="text-[9px] text-[#A330C9] font-black uppercase tracking-widest">Synchronisiere...</span>
            </div>
          )}
        </div>
      </header>


      {
        filteredRosterMembers.length === 0 ? (
          <div className="text-center py-24 bg-[#121214]/50 backdrop-blur-md rounded-3xl">
            <div className="text-6xl mb-6">👥</div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Keine Mitglieder gefunden</h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm font-medium leading-relaxed">
              Der Roster wurde für diese Gilde noch nicht synchronisiert oder entspricht nicht den Filtern.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {filteredRosterMembers.map((member) => {
              const rank = (member as any).rank;
              const rankName = getRankName(rank);

              const classIconKeys: Record<number, string> = {
                1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue',
                5: 'priest', 6: 'deathknight', 7: 'shaman', 8: 'mage',
                9: 'warlock', 10: 'monk', 11: 'druid', 12: 'demonhunter', 13: 'evoker'
              };

              const classKey = member.classId ? classIconKeys[member.classId] : (member.class || '').toLowerCase().replace(' ', '').replace('-', '');
              const classIcon = `https://render.worldofwarcraft.com/us/icons/56/classicon_${classKey}.jpg`;

              const getRealmSlug = (realm: string) => realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
              const charUrlName = member.name.toLowerCase();
              const realmSlug = getRealmSlug(member.realm);

              return (
                <div
                  key={member.id}
                  style={{
                    background: '#1D1E1F',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: (member as any).isMain ? '1px solid #A330C9' : '1px solid #333',
                    transition: 'border-color 0.2s',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  className="group"
                >
                  {/* 1. Spalte: Rolle */}
                  <div style={{ width: '40px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    <RoleIcon role={member.role} size={22} />
                  </div>

                  {/* 2. Spalte: Name & Realm */}
                  <div style={{ width: '220px', flexShrink: 0 }}>
                    <div
                      onClick={() => (window as any).electronAPI.openExternal(`https://worldofwarcraft.com/de-de/character/eu/${realmSlug}/${charUrlName}`)}
                      style={{
                        fontWeight: 'bold',
                        fontSize: '1.1em',
                        color: getClassColor(member.classId || member.class),
                        cursor: 'pointer',
                        display: 'inline-block'
                      }}
                      title="Blizzard Arsenal öffnen"
                    >
                      {capitalizeName(member.name)}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>{formatRealm(member.realm)}</div>
                  </div>

                  {/* 3. Spalte: ILVL */}
                  <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>ILVL</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getIlvlColor(member.averageItemLevel) }}>
                      {member.averageItemLevel || '-'}
                    </div>
                  </div>

                  {/* 4. Spalte: RIO */}
                  <div
                    onClick={() => (window as any).electronAPI.openExternal(`https://raider.io/characters/eu/${realmSlug}/${charUrlName}`)}
                    style={{ width: '100px', flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}
                    title="Raider.IO öffnen"
                  >
                    <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>RIO</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getRIOColor(member.mythicRating) }}>
                      {member.mythicRating?.toFixed(0) || '-'}
                    </div>
                  </div>

                  {/* 5. Spalte: Raid Progress */}
                  <div
                    onClick={() => (window as any).electronAPI.openExternal(`https://www.warcraftlogs.com/character/eu/${realmSlug}/${charUrlName}`)}
                    style={{ width: '180px', flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}
                    title="Warcraft Logs öffnen"
                  >
                    <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>Raid Progress</div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: getDifficultyColor(member.raidProgress || '') }}>
                      {member.raidProgress || '-'}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}></div>

                  {/* 6. Spalte: Gilden-Rang (anstatt Main-Button) */}
                  <div style={{ width: '150px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{
                      background: rank === 0 ? 'rgba(163, 48, 201, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: rank === 0 ? '#A330C9' : '#818181',
                      padding: '6px 15px',
                      borderRadius: '20px',
                      fontSize: '0.75em',
                      fontWeight: rank === 0 ? '900' : 'bold',
                      border: rank === 0 ? '1px solid #A330C9' : '1px solid #444',
                      letterSpacing: rank === 0 ? '1px' : 'normal',
                      textTransform: 'uppercase'
                    }}>
                      {rankName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
