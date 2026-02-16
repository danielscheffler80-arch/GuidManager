import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
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
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCharacters = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const backendUrl = window.electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
      const response = await fetch(`${backendUrl}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const allChars = data.user?.characters || data.characters || [];
        setCharacters(allChars);

        // Find main character to decide whether to show hub or selection
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
      const backendUrl = window.electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
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
      const backendUrl = window.electronAPI?.getBackendUrl?.() || 'http://localhost:3334';
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

  const { syncCharacters } = useAuth();

  const handleManualSync = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setSyncStatus('syncing');
    try {
      // Nutze den neuen basic sync für Geschwindigkeit
      await syncCharacters(false);

      // Danach Profile neu laden um Charaktere zu sehen
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
    return <div style={{ padding: '20px', color: '#D1D9E0' }}>Lade Dashboard...</div>;
  }

  // Falls kein Main Charakter gesetzt ist -> Selection View
  if (!hubData?.hasMain) {
    return (
      <section style={{ padding: '20px', color: '#D1D9E0', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Willkommen bei Xava Guild Manager</h1>
            <p style={{ margin: '5px 0 0 0' }}>Bitte wähle deinen <strong>Main-Charakter</strong> aus, um fortzufahren.</p>
          </div>
          <button
            onClick={() => {
              setSyncStatus('syncing');
              const { syncCharacters } = useAuth(); // Actually we need to make sure we can call this
              // Instead of calling from here, we'll just trigger one local fetch
              handleManualSync();
            }}
            disabled={syncStatus === 'syncing'}
            style={{
              background: '#A330C9', color: 'white', border: 'none', padding: '10px 20px',
              borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
              opacity: syncStatus === 'syncing' ? 0.5 : 1
            }}
          >
            {syncStatus === 'syncing' ? 'Synchronisiere...' : '🔄 Charaktere neu laden'}
          </button>
        </div>

        <div style={{ background: '#1D1E1F', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
          {characters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '3em', marginBottom: '20px' }}>🔍</div>
              <h3>Keine Charaktere gefunden</h3>
              <p style={{ color: '#888' }}>Wir konnten keine Charaktere für deinen Account finden. <br />Klicke oben auf den Button "Charaktere neu laden".</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {characters.map(char => (
                <div
                  key={char.id}
                  onClick={() => setMainCharacter(char.id)}
                  style={{
                    background: '#252525', padding: '15px', borderRadius: '8px', border: '1px solid #333',
                    cursor: 'pointer', transition: 'transform 0.2s', position: 'relative', overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: getClassColor(char.classId) }}>
                    {capitalizeName(char.name)}
                  </div>
                  <div style={{ color: '#888', fontSize: '0.9em' }}>
                    Lvl {char.level} {char.class} • {formatRealm(char.realm)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Guild Hub Layout
  return (
    <section style={{ padding: '20px', color: '#D1D9E0', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, color: '#A330C9' }}>{hubData.guild?.name || 'Gilden-Zentrale'}</h1>
          <p style={{ margin: 0, color: '#888' }}>
            {hubData.guild?.realm ? `${formatRealm(hubData.guild.realm)} • ${hubData.guild.faction}` : 'Noch keine Gilde synchronisiert'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: getClassColor(hubData.mainCharacter?.classId || 0) }}>
            {capitalizeName(hubData.mainCharacter?.name)}
          </div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>Main Charakter</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Announcements */}
        <div style={{ background: '#1D1E1F', padding: '20px', borderRadius: '12px', border: '1px solid #333', minHeight: '200px' }}>
          <h3 style={{ marginTop: 0, color: '#A330C9', borderBottom: '1px solid #333', paddingBottom: '10px' }}>📢 Announcements</h3>
          {hubData.announcements && hubData.announcements.length > 0 ? hubData.announcements.map(ann => (
            <div key={ann.id} style={{ marginBottom: '15px', padding: '10px', background: '#252525', borderRadius: '6px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{ann.title}</div>
              <div style={{ fontSize: '0.9em', color: '#aaa' }}>{ann.content}</div>
            </div>
          )) : (
            <div style={{ color: '#555', textAlign: 'center', paddingTop: '40px' }}>Keine neuen Ankündigungen</div>
          )}
        </div>

        {/* Raids */}
        <div className="card-premium p-6 border border-gray-800 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-[#A330C9] flex items-center gap-2">
              <span className="text-xl">⚔️</span> Kommende Raids
            </h3>
            <span className="text-xs text-gray-500 font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
              {hubData.raids?.length || 0} geplant
            </span>
          </div>

          <div className="space-y-4">
            {hubData.raids && hubData.raids.length > 0 ? hubData.raids.slice(0, 3).map(raid => (
              <div key={raid.id} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-all flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{raid.title}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-[#A330C9] uppercase">{raid.difficulty}</span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(raid.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} • {new Date(raid.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-300">
                    {raid.attendances?.length || 0} <span className="text-[10px] text-gray-600">Spieler</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {Math.max(0, Math.floor((new Date(raid.startTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d verbleibend
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 opacity-30">
                <p className="text-sm">Keine geplanten Raids</p>
              </div>
            )}
          </div>

          <button
            onClick={() => window.location.href = '#/raids'}
            className="w-full mt-6 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            Alle Raids anzeigen
          </button>
        </div>

        {/* Mythic+ */}
        <div style={{ background: '#1D1E1F', padding: '20px', borderRadius: '12px', border: '1px solid #333', minHeight: '200px' }}>
          <h3 style={{ marginTop: 0, color: '#A330C9', borderBottom: '1px solid #333', paddingBottom: '10px' }}>💎 Mythic+</h3>
          {hubData.mythicPlus ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#0070DE' }}>+{hubData.mythicPlus.level}</div>
              <div style={{ color: '#aaa' }}>{hubData.mythicPlus.dungeon}</div>
              <div style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>Wöchentliche Bestleistung</div>
            </div>
          ) : (
            <div style={{ color: '#555', textAlign: 'center', paddingTop: '40px' }}>Noch keine Keys gelaufen</div>
          )}
        </div>

        {/* Streams */}
        <div style={{ background: '#1D1E1F', padding: '20px', borderRadius: '12px', border: '1px solid #333', minHeight: '200px' }}>
          <h3 style={{ marginTop: 0, color: '#A330C9', borderBottom: '1px solid #333', paddingBottom: '10px' }}>📺 Live Streams</h3>
          {hubData.streams && hubData.streams.length > 0 ? hubData.streams.map(stream => (
            <div key={stream.id} style={{ marginBottom: '10px', background: '#252525', padding: '10px', borderRadius: '6px' }}>
              {/* Stream Item Rendering */}
            </div>
          )) : (
            <div style={{ color: '#555', textAlign: 'center', paddingTop: '40px' }}>Keine aktiven Streams</div>
          )}
        </div>
      </div>
    </section >
  );
}
