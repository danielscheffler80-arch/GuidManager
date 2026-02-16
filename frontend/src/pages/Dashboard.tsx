
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatRealm, capitalizeName } from '../utils/formatUtils';

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
}

interface HubData {
  hasMain: boolean;
  mainCharacter?: {
    name: string;
    class: string;
    classId: number;
    level: number;
  };
  guild?: {
    name: string;
    realm: string;
    faction: string;
  };
  announcements: any[];
  raids: any[];
  mythicPlus: any;
  streams: any[];
}

export default function Dashboard() {
  const { user, syncCharacters } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCharacters = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const backendUrl = (window as any).electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
      const response = await fetch(`${backendUrl}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const allChars = data.user?.characters || data.characters || [];
        setCharacters(allChars);

        const main = allChars.find((c: Character) => c.isMain);
        if (main) {
          fetchHubData();
        } else {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch characters:', err);
      setIsLoading(false);
    }
  };

  const fetchHubData = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const backendUrl = (window as any).electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
      const response = await fetch(`${backendUrl}/guild/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHubData(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch hub data:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        setIsLoading(true);
        const charactersRes = await fetch(`${backendUrl}/users/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (charactersRes.ok) {
          const charData = await charactersRes.json();
          const allChars = charData.user?.characters || charData.characters || [];
          setCharacters(allChars);
        }
        await fetchHubData();
      }
    } catch (err) {
      console.error('Failed to set main character:', err);
    }
  };

  const handleManualSync = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setSyncStatus('syncing');
    try {
      await syncCharacters(false);
      await fetchCharacters();
      setSyncStatus('success');
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const getClassColor = (classId: number) => {
    const colors: Record<number, string> = {
      1: '#C79C6E', 2: '#F58CBA', 3: '#ABD473', 4: '#FFF569',
      5: '#FFFFFF', 6: '#C41F3B', 7: '#0070DE', 8: '#69CCF0',
      9: '#9482C9', 10: '#00FF96', 11: '#FF7D0A', 12: '#A330C9', 13: '#33937F'
    };
    return colors[classId] || '#D1D9E0';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
          <p>Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  // View: No Main Character / Character Selection
  if (!hubData?.hasMain) {
    return (
      <div className="page-container">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Willkommen bei Xava Guild Manager</h1>
            <p className="text-gray-400">Bitte wähle deinen <strong>Main-Charakter</strong> aus, um fortzufahren.</p>
          </div>
          <button
            onClick={handleManualSync}
            disabled={syncStatus === 'syncing'}
            className={`px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${syncStatus === 'syncing'
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-accent text-white hover:bg-[#b340d9] active:scale-95'
              }`}
          >
            {syncStatus === 'syncing' ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                <span>Synchronisiere...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Charaktere neu laden</span>
              </>
            )}
          </button>
        </header>

        <div className="bg-card rounded-xl p-6">
          {characters.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-white mb-2">Keine Charaktere gefunden</h3>
              <p className="text-gray-500">Wir konnten keine Charaktere für deinen Account finden. <br />Klicke oben auf den Button "Charaktere neu laden".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {characters.map(char => (
                <div
                  key={char.id}
                  onClick={() => setMainCharacter(char.id)}
                  className="bg-background p-4 rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:bg-white/5 group"
                >
                  <div
                    className="font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_8px_rgba(163,48,201,0.5)]"
                    style={{ color: getClassColor(char.classId) }}
                  >
                    {capitalizeName(char.name)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Lvl {char.level} {char.class} • {formatRealm(char.realm)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Guild Hub
  return (
    <div className="page-container space-y-8">
      <style>{`
        .dash-card {
          background: #1D1E1F;
          border: none;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .dash-card:hover {
          background: #222324;
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        .dash-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(163, 48, 201, 0.3), transparent);
        }
        .card-header {
          font-family: 'Inter', sans-serif;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          color: #fff;
          font-size: 1rem;
        }
        .stat-badge {
          background: rgba(163, 48, 201, 0.1);
          border: 1px solid rgba(163, 48, 201, 0.2);
          color: #A330C9;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      `}</style>

      <div
        className="grid grid-cols-2"
        style={{
          columnGap: '20px',
          rowGap: '60px',
          gridTemplateRows: '40vh 40vh',
          height: 'calc(80vh + 60px)'
        }}
      >
        {/* Announcements */}
        <div className="dash-card h-full flex flex-col">
          <div className="card-header">
            <span className="text-lg">📢</span> Announcements
          </div>
          <div className="flex-1 space-y-3">
            {hubData.announcements && hubData.announcements.length > 0 ? hubData.announcements.map(ann => (
              <div key={ann.id} className="bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-colors">
                <div className="font-black text-white text-xs uppercase tracking-wide mb-1 flex items-center justify-between">
                  {ann.title}
                  <span className="text-[8px] text-gray-600">HEUTE</span>
                </div>
                <div className="text-xs text-gray-400 font-medium leading-relaxed">{ann.content}</div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 py-8">
                <span className="text-2xl opacity-20">📭</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Keine Mitteilungen</span>
              </div>
            )}
          </div>
        </div>

        {/* Raids */}
        <div className="dash-card h-full flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div className="card-header mb-0">
              <span className="text-lg">⚔️</span> Next Raids
            </div>
            <div className="stat-badge">
              {hubData.raids?.length || 0} Aktiv
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {hubData.raids && hubData.raids.length > 0 ? hubData.raids.slice(0, 3).map(raid => (
              <div key={raid.id} className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black text-white uppercase tracking-tight group-hover:text-accent transition-colors">{raid.title}</span>
                  <span className="text-[8px] font-black text-accent uppercase bg-[#A330C9]/10 px-2 py-0.5 rounded">{raid.difficulty}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                  <div className="flex items-center gap-2">
                    <span className="text-[#A330C9]">📅</span>
                    {new Date(raid.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} • {new Date(raid.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700">👤</span>
                    {raid.attendances?.length || 0} / {raid.maxPlayers}
                  </div>
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 py-8">
                <span className="text-2xl opacity-20">🛡️</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Keine Raids geplant</span>
              </div>
            )}
          </div>

          <button
            onClick={() => window.location.href = '#/raids'}
            className="w-full mt-5 py-3 bg-white/5 rounded-xl text-[10px] font-black text-gray-500 hover:text-white hover:bg-[#A330C9]/10 transition-all uppercase tracking-widest"
          >
            Open Calendar
          </button>
        </div>

        {/* Mythic+ */}
        <div className="dash-card h-full flex flex-col">
          <div className="card-header">
            <span className="text-lg">💎</span> Mythic+ Progress
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
            {hubData.mythicPlus ? (
              <>
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#0070DE] to-[#69CCF0] mb-2 drop-shadow-[0_0_20px_rgba(0,112,222,0.3)]">
                  +{hubData.mythicPlus.level}
                </div>
                <div className="text-white font-black text-sm uppercase tracking-tight">{hubData.mythicPlus.dungeon}</div>
                <div className="stat-badge mt-4">Current Week</div>
              </>
            ) : (
              <div className="text-center py-6">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Kein Key registriert</span>
              </div>
            )}
          </div>
        </div>

        {/* Guild Streams */}
        <div className="dash-card h-full flex flex-col">
          <div className="card-header">
            <span className="text-lg">📺</span> Guild Streams
          </div>
          <div className="flex-1 space-y-2">
            {hubData.streams && hubData.streams.length > 0 ? hubData.streams.map(stream => (
              <div key={stream.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[120px]">{stream.title}</span>
                </div>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Live</span>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center py-4">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest opacity-30">All Content Creators Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
