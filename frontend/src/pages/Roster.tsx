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

  // Auto-Sync Effect: Only sync if roster is completely empty
  useEffect(() => {
    if (selectedGuild && !sessionSyncs.includes(selectedGuild.id) && !isSyncing && roster.length === 0 && !loading) {
      console.log(`[Roster] Initial sync for guild ${selectedGuild.id} (Roster empty)`);
      triggerSync(selectedGuild.id);
    }
  }, [selectedGuild, sessionSyncs, isSyncing, roster.length, loading]);

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

  return (
    <div className="px-8 py-4 max-w-7xl mx-auto">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Gilden-Roster</h1>
          <p className="text-gray-500 mt-1">Verwalte deine Raid-Aufstellung und verfolge den Fortschritt deiner Mitglieder.</p>
        </div>
        <div className="flex gap-4 items-center">
          <select
            value={selectedRosterView}
            onChange={(e) => setSelectedRosterView(e.target.value as 'main' | 'all')}
            className="p-2.5 bg-[#121214] border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#A330C9] min-w-[200px]"
          >
            <option value="main">Main Roster</option>
            <option value="all">Alle Mitglieder</option>
          </select>

          <button
            onClick={() => selectedGuild && triggerSync(selectedGuild.id)}
            disabled={isSyncing}
            className={`p-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isSyncing
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-[#A330C9] text-white hover:bg-[#b340d9] active:scale-95'
              }`}
          >
            {isSyncing ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white"></div>
                Syncing...
              </>
            ) : (
              <>
                <span className="text-base">🔄</span>
                Synchronisieren
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
            className="p-2.5 bg-[#121214] border border-gray-800 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#A330C9] min-w-[200px]"
          >
            {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </header>

      {isSyncing && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-4 animate-pulse">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500"></div>
          <span className="text-sm text-blue-400 font-medium">Synchronisiere alle Gildenmitglieder mit Battle.net... Bitte warten.</span>
        </div>
      )}


      {roster.length === 0 ? (
        <div className="text-center py-20 bg-[#121214]/50 backdrop-blur-md rounded-2xl border border-dashed border-gray-800">
          <div className="text-4xl mb-4">👥</div>
          <h2 className="text-xl font-bold text-white mb-2">Keine Mitglieder gefunden</h2>

          <div className="max-w-md mx-auto mb-8 bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500">Gilde in Datenbank:</span>
              <span className="text-gray-300 font-bold">{selectedGuild?.name || 'Keine Gilde ausgewählt'}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500">Mitglieder insgesamt (DB):</span>
              <span className="text-white font-bold">{metadata?.totalCount || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Sichtbare Ränge:</span>
              <span className="text-[#A330C9] font-bold">[{metadata?.visibleRanks?.join(', ') || '5, 7'}]</span>
            </div>
          </div>

          <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
            {metadata?.totalCount > 0
              ? `Es sind ${metadata.totalCount} Charaktere in der Datenbank, aber keiner entspricht den aktuell sichtbaren Rängen.`
              : isSyncing
                ? "Der Roster wird gerade synchronisiert. Bitte hab einen Moment Geduld..."
                : "Der Roster wurde für diese Gilde scheinbar noch nie vollständig synchronisiert."}
          </p>

          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={async () => {
                if (!selectedGuild) return;
                try {
                  const token = localStorage.getItem('accessToken');
                  const backendUrl = (window as any).electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
                  const res = await fetch(`${backendUrl}/api/guilds/${selectedGuild.id}/roster-debug`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  alert(JSON.stringify(data, null, 2));
                } catch (e) {
                  alert("Debug Error: " + e);
                }
              }}
              className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
            >
              🛠️ DEBUG: Test Battle.net API
            </button>
            <p className="text-xs text-gray-600 mt-4">
              Du kannst die sichtbaren Ränge oben über <span className="text-[#A330C9] font-bold">Gilde verwalten</span> anpassen.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredRosterMembers.map((member) => {
            const rank = (member as any).rank;
            const rankName = rank !== null && rank !== undefined ? `Rang ${rank}` : 'Kein Rang';

            // Use classId for robust ID-to-key mapping for icons
            const classIconKeys: Record<number, string> = {
              1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue',
              5: 'priest', 6: 'deathknight', 7: 'shaman', 8: 'mage',
              9: 'warlock', 10: 'monk', 11: 'druid', 12: 'demonhunter', 13: 'evoker'
            };

            const classKey = member.classId ? classIconKeys[member.classId] : member.class?.toLowerCase().replace(' ', '').replace('-', '');
            const classIcon = `https://render.worldofwarcraft.com/us/icons/56/classicon_${classKey}.jpg`;

            return (
              <div
                key={member.id}
                style={{
                  background: '#1D1E1F',
                  padding: '8px 20px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #333',
                  transition: 'border-color 0.2s',
                  cursor: 'pointer'
                }}
                className="hover:border-gray-500 transition-colors"
                onClick={() => (window as any).electronAPI.openExternal(`https://raider.io/characters/eu/${member.realm.toLowerCase()}/${member.name.toLowerCase()}`)}
              >
                {/* 1. Spalte: Icons (Rolle & Klasse) */}
                <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <RoleIcon role={member.role} size={20} />
                  <img
                    src={classIcon}
                    alt={member.class || 'Unknown'}
                    style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #555' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://render.worldofwarcraft.com/us/icons/56/inv_misc_questionmark.jpg';
                    }}
                  />
                </div>

                {/* 2. Spalte: Name & Realm */}
                <div style={{ width: '220px', flexShrink: 0 }}>
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1.1em',
                      color: getClassColor(member.classId || member.class),
                      display: 'inline-block'
                    }}
                  >
                    {capitalizeName(member.name)}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>{formatRealm(member.realm)}</div>
                </div>

                {/* 3. Spalte: Item Level */}
                <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Ilvl</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getIlvlColor(member.averageItemLevel) }}>{member.averageItemLevel || '-'}</div>
                </div>

                {/* 4. Spalte: RIO / Mythic Rating */}
                <div
                  style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}
                >
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>RIO</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: getRIOColor(member.mythicRating) }}>{member.mythicRating?.toFixed(0) || '-'}</div>
                </div>

                {/* 5. Spalte: Raid Progress */}
                <div
                  style={{ width: '180px', flexShrink: 0, textAlign: 'center' }}
                >
                  <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Raid Progress</div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95em', color: getDifficultyColor(member.raidProgress || '') }}>{member.raidProgress || '-'}</div>
                </div>

                {/* Platzhalter / Spacer */}
                <div style={{ flex: 1 }}></div>

                {/* 6. Spalte: Rank Badge */}
                <div style={{ width: '150px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.05)', color: '#ccc', padding: '6px 15px',
                    borderRadius: '20px', fontSize: '0.75em', fontWeight: 'bold', border: '1px solid #444',
                    letterSpacing: '0.5px'
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
