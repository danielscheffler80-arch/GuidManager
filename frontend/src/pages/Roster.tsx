import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GuildService } from '../api/guildService';
import { useAuth } from '../contexts/AuthContext';
import { usePreferredGuild } from '../hooks/usePreferredGuild';
import { capitalizeName, formatRealm } from '../utils/formatUtils';

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
    loading: guildLoading
  } = usePreferredGuild();

  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRosterView, setSelectedRosterView] = useState<'main' | 'all'>('main');
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

  const filteredRosterMembers = roster.filter(member => {
    if (selectedRosterView === 'main') {
      // Main Roster: Zeige nur Mitglieder mit den ausgewählten "sichtbaren" Rängen
      // UND sortiere nach Rang -> Rolle -> Name
      return metadata?.visibleRanks?.includes(Number((member as any).rank));
    }
    return true; // "All" zeigt alle (client-side filter logic if needed, currently API filters)
  }).sort((a, b) => {
    // 1. Sort by Rank (Ascending: 0 is highest)
    const rankA = (a as any).rank ?? 99;
    const rankB = (b as any).rank ?? 99;
    if (rankA !== rankB) return rankA - rankB;

    // 2. Sort by Role (Tank > Healer > DPS > Unknown)
    const roleOrder: Record<string, number> = { 'tank': 1, 'healer': 2, 'dps': 3 };
    const roleA = roleOrder[a.role?.toLowerCase() || ''] || 4;
    const roleB = roleOrder[b.role?.toLowerCase() || ''] || 4;
    if (roleA !== roleB) return roleA - roleB;

    // 3. Sort by Name
    return a.name.localeCompare(b.name);
  });
  const [availableRanks, setAvailableRanks] = useState<{ id: number, name: string }[]>([]);
  const [adminRanks, setAdminRanks] = useState<number[]>([]);
  const [visibleRanks, setVisibleRanks] = useState<number[]>([]);
  const [isLeader, setIsLeader] = useState(false);

  const [sessionSyncs, setSessionSyncs] = useState<number[]>([]);
  const [showFiltered, setShowFiltered] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      loadRoster(selectedGuild.id);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, selectedRosterView, guildLoading]);

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

  const triggerSync = async (guildId: number) => {
    if (isSyncing) return; // Prevent double trigger

    console.log(`[Roster] Starting full roster sync for guild ${guildId}...`);
    setIsSyncing(true);

    // Add to session syncs immediately to prevent re-trigger
    setSessionSyncs(prev => {
      if (prev.includes(guildId)) return prev;
      return [...prev, guildId];
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s Timeout

      const result = await Promise.race([
        GuildService.syncMembers(guildId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync Timeout')), 60000))
      ]);
      clearTimeout(timeoutId);

      console.log(`[Roster] Sync completed:`, result);
      await loadRoster(guildId);
    } catch (err) {
      console.error('Sync failed:', err);
      // Even if sync fails, try to reload roster to show whatever we have
      await loadRoster(guildId);
    } finally {
      setIsSyncing(false);
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

  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  const handleManagementAction = async (action: 'promote' | 'demote' | 'kick', member: Member) => {
    if (!selectedGuild) return;
    setActionInProgress(member.id);
    try {
      let result;
      if (action === 'promote') result = await GuildService.promoteMember(selectedGuild.id, member.id);
      else if (action === 'demote') result = await GuildService.demoteMember(selectedGuild.id, member.id);
      else result = await GuildService.kickMember(selectedGuild.id, member.id);

      if (result.success && result.command) {
        // Copy to clipboard
        await navigator.clipboard.writeText(result.command);
        alert(`${result.message}\n\nDer Befehl "${result.command}" wurde in deine Zwischenablage kopiert.`);
      } else {
        alert('Aktion fehlgeschlagen: ' + (result.error || 'Unbekannter Fehler'));
      }
    } catch (err) {
      alert('Fehler bei der Kommunikation mit dem Server.');
    } finally {
      setActionInProgress(null);
    }
  };

  const isUserAdmin = () => {
    if (!user || !selectedGuild) return false;
    if (String(user.battlenetId) === '100379014') return true;
    const membership = user.guildMemberships?.find((m: any) => m.guildId === selectedGuild.id);
    if (!membership) return false;
    return membership.rank === 0 || adminRanks.includes(membership.rank);
  };

  const getRankName = (rankId: number | null) => {
    if (rankId === null || rankId === undefined) return 'Kein Rang';
    const found = availableRanks.find(r => r.id === rankId);
    return found ? found.name : `Rang ${rankId}`;
  };

  return (
    <div className="page-container">
      <style>{`
        .roster-row {
          background: #1D1E1F;
          padding: 10px 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .roster-row:hover {
          background: #232425;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .roster-col-label {
          font-size: 0.65rem;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
          font-weight: 800;
        }
        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.03);
          color: #888;
          transition: all 0.2s;
        }
        .action-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border-color: rgba(255,255,255,0.2);
        }
        .action-btn.kick:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        }
      `}</style>

      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-4 items-center bg-black/20 p-2 rounded-xl w-full md:w-auto">
          <select
            value={selectedRosterView}
            onChange={(e) => setSelectedRosterView(e.target.value as 'main' | 'all')}
            className="p-2.5 bg-[#121214] rounded-lg text-xs font-bold text-gray-300 focus:outline-none focus:border-[#A330C9] min-w-[150px] cursor-pointer"
          >
            <option value="main">Main Roster</option>
            <option value="all">Alle Mitglieder</option>
          </select>

          <button
            onClick={() => selectedGuild && triggerSync(selectedGuild.id)}
            disabled={isSyncing}
            className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg ${isSyncing
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-[#A330C9] text-white hover:bg-[#b340d9] active:scale-95 shadow-[#A330C9]/20'
              }`}
          >
            {isSyncing ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white"></div>
                Sync...
              </>
            ) : (
              <>
                <span className="text-sm">🔄</span>
                Refresh
              </>
            )}
          </button>

          <select
            value={selectedGuild?.id || ''}
            onChange={(e) => {
              const guild = guilds.find(g => g.id === Number(e.target.value));
              setSelectedGuild(guild);
              if (guild) {
                localStorage.setItem('selectedGuildId', String(guild.id));
                loadRoster(guild.id, showFiltered);
              }
            }}
            className="p-2.5 bg-[#121214] border border-gray-800 rounded-lg text-xs font-bold text-gray-300 focus:outline-none focus:border-[#A330C9] min-w-[180px] cursor-pointer"
          >
            {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {selectedGuild && (
          <div className="px-4 py-2 bg-[#A330C9]/10 rounded-full text-xs font-black text-[#A330C9] uppercase tracking-[0.2em]">
            {selectedGuild.name}
          </div>
        )}
      </header>

      {isSyncing && (
        <div className="mb-6 p-4 bg-[#A330C9]/10 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[#A330C9]"></div>
          <span className="text-xs text-[#A330C9] font-black uppercase tracking-widest">Synchronisiere Mitglieder mit Battle.net (Phase 2: Details)...</span>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="text-center py-24 bg-[#121214]/50 backdrop-blur-md rounded-3xl">
          <div className="text-6xl mb-6">👥</div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Keine Mitglieder gefunden</h2>

          <div className="max-w-xs mx-auto mb-10 bg-black/40 p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Mitglieder (DB):</span>
              <span className="text-white font-black">{metadata?.totalCount || 0}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-500 font-bold uppercase tracking-wider">Sichtbare Ränge:</span>
              <div className="flex gap-1">
                {(metadata?.visibleRanks || [5, 7]).map((r: number) => (
                  <span key={r} className="px-1.5 py-0.5 bg-[#A330C9]/20 text-[#A330C9] rounded-md font-black">{r}</span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm font-medium leading-relaxed">
            {metadata?.totalCount > 0
              ? `Es sind ${metadata.totalCount} Charaktere in der Datenbank, aber keiner entspricht den aktuell sichtbaren Rängen.`
              : "Der Roster wurde für diese Gilde noch nicht synchronisiert."}
          </p>

          <div className="flex flex-col gap-4 items-center">
            {metadata?.totalCount > 0 && selectedRosterView === 'main' ? (
              <button
                onClick={() => setSelectedRosterView('all')}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 hover:border-[#A330C9] transition-all active:scale-95 text-xs"
              >
                Alle {metadata.totalCount} anzeigen
              </button>
            ) : (
              <button
                onClick={() => selectedGuild && triggerSync(selectedGuild.id)}
                className="px-8 py-4 bg-[#A330C9] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#b340d9] transition-all active:scale-95 flex items-center gap-3 shadow-xl shadow-[#A330C9]/30 text-xs"
              >
                <span>🔄</span> Jetzt Synchronisieren
              </button>
            )}

            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-6">
              Sichtbare Ränge in der <span className="text-[#A330C9]">Admin Zone</span> anpassen.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center px-6 py-2 mb-2">
            <div style={{ width: '70px' }}></div>
            <div style={{ width: '220px' }} className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Charakter</div>
            <div style={{ width: '100px' }} className="text-center text-[10px] font-black text-gray-600 uppercase tracking-widest">Item Level</div>
            <div style={{ width: '100px' }} className="text-center text-[10px] font-black text-gray-600 uppercase tracking-widest">Score</div>
            <div style={{ width: '180px' }} className="text-center text-[10px] font-black text-gray-600 uppercase tracking-widest">Raid Progress</div>
            <div className="flex-1"></div>
            <div style={{ width: '150px' }} className="text-right text-[10px] font-black text-gray-600 uppercase tracking-widest">Gilden-Rang</div>
            {isUserAdmin() && <div style={{ width: '120px' }}></div>}
          </div>

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

            return (
              <div
                key={member.id}
                className="roster-row group"
                onClick={() => (window as any).electronAPI.openExternal(`https://raider.io/characters/eu/${member.realm.toLowerCase()}/${member.name.toLowerCase()}`)}
              >
                {/* 1. Spalte: Icons */}
                <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <RoleIcon role={member.role} size={22} />
                  <div className="relative">
                    <img
                      src={classIcon}
                      alt={member.class || 'Unknown'}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #222', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg';
                      }}
                    />
                  </div>
                </div>

                {/* 2. Spalte: Name & Realm */}
                <div style={{ width: '220px', flexShrink: 0 }}>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontWeight: '900',
                        fontSize: '1em',
                        color: getClassColor(member.classId || member.class),
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      {capitalizeName(member.name)}
                    </span>
                    {(member as any).isMain && (
                      <span className="px-1.5 py-0.5 bg-[#A330C9] text-white text-[8px] font-black rounded uppercase tracking-tighter">Main</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 'bold' }}>{formatRealm(member.realm)}</div>
                </div>

                {/* 3. Spalte: Item Level */}
                <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontWeight: '900', fontSize: '1.1em', color: getIlvlColor(member.averageItemLevel) }}>
                    {member.averageItemLevel || '-'}
                  </div>
                </div>

                {/* 4. Spalte: RIO */}
                <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontWeight: '900', fontSize: '1.1em', color: getRIOColor(member.mythicRating) }}>
                    {member.mythicRating?.toFixed(0) || '-'}
                  </div>
                </div>

                {/* 5. Spalte: Raid Progress */}
                <div style={{ width: '180px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontWeight: '900', fontSize: '0.9em', color: getDifficultyColor(member.raidProgress || '') }}>
                    {member.raidProgress || '-'}
                  </div>
                </div>

                <div style={{ flex: 1 }}></div>

                {/* 6. Spalte: Rank Badge */}
                <div style={{ width: '150px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span style={{
                    background: rank === 0 ? 'rgba(163, 48, 201, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    color: rank === 0 ? '#A330C9' : '#888',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {rankName}
                  </span>
                </div>

                {/* 7. Spalte: Admin Actions */}
                {isUserAdmin() && (
                  <div
                    style={{ width: '120px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '6px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      title="Promote"
                      disabled={actionInProgress === member.id}
                      onClick={() => handleManagementAction('promote', member)}
                      className="action-btn"
                    >
                      {actionInProgress === member.id ? '...' : '🔼'}
                    </button>
                    <button
                      title="Demote"
                      disabled={actionInProgress === member.id}
                      onClick={() => handleManagementAction('demote', member)}
                      className="action-btn"
                    >
                      {actionInProgress === member.id ? '...' : '🔽'}
                    </button>
                    <button
                      title="Kick"
                      disabled={actionInProgress === member.id}
                      onClick={() => handleManagementAction('kick', member)}
                      className="action-btn kick"
                    >
                      {actionInProgress === member.id ? '...' : '🚫'}
                    </button>
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
