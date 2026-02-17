import React, { useEffect, useState } from 'react';
import { MythicPlusService } from '../api/mythicPlusService';
import { capitalizeName } from '../utils/formatUtils';
import { useGuild } from '../contexts/GuildContext';
import { storage } from '../utils/storage';

export default function MythicPlus() {
  const { guilds, selectedGuild, setSelectedGuild, loading: guildLoading } = useGuild();

  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      // SWR: Load from cache
      const cachedKeys = storage.get(`cache_mythic_keys_${selectedGuild.id}`, []);
      if (cachedKeys.length > 0) {
        setKeys(cachedKeys);
        setLoading(false);
      }
      loadKeys(selectedGuild.id);
      setLoading(false);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, guildLoading]);


  const loadKeys = async (guildId: number) => {
    try {
      const data = await MythicPlusService.getGuildKeys(guildId);
      const keysData = data.keys || [];
      setKeys(keysData);
      storage.set(`cache_mythic_keys_${guildId}`, keysData);
    } catch (error) {
      console.error('Failed to load keys');
    }
  };

  const handleSync = async () => {
    if (!selectedGuild) return;
    setSyncing(true);
    try {
      await MythicPlusService.syncKeys(selectedGuild.id);
      loadKeys(selectedGuild.id);
    } catch (error) {
      console.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <p>Lade Mythic+ Daten...</p>;

  // Gruppiere Keys nach Charakter (Main/Alts)
  const mainKeys = keys.filter(k => k.character?.isMain);
  const altKeys = keys.filter(k => !k.character?.isMain);

  return (
    <section className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mythic+ Keys</h1>
        <div className="flex gap-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-[#A330C9] text-white px-4 py-2 rounded"
          >
            {syncing ? 'Synchronisiere...' : 'Sync Keys'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-[#A330C9]">Main Characters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mainKeys.map(k => (
              <div key={k.id} className="card p-4 border-l-4 border-[#A330C9]">
                <p className="font-bold text-lg">{capitalizeName(k.character.name)}</p>
                <p className="text-sm text-gray-400">{k.dungeon}</p>
                <p className="text-2xl font-bold mt-2">+{k.level}</p>
              </div>
            ))}
            {mainKeys.length === 0 && <p className="text-gray-500">Keine Keys für Main-Charaktere gefunden.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-300">Alts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {altKeys.map(k => (
              <div key={k.id} className="card p-4 border-gray-700">
                <p className="font-bold">{capitalizeName(k.character.name)}</p>
                <p className="text-xs text-gray-500">{k.dungeon}</p>
                <p className="text-xl font-bold mt-1">+{k.level}</p>
              </div>
            ))}
            {altKeys.length === 0 && <p className="text-gray-500">Keine Keys für Alts gefunden.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
