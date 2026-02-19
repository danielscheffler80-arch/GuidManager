import React, { useEffect, useState, useMemo } from 'react';
import { RaidService } from '../api/raidService';
import { capitalizeName } from '../utils/formatUtils';
import { storage } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { useGuild } from '../contexts/GuildContext';
import { getCompositionStats, CLASS_LIST } from '../utils/raidUtils';

export default function Raids() {
  const { user } = useAuth();
  const { guilds, selectedGuild, setSelectedGuild, myCharacters, loading: guildLoading } = useGuild();

  const [raids, setRaids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRaid, setSelectedRaid] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [view, setView] = useState<'calendar' | 'detail'>('calendar');
  const [activeTab, setActiveTab] = useState<'roster' | 'signups'>('roster');
  const [availableRosters, setAvailableRosters] = useState<any[]>([]);

  // Form State
  const [newRaid, setNewRaid] = useState({
    title: '',
    description: '',
    difficulty: 'Normal',
    startTime: '',
    maxPlayers: 20,
    recruitmentType: 'everyone',
    allowedRanks: [] as number[],
    rosterId: '' as string | number,
    isRecurring: false,
    recurrenceWeeks: 4,
    imageUrl: 'https://wow.zamimg.com/uploads/screenshots/normal/1186178.jpg'
  });

  const RAID_IMAGES = [
    { name: 'Liberation of Undermine', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1186178.jpg' },
    { name: 'Manaforge', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1183318.jpg' },
    { name: 'Nerub-ar Palace', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1167440.jpg' },
    { name: 'Siren Isle', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1183318.jpg' },
    { name: 'The War Within', url: 'https://wow.zamimg.com/uploads/screenshots/normal/1167439.jpg' }
  ];

  useEffect(() => {
    if (selectedGuild) {
      // SWR: Load from cache
      const cachedRaids = storage.get(`cache_raids_data_${selectedGuild.id}`, []);
      if (cachedRaids.length > 0) {
        setRaids(cachedRaids);
        setLoading(false);
      }
      loadRaids(selectedGuild.id);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, guildLoading]);

  useEffect(() => {
    if (user && selectedGuild) {
      checkLeaderStatus(user, selectedGuild);
      loadRosters(selectedGuild.id);
    }
  }, [user, selectedGuild]);

  // Handle auto-selection from Dashboard
  useEffect(() => {
    if (raids.length > 0) {
      const autoRaidId = localStorage.getItem('auto_select_raid_id');
      if (autoRaidId) {
        const found = raids.find(r => String(r.id) === autoRaidId);
        if (found) {
          setSelectedRaid(found);
          setView('detail');
          localStorage.removeItem('auto_select_raid_id');
        }
      }
    }
  }, [raids]);


  const checkLeaderStatus = (user: any, currentGuild: any) => {
    if (!currentGuild) return;
    const membership = user.guildMemberships?.find((m: any) => m.guildId === currentGuild.id);
    const isGM = membership?.rank === 0;
    const isSuperuser = String(user.battlenetId) === '100379014';
    const isEditor = currentGuild.adminRanks?.includes(membership?.rank);
    setIsLeader(isGM || isSuperuser || isEditor);
  };

  const loadRaids = async (guildId: number) => {
    setLoading(true);
    try {
      const data = await RaidService.getRaids(guildId);
      const allRaids = data.raids || [];
      setRaids(allRaids);
      storage.set(`cache_raids_data_${guildId}`, allRaids);

      if (selectedRaid) {
        const updated = allRaids.find((r: any) => r.id === selectedRaid.id);
        if (updated) setSelectedRaid(updated);
      }
    } catch (error) {
      console.error('Failed to load raids');
    } finally {
      setLoading(false);
    }
  };

  const loadRosters = async (guildId: number) => {
    try {
      const { GuildService } = await import('../api/guildService');
      const data = await GuildService.getRosters(guildId);
      if (data.success) {
        setAvailableRosters(data.rosters || []);
      }
    } catch (err) {
      console.error('Failed to load rosters');
    }
  };

  const handleSignup = async (raidId: number, charId: number, status: string, comment?: string) => {
    if (!selectedGuild) return;
    try {
      await RaidService.signup(selectedGuild.id, raidId, {
        characterId: charId,
        status: status,
        comment: comment,
        roleSlot: myCharacters.find((c: any) => c.id === charId)?.isMain ? 'main' : 'twink'
      });
      loadRaids(selectedGuild.id);
    } catch (error) {
      console.error('Signup failed');
    }
  };

  const handleConfirm = async (raidId: number, charId: number, confirmed: boolean) => {
    if (!selectedGuild || !isLeader) return;
    try {
      await RaidService.signup(selectedGuild.id, raidId, {
        characterId: charId,
        isConfirmed: confirmed
      });
      loadRaids(selectedGuild.id);
    } catch (error) {
      console.error('Confirmation failed');
    }
  }

  const openCreateModal = (day?: number, month?: number) => {
    let startTime = '';
    if (day !== undefined && month !== undefined) {
      const date = new Date(currentDate.getFullYear(), month, day);
      date.setHours(20, 0, 0, 0);
      const tzOffset = date.getTimezoneOffset() * 60000;
      startTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    }

    setNewRaid(prev => ({
      ...prev,
      startTime: startTime || prev.startTime,
      isRecurring: false,
      recurrenceWeeks: 4
    }));
    setShowCreateModal(true);
  };

  const handleCreateRaid = async () => {
    if (!selectedGuild) return;
    try {
      const randomImg = RAID_IMAGES[Math.floor(Math.random() * RAID_IMAGES.length)].url;
      await RaidService.createRaid(selectedGuild.id, { ...newRaid, imageUrl: randomImg });
      setShowCreateModal(false);
      loadRaids(selectedGuild.id);
      setNewRaid({
        title: '',
        description: '',
        difficulty: 'Normal',
        startTime: '',
        maxPlayers: 20,
        recruitmentType: 'everyone',
        allowedRanks: [],
        rosterId: '',
        isRecurring: false,
        recurrenceWeeks: 4,
        imageUrl: 'https://wow.zamimg.com/uploads/screenshots/normal/1186178.jpg'
      });
    } catch (error) {
      console.error('Failed to create raid');
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = daysInMonth(year, month);
    const firstDay = (firstDayOfMonth(year, month) + 6) % 7;

    const calendarDays = [];
    const prevMonthDays = daysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push({ day: prevMonthDays - i, month: month - 1, current: false });
    }
    for (let i = 1; i <= days; i++) {
      calendarDays.push({ day: i, month, current: true });
    }
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ day: i, month: month + 1, current: false });
    }
    return calendarDays;
  };

  const getRaidsOnDay = (day: number, month: number) => {
    return raids.filter(raid => {
      const d = new Date(raid.startTime);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === currentDate.getFullYear();
    });
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const getRoleIcon = (role: string | null) => {
    const r = role?.toLowerCase();
    const baseUrl = 'https://render.worldofwarcraft.com/us/icons/56';
    if (r === 'tank') return `${baseUrl}/inv_shield_06.jpg`;
    if (r === 'healer' || r === 'heal') return `${baseUrl}/spell_holy_renew.jpg`;
    if (r === 'melee' || r === 'dps') return `${baseUrl}/inv_sword_04.jpg`;
    if (r === 'ranged') return `${baseUrl}/inv_sword_04.jpg`;
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
        style={{ width: `${size}px`, height: `${size}px`, borderRadius: '3px' }}
        className="inline-block"
      />
    );
  };

  const getClassIcon = (classIdOrName: number | string | null) => {
    const classMap: Record<number, string> = {
      1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue',
      5: 'priest', 6: 'deathknight', 7: 'shaman', 8: 'mage',
      9: 'warlock', 10: 'monk', 11: 'druid', 12: 'demonhunter', 13: 'evoker'
    };
    const classKey = typeof classIdOrName === 'number'
      ? classMap[classIdOrName]
      : (classIdOrName as string)?.toLowerCase().replace(' ', '').replace('-', '');

    return `https://render.worldofwarcraft.com/us/icons/56/classicon_${classKey || 'inv_misc_questionmark'}.jpg`;
  };

  const groupedRoster = useMemo(() => {
    if (!selectedRaid || !selectedRaid.attendances) return null;

    const groups: any = {
      Tank: { selected: [], queued: [] },
      Melee: { selected: [], queued: [] },
      Ranged: { selected: [], queued: [] },
      Heal: { selected: [], queued: [] }
    };

    selectedRaid.attendances.forEach((a: any) => {
      let role = a.character.role || 'DPS';
      const charClass = a.character.class;

      if (role === 'DPS') {
        const isMelee = ['Warrior', 'Paladin', 'Rogue', 'Monk', 'Demon Hunter', 'Death Knight'].includes(charClass);
        role = isMelee ? 'Melee' : 'Ranged';
      }

      const roleKey = (role === 'Healer' || role === 'Heal') ? 'Heal' : role;
      if (groups[roleKey]) {
        if (a.isConfirmed) {
          groups[roleKey].selected.push(a);
        } else {
          groups[roleKey].queued.push(a);
        }
      }
    });

    return groups;
  }, [selectedRaid]);

  const composition = useMemo(() => {
    if (!selectedRaid) return null;
    return getCompositionStats(selectedRaid.attendances);
  }, [selectedRaid]);

  // No longer blocking the whole page with a loading spinner
  // Only show empty state if guild is missing and loading is finished
  if (!selectedGuild && !loading && !guildLoading) {
    return <div className="page-container text-center text-gray-500 py-20">Keine Gilde ausgewählt.</div>;
  }

  // --- CALENDAR VIEW ---
  if (view === 'calendar') {
    return (
      <div className="page-container">
        <header className="calendar-header mb-4">
          <div className="flex gap-4 items-center">
            <div className="flex gap-1 bg-[#121214] p-1 rounded-lg">
              <button onClick={prevMonth} className="px-2 py-1 hover:bg-gray-800 rounded transition-colors" title="Vorheriger Monat">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <span className="px-4 py-1 font-black text-sm min-w-[160px] text-center uppercase tracking-widest text-white/90 flex items-center justify-center">
                {currentDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} className="px-2 py-1 hover:bg-gray-800 rounded transition-colors" title="Nächster Monat">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[var(--accent)] opacity-50"></div>
            )}
          </div>
          <div className="flex-1"></div>
          {/* Platz für weitere Header-Elemente falls nötig */}
        </header>

        <div className="calendar-grid">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          {getCalendarDays().map((dateInfo, idx) => {
            const dayRaids = getRaidsOnDay(dateInfo.day, dateInfo.month);
            const isToday = new Date().getDate() === dateInfo.day &&
              new Date().getMonth() === dateInfo.month &&
              new Date().getFullYear() === currentDate.getFullYear();

            return (
              <div
                key={idx}
                className={`calendar-day ${!dateInfo.current ? 'not-current' : ''} ${isToday ? 'is-today' : ''}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={`day-number ${isLeader && dateInfo.current ? 'clickable' : ''}`}
                    onClick={() => isLeader && dateInfo.current && openCreateModal(dateInfo.day, dateInfo.month)}
                  >
                    {dateInfo.day}
                  </span>
                </div>

                <div className="raid-events-list custom-scrollbar">
                  {dayRaids.map(raid => {
                    const confirmedCount = raid.attendances?.filter((a: any) => a.isConfirmed).length || 0;
                    const isSignedUp = raid.attendances?.some((a: any) => myCharacters.some(my => my.id === a.characterId));

                    return (
                      <div
                        key={raid.id}
                        onClick={() => { setSelectedRaid(raid); setView('detail'); }}
                        className="raid-event-card h-[70px]"
                      >
                        <img
                          src={raid.imageUrl || 'https://wow.zamimg.com/uploads/screenshots/normal/1167439.jpg'}
                          className="raid-card-bg"
                          alt=""
                        />
                        <div className="raid-card-overlay opacity-60"></div>
                        <div className="raid-card-content p-1.5 flex flex-col">
                          <div className="raid-card-top flex justify-between items-center">
                            <span className="raid-time-badge text-[8px]">
                              {new Date(raid.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isSignedUp && (
                              <div className="raid-signed-indicator w-2.5 h-2.5">
                                <svg className="w-1.5 h-1.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 relative top-[-7px]">
                            <p className="raid-card-title text-[10px] leading-tight font-black">{raid.title}</p>
                            <div className="raid-card-footer flex justify-between items-center">
                              <span className={`raid-difficulty-tag text-[7px] font-black px-1 rounded-sm diff-${raid.difficulty.toLowerCase()}`}>
                                {raid.difficulty}
                              </span>
                              <span className="raid-count-badge text-[9px] font-black text-white/90 bg-black/40 px-1 rounded-sm border border-white/5 tabular-nums">
                                {confirmedCount}/{raid.maxPlayers}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {showCreateModal && <CreateRaidModal />}
      </div >
    );
  }

  // --- DETAIL VIEW (Wowaudit Tabbed Edition) ---
  const mySignup = selectedRaid?.attendances?.find((a: any) => myCharacters.some(my => my.id === a.characterId));
  const myActiveChar = myCharacters.find(c => c.isMain && c.isActive) || myCharacters[0];

  return (
    <div className="raid-detail-page bg-[#08080C] h-screen overflow-hidden text-[#E0E0E0] flex flex-col font-sans">
      {/* Super Compact Global Header */}
      <div className="px-6 py-1.5 bg-black/60 backdrop-blur-2xl flex items-center justify-between z-30 shrink-0">
        <div className="flex gap-4 items-center">
          <button onClick={() => setView('calendar')} className="flex items-center gap-1.5 text-green-500/80 font-bold hover:text-green-400 text-[10px] uppercase tracking-tighter">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Kalender
          </button>
          <div className="h-3 w-px bg-white/5"></div>
          <h1 className="text-xs font-black text-white/90 uppercase tracking-tight">{selectedRaid.title}</h1>
          <span className="text-[9px] text-gray-600 font-bold tabular-nums">
            {new Date(selectedRaid.startTime).toLocaleDateString('de-DE', { month: '2-digit', day: '2-digit' })}
          </span>
          {selectedRaid.roster && (
            <div className={`ml-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30`}>
              Roster: {selectedRaid.roster.name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black text-gray-600 uppercase">Confirmed</span>
            <span className="text-[10px] font-black text-[var(--accent)]">{selectedRaid.attendances.filter((a: any) => a.isConfirmed).length}/{selectedRaid.maxPlayers}</span>
          </div>
          <div className="text-[9px] font-black bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded uppercase">
            {selectedRaid.difficulty}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">

          {/* Presence & Dashboard Bar */}
          <div className="bg-[#12121A] rounded-2xl p-2 flex items-center gap-4 shrink-0 shadow-lg">
            <div className="flex gap-1 p-1 bg-black/20 rounded-xl">
              {['attending', 'late', 'tentative', 'not_attending'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleSignup(selectedRaid.id, myActiveChar?.id, status)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${mySignup?.status === status
                    ? 'bg-[var(--accent)] text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-300'
                    }`}
                >
                  <span className="text-xs">
                    {status === 'attending' && '✓'}
                    {status === 'late' && '⌚'}
                    {status === 'tentative' && '?'}
                    {status === 'not_attending' && '✕'}
                  </span>
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Anmerkung..."
              defaultValue={mySignup?.comment || ''}
              onBlur={(e) => handleSignup(selectedRaid.id, myActiveChar?.id, mySignup?.status || 'attending', e.target.value)}
              className="flex-1 bg-white/[0.02] rounded-xl px-4 py-1.5 text-xs font-medium placeholder:text-gray-800 outline-none focus:border-[var(--accent)]/30 transition-all"
            />
            <div className="h-6 w-px bg-white/5"></div>
            <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'roster' ? 'bg-[#2D2D38] text-white shadow' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Main Roster
              </button>
              <button
                onClick={() => setActiveTab('signups')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'signups' ? 'bg-[#2D2D38] text-white shadow' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Waitlist ({selectedRaid.attendances.filter((a: any) => !a.isConfirmed).length})
              </button>
            </div>
          </div>

          {/* Tabbed Result Grid */}
          <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
            {['Tank', 'Melee', 'Ranged', 'Heal'].map(role => {
              const players = activeTab === 'roster' ? groupedRoster[role].selected : groupedRoster[role].queued;
              return (
                <div key={role} className="bg-[#12121A]/40 rounded-2xl flex flex-col overflow-hidden group">
                  <header className="px-4 py-3 flex items-center justify-between border-b border-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <RoleIcon role={role === 'Heal' ? 'Healer' : role} size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{role}</span>
                    </div>
                    <span className="text-[10px] font-black text-[var(--accent)] tabular-nums">{players.length}</span>
                  </header>
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar scrollbar-none">
                    {players.map((a: any) => (
                      <DensePlayerRow key={a.id} attendance={a} confirmed={activeTab === 'roster'} />
                    ))}
                    {players.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full opacity-10">
                        <RoleIcon role={role === 'Heal' ? 'Healer' : role} size={32} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Micro-Sidebar (Far Right) */}
        <div className="w-[180px] bg-black/20 flex flex-col overflow-hidden shrink-0">
          <header className="p-4">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Checklist</h3>
            <div className="h-0.5 w-6 bg-[var(--accent)]"></div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scrollbar-none">
            <section>
              <h4 className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-3">Composition</h4>
              <div className="grid grid-cols-3 gap-2">
                {CLASS_LIST.sort().map(c => (
                  <div key={c} className="relative group flex justify-center">
                    <img
                      src={getClassIcon(c)}
                      className={`w-6 h-6 rounded transition-all ${(composition?.classCount?.[c] ?? 0) > 0 ? 'brightness-110 shadow-[0_0_8px_rgba(163,48,201,0.3)]' : 'brightness-[0.25] grayscale'}`}
                      alt={c}
                    />
                    {(composition?.classCount?.[c] ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-[8px] font-black text-white w-3 h-3 rounded-full flex items-center justify-center border border-black">
                        {composition?.classCount?.[c] || 0}
                      </span>
                    )}
                    <div className="absolute bottom-full mb-1 p-1 bg-black text-[8px] rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50">{c}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-[8px] font-black text-gray-700 uppercase tracking-widest">Utility</h4>
              <div className="space-y-1.5">
                {composition?.buffs.concat(composition?.utility).map((b: any) => (
                  <div key={b.name} className="flex items-center gap-2">
                    <div className={`w-1 h-1 rounded-full ${b.present ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-gray-800'}`}></div>
                    <span className={`text-[9px] font-bold truncate ${b.present ? 'text-gray-300' : 'text-gray-700'}`}>{b.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );

  function DensePlayerRow({ attendance, confirmed }: { attendance: any, confirmed: boolean }) {
    const classMap: Record<string, string> = {
      Warrior: '#C79C6E', Paladin: '#F48CBA', Hunter: '#ABD473', Rogue: '#FFF468',
      Priest: '#FFFFFF', 'Death Knight': '#C41E3A', Shaman: '#0070DD', Mage: '#3FC7EB',
      Warlock: '#8788EE', Monk: '#00FF98', Druid: '#FF7C0A', 'Demon Hunter': '#A330C9', Evoker: '#33937F'
    };

    const statusColor = attendance.status === 'attending' ? 'bg-green-500' :
      attendance.status === 'late' ? 'bg-yellow-500' : 'bg-red-500';

    return (
      <div
        onClick={() => isLeader && handleConfirm(selectedRaid.id, attendance.characterId, !confirmed)}
        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <img src={getClassIcon(attendance.character.class)} className={`w-5 h-5 rounded ${confirmed ? 'brightness-110 shadow-sm' : 'brightness-25 grayscale'}`} alt="" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-black ${statusColor}`}></div>
          </div>
          <span className="text-[10px] font-bold truncate tracking-tight" style={{ color: confirmed ? (classMap[attendance.character.class] || '#fff') : '#444' }}>
            {attendance.character.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {attendance.comment && <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" title={attendance.comment}></div>}
          <svg className="w-2.5 h-2.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    );
  }

  function CreateRaidModal() {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
        <div className="bg-[#12121A] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <header className="p-8">
            <h2 className="text-sm font-black tracking-widest uppercase text-white">Raid-Ereignis planen</h2>
          </header>
          <div className="p-8 space-y-4">
            <input
              type="text"
              value={newRaid.title}
              onChange={e => setNewRaid({ ...newRaid, title: e.target.value })}
              placeholder="Name des Raids..."
              className="w-full bg-white/[0.02] rounded-2xl p-4 text-xs font-medium focus:ring-1 focus:ring-[var(--accent)]/40 outline-none"
            />
            <div className="grid grid-cols-2 gap-4">
              <select
                value={newRaid.difficulty}
                onChange={e => setNewRaid({ ...newRaid, difficulty: e.target.value })}
                className="w-full bg-white/[0.02] rounded-xl p-4 text-xs outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="Heroisch">Heroic</option>
                <option value="Mythisch">Mythic</option>
              </select>
              <input
                type="number"
                value={newRaid.maxPlayers}
                onChange={e => setNewRaid({ ...newRaid, maxPlayers: Number(e.target.value) })}
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-4 text-xs outline-none"
              />
            </div>
            <input
              type="datetime-local"
              value={newRaid.startTime}
              onChange={e => setNewRaid({ ...newRaid, startTime: e.target.value })}
              className="w-full bg-white/[0.02] rounded-xl p-4 text-xs outline-none"
            />

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-2">Anmeldung begrenzt auf Roster</label>
              <select
                value={newRaid.rosterId}
                onChange={e => setNewRaid({ ...newRaid, rosterId: e.target.value })}
                className="w-full bg-white/[0.02] rounded-xl p-4 text-xs outline-none border border-white/5"
              >
                <option value="">Alle Gildenmitglieder</option>
                {availableRosters.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreateRaid}
              className="w-full py-5 bg-[var(--accent)] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-[var(--accent)]/20"
            >
              Strategie speichern
            </button>
            <button onClick={() => setShowCreateModal(false)} className="w-full text-[9px] font-bold text-gray-700 uppercase tracking-widest hover:text-white transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  }
}
