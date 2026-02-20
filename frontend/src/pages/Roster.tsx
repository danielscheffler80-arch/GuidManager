import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GuildService } from '../api/guildService';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import { capitalizeName, formatRealm, getClassColor } from '../utils/formatUtils';
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
  guildId?: number | null;
  rank?: number | null;
}

export default function Roster() {
  const { user, isAdmin } = useAuth();
  const {
    guilds,
    selectedGuild,
    setSelectedGuild,
    loading: guildLoading,
    selectedRosterView,
    setSelectedRosterView,
    isRosterSyncing,
    lastRosterSyncAt,
    availableRosters,
    refreshRosters,
    rosterSortField
  } = useGuild();
  const { filter } = useWebRTC();

  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [extName, setExtName] = useState('');
  const [extRealm, setExtRealm] = useState('');
  const [isAddingExternal, setIsAddingExternal] = useState(false);
  const [realms, setRealms] = useState<{ name: string, slug: string }[]>([]);
  const [realmsLoading, setRealmsLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  const filteredRosterMembers = roster.filter(member => {
    // Filter logic: Ignore 'all' (default stream filter) and empty strings
    const matchesFilter = (filter && filter !== 'all' && filter.trim().length > 0)
      ? member.name.toLowerCase().includes(filter.toLowerCase())
      : false;

    if (selectedRosterView === 'all') {
      const isActuallyExternal = member.guildId !== selectedGuild?.id && !(member as any).userId;
      if (isActuallyExternal) return false;
      return (filter && filter !== 'all' && filter.trim().length > 0) ? matchesFilter : true;
    }

    if (selectedRosterView === 'main') {
      const rawRank = (member as any).rank;
      const rank = rawRank === null || rawRank === undefined ? null : Number(rawRank);

      const isActuallyExternal = member.guildId !== selectedGuild?.id;
      const isVisibleRank = !isActuallyExternal && rank !== null && metadata?.visibleRanks?.includes(rank);
      const isExcluded = metadata?.mainRosterExcludedCharacterIds?.includes(member.id);
      const isIncluded = metadata?.mainRosterIncludedCharacterIds?.includes(member.id);

      // Admin: Show if visible rank OR explicitly included OR search matches
      if (isAdmin) return (isVisibleRank || isIncluded || matchesFilter);

      // Normal: (Visible Rank AND NOT Excluded) OR Explicitly Included
      return (isVisibleRank && !isExcluded) || isIncluded;
    }

    const selectedRoster = availableRosters.find(r => String(r.id) === String(selectedRosterView));
    if (!selectedRoster) return true;

    const rawRank = (member as any).rank;
    const rank = rawRank === null || rawRank === undefined ? null : Number(rawRank);

    const isActuallyExternal = member.guildId !== selectedGuild?.id;
    const isExcluded = selectedRoster.excludedCharacterIds?.includes(member.id);
    const isIncluded = selectedRoster.includedCharacterIds?.includes(member.id);
    const hasRank = !isActuallyExternal && rank !== null && selectedRoster.allowedRanks?.includes(rank);

    // Admin view: Show if they have the rank OR are explicitly included OR search matches
    if (isAdmin) return hasRank || isIncluded || matchesFilter;

    // Normal view: (Has rank AND not excluded) OR explicitly included
    return (hasRank && !isExcluded) || isIncluded;
  }).sort((a, b) => {
    const selectedRoster = availableRosters.find(r => String(r.id) === String(selectedRosterView));
    if ((selectedRoster || selectedRosterView === 'main') && selectedRosterView !== 'all') {
      const getEligibility = (m: Member) => {
        const rawRank = (m as any).rank;
        const r = rawRank === null || rawRank === undefined ? null : Number(rawRank);

        let isEx = false;
        let isIn = false;
        let hasR = false;

        if (selectedRosterView === 'main') {
          isEx = metadata?.mainRosterExcludedCharacterIds?.includes(m.id);
          isIn = metadata?.mainRosterIncludedCharacterIds?.includes(m.id);
          hasR = r !== null && metadata?.visibleRanks?.includes(r);
        } else if (selectedRoster) {
          isEx = selectedRoster.excludedCharacterIds?.includes(m.id);
          isIn = selectedRoster.includedCharacterIds?.includes(m.id);
          hasR = r !== null && selectedRoster.allowedRanks?.includes(r);
        }
        return (hasR && !isEx) || isIn;
      };
      const eligA = getEligibility(a);
      const eligB = getEligibility(b);
      if (eligA !== eligB) return eligA ? -1 : 1;
    }

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

  useEffect(() => {
    const fetchRealms = async () => {
      try {
        setRealmsLoading(true);
        const data = await GuildService.getRealms();
        if (data.success) {
          setRealms(data.realms);
        }
      } catch (err) {
        console.error('Failed to fetch realms:', err);
      } finally {
        setRealmsLoading(false);
      }
    };
    fetchRealms();
  }, []);

  useEffect(() => {
    if (selectedGuild) {
      loadRoster(selectedGuild.id);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, guildLoading, lastRosterSyncAt]);

  const loadRoster = async (guildId: number) => {
    setLoading(true);
    try {
      const data = await GuildService.getRoster(guildId, true);
      setRoster(data.roster || []);
      setMetadata(data.metadata || null);

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

  const handleToggleMember = async (memberId: number) => {
    const isMainView = selectedRosterView === 'main';
    const selectedRoster = availableRosters.find(r => String(r.id) === String(selectedRosterView));

    if (!selectedRoster && !isMainView) return;
    if (!selectedGuild) return;

    const rank = Number((roster.find(m => m.id === memberId) as any)?.rank);

    let hasRank = false;
    let newIncluded: number[] = [];
    let newExcluded: number[] = [];

    if (isMainView) {
      hasRank = metadata?.visibleRanks?.includes(rank);
      newIncluded = [...(metadata?.mainRosterIncludedCharacterIds || [])];
      newExcluded = [...(metadata?.mainRosterExcludedCharacterIds || [])];
    } else if (selectedRoster) {
      hasRank = selectedRoster.allowedRanks?.includes(rank);
      newIncluded = [...(selectedRoster.includedCharacterIds || [])];
      newExcluded = [...(selectedRoster.excludedCharacterIds || [])];
    }

    if (hasRank) {
      if (newExcluded.includes(memberId)) {
        newExcluded = newExcluded.filter(id => id !== memberId);
      } else {
        newExcluded.push(memberId);
      }
    } else {
      if (newIncluded.includes(memberId)) {
        newIncluded = newIncluded.filter(id => id !== memberId);
      } else {
        newIncluded.push(memberId);
      }
    }

    try {
      if (isMainView) {
        const response = await GuildService.updateMainRosterOverrides(selectedGuild.id, newIncluded, newExcluded);
        if (response.success) {
          // Manually update metadata locally to reflect changes immediately
          setMetadata((prev: any) => ({
            ...prev,
            mainRosterIncludedCharacterIds: response.mainRosterIncludedCharacterIds,
            mainRosterExcludedCharacterIds: response.mainRosterExcludedCharacterIds
          }));
        }
      } else if (selectedRoster) {
        const response = await GuildService.saveRoster(selectedGuild.id, {
          ...selectedRoster,
          includedCharacterIds: newIncluded,
          excludedCharacterIds: newExcluded
        });

        if (response.success) {
          await refreshRosters();
        }
      }
    } catch (err) {
      console.error('Failed to update roster member', err);
    }
  };

  const handleAddExternalMember = async () => {
    const isMainView = selectedRosterView === 'main';
    const selectedRoster = availableRosters.find(r => String(r.id) === String(selectedRosterView));

    if ((!selectedRoster && !isMainView) || !selectedGuild || !extName || !extRealm) return;

    setIsAddingExternal(true);
    setAddError(null);
    try {
      if (isMainView) {
        // Logic for Main Roster external add needs backend support first
        // Current backend route structure is: /guilds/:guildId/rosters/:rosterId/add-external
        // We need a similar one for Main Roster: /guilds/:guildId/main-roster/add-external

        // NOTE: Since I haven't added `addExternalToMainRoster` API yet, I'll use a new service method
        // But let's first check if I should add that API endpoint. 
        // Yes, I need it. For now, I'll pause this part and add the backend endpoint first.
        // Actually, I can use the same pattern as updateMainRosterOverrides.
        // 1. Sync char
        // 2. Add ID to includedIds
        // But I cannot do step 1 easily from frontend without the backend helper.

        // Workaround: Call valid endpoint.
        // Let's implement `addExternalToMainRoster` in backend.

        const response = await GuildService.addExternalToMainRoster(selectedGuild.id, extName.trim(), extRealm);
        if (response.success) {
          setExtName('');
          setExtRealm('');
          setMetadata((prev: any) => ({
            ...prev,
            mainRosterIncludedCharacterIds: response.mainRosterIncludedCharacterIds
          }));
          await loadRoster(selectedGuild.id);
        } else {
          setAddError(response.error || 'Fehler beim Hinzufügen');
        }
      } else if (selectedRoster) {
        const response = await GuildService.addExternalMember(selectedGuild.id, selectedRoster.id, extName.trim(), extRealm);
        if (response.success) {
          setExtName('');
          setExtRealm('');
          await refreshRosters();
          await loadRoster(selectedGuild.id);
        } else {
          setAddError(response.error || 'Fehler beim Hinzufügen');
        }
      }
    } catch (err: any) {
      console.error('Failed to add external member', err);
      setAddError('Verbindungsfehler beim Hinzufügen');
    } finally {
      setIsAddingExternal(false);
    }
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
          border-color: var(--accent) !important;
        }
      `}</style>

      <header className="sticky top-0 z-20 bg-[#252525] pt-[20px] -mt-[20px] pb-4" style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
        <div className="flex items-center justify-end px-6 pt-2">
          {isRosterSyncing && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-accent"></div>
              <span className="text-[9px] text-accent font-black uppercase tracking-widest">Synchronisiere...</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 mb-[3px]">
        <div className="flex flex-col gap-2">
          {isAdmin && selectedRosterView !== 'all' && (
            <>
              <div className="flex items-center gap-[2px] bg-[#1a1b1c] p-1.5 rounded-xl border border-[#333] w-fit">
                <input
                  placeholder="Charakter-Name"
                  value={extName}
                  onChange={(e) => {
                    setExtName(e.target.value.toLowerCase());
                    setAddError(null);
                  }}
                  className="bg-[#111] border-none text-white text-xs px-3 py-1.5 rounded-lg outline-none w-32 focus:ring-1 ring-var(--accent)"
                />
                <select
                  value={extRealm}
                  onChange={(e) => {
                    setExtRealm(e.target.value);
                    setAddError(null);
                  }}
                  className="bg-[#111] border-none text-white text-xs px-3 py-1.5 rounded-lg outline-none w-44 focus:ring-1 ring-var(--accent) cursor-pointer"
                  disabled={realmsLoading}
                >
                  <option value="" className="text-gray-500">
                    {realmsLoading ? 'Lade Server...' : 'Server wählen...'}
                  </option>
                  {realms.map(r => (
                    <option key={r.slug} value={r.slug} className="bg-[#111] text-white">
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddExternalMember}
                  disabled={isAddingExternal || !extName || !extRealm}
                  className="bg-var(--accent) text-black text-[10px] font-black uppercase px-4 py-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isAddingExternal ? 'Lade...' : 'Hinzufügen'}
                </button>
              </div>
              {addError && (
                <div className="text-red-500 text-[10px] font-black uppercase tracking-wider ml-2 animate-pulse">
                  ⚠️ {addError}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {filteredRosterMembers.length === 0 ? (
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

            // In 'Alle Mitglieder' (selectedRosterView === 'all'), we never show the "Extern" tag.
            // A character is only "Extern" in a specific roster if they don't natively belong to the selected guild.
            const isNativelyFromOtherGuild = member.guildId && member.guildId !== selectedGuild?.id;
            const isMissingGuildId = !member.guildId; // Can happen with fresh battle.net sync before guild sync

            // We consider them external IF we are in a specific roster AND they don't belong to the guild natively.
            // If they are missing a guild ID but have a rank from the guild character list, we assume they belong to the guild.
            const isActuallyExternal = selectedRosterView !== 'all' &&
              (isNativelyFromOtherGuild || (isMissingGuildId && rank === null));

            const rankName = isActuallyExternal ? 'Extern' : getRankName(rank);

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
                  border: (member as any).isMain ? '1px solid var(--accent)' : '1px solid #333',
                  transition: 'border-color 0.2s',
                  width: '100%',
                  boxSizing: 'border-box',
                  opacity: (() => {
                    const isMain = selectedRosterView === 'main';
                    const selectedRoster = availableRosters.find(r => String(r.id) === String(selectedRosterView));

                    if (!selectedRoster && !isMain && selectedRosterView !== 'all') return 1;
                    if (selectedRosterView === 'all') return 1;
                    const rawRank = (member as any).rank;
                    const r = rawRank === null || rawRank === undefined ? null : Number(rawRank);
                    const isActuallyExternal = member.guildId !== selectedGuild?.id;

                    let isInRost = false;
                    if (isMain) {
                      const isEx = metadata?.mainRosterExcludedCharacterIds?.includes(member.id);
                      const isIn = metadata?.mainRosterIncludedCharacterIds?.includes(member.id);
                      const hasR = !isActuallyExternal && r !== null && metadata?.visibleRanks?.includes(r);
                      isInRost = (hasR && !isEx) || isIn;
                    } else if (selectedRoster) {
                      const isEx = selectedRoster.excludedCharacterIds?.includes(member.id);
                      const isIn = selectedRoster.includedCharacterIds?.includes(member.id);
                      const hasR = !isActuallyExternal && selectedRoster.allowedRanks?.includes(r);
                      isInRost = (hasR && !isEx) || isIn;
                    } else {
                      return 1;
                    }

                    return isInRost ? 1 : 0.4;
                  })()
                }}
                className="group"
              >
                <div style={{ width: '40px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <RoleIcon role={member.role} size={22} />
                </div>

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

                <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '800' }}>ILVL</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getIlvlColor(member.averageItemLevel) }}>
                    {member.averageItemLevel || '-'}
                  </div>
                </div>

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

                <div style={{ width: '150px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{
                    background: (!isActuallyExternal && rank === 0) ? 'rgba(139, 0, 139, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: (!isActuallyExternal && rank === 0) ? 'var(--accent)' : '#818181',
                    padding: '6px 15px',
                    borderRadius: '20px',
                    fontSize: '0.75em',
                    fontWeight: (!isActuallyExternal && rank === 0) ? '900' : 'bold',
                    border: (!isActuallyExternal && rank === 0) ? '1px solid var(--accent)' : '1px solid #444',
                    letterSpacing: (!isActuallyExternal && rank === 0) ? '1px' : 'normal',
                    textTransform: 'uppercase'
                  }}>
                    {rankName}
                  </span>
                </div>

                {isAdmin && selectedRosterView !== 'all' && (
                  <div style={{ width: '100px', flexShrink: 0, display: 'flex', justifyContent: 'center', marginLeft: '10px' }}>
                    {(() => {
                      const isMain = selectedRosterView === 'main';
                      const selectedRoster = availableRosters.find(r => String(r.id) === String(selectedRosterView));

                      if (!selectedRoster && !isMain) return null;

                      const r = Number((member as any).rank);

                      let isInRost = false;
                      if (isMain) {
                        const isEx = metadata?.mainRosterExcludedCharacterIds?.includes(member.id);
                        const isIn = metadata?.mainRosterIncludedCharacterIds?.includes(member.id);
                        const hasR = metadata?.visibleRanks?.includes(r);
                        isInRost = (hasR && !isEx) || isIn;
                      } else if (selectedRoster) {
                        const isEx = selectedRoster.excludedCharacterIds?.includes(member.id);
                        const isIn = selectedRoster.includedCharacterIds?.includes(member.id);
                        const hasR = selectedRoster.allowedRanks?.includes(r);
                        isInRost = (hasR && !isEx) || isIn;
                      }

                      return (
                        <button
                          onClick={() => handleToggleMember(member.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            transition: 'all 0.2s',
                            border: '1px solid',
                            backgroundColor: isInRost ? 'rgba(255, 68, 68, 0.1)' : 'rgba(68, 255, 68, 0.1)',
                            borderColor: isInRost ? '#ff4444' : '#44ff44',
                            color: isInRost ? '#ff4444' : '#44ff44',
                            cursor: 'pointer'
                          }}
                        >
                          {isInRost ? 'Entfernen' : 'Hinzufügen'}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
