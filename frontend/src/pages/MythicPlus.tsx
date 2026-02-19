import React, { useEffect, useState } from 'react';
import { MythicPlusService } from '../api/mythicPlusService';
import { capitalizeName, getClassColor } from '../utils/formatUtils';
import { useGuild } from '../contexts/GuildContext';
import { storage } from '../utils/storage';
import { SignupModal } from '../components/SignupModal';

export default function MythicPlus() {
  const { guilds, selectedGuild, setSelectedGuild, loading: guildLoading } = useGuild();

  const [mains, setMains] = useState<any[]>([]);
  const [expandedMains, setExpandedMains] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedKey, setSelectedKey] = useState<any>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  useEffect(() => {
    if (selectedGuild) {
      // SWR: Load from cache
      const cachedKeys = storage.get(`cache_mythic_keys_${selectedGuild.id}`, []);
      if (cachedKeys.length > 0) {
        setMains(cachedKeys);
        setLoading(false);
      }
      loadKeys(selectedGuild.id);
    } else if (!guildLoading) {
      setLoading(false);
    }
  }, [selectedGuild, guildLoading]);


  const loadKeys = async (guildId: number) => {
    try {
      const data = await MythicPlusService.getGuildKeys(guildId);
      const mainsData = data.keys || [];
      setMains(mainsData);
      storage.set(`cache_mythic_keys_${guildId}`, mainsData);
    } catch (error) {
      console.error('Failed to load keys');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (mainId: number) => {
    setExpandedMains(prev =>
      prev.includes(mainId) ? prev.filter(id => id !== mainId) : [...prev, mainId]
    );
  };

  const handleSignup = (key: any) => {
    setSelectedKey(key);
    setShowSignupModal(true);
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

  if (loading) return <p className="p-8 text-center text-gray-400">Lade Mythic+ Daten...</p>;

  return (
    <section className="page-container p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
            Mythic<span className="text-accent">+</span> Keys
          </h1>
          <p className="text-gray-400 text-sm">Übersicht aller Gilden-Keys und Anmeldung</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-accent hover:opacity-80 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {syncing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Synchronisiere...
            </>
          ) : 'Sync Keys'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {mains.map(main => (
          <div key={main.id} className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Main Header */}
            <div className="p-4 flex items-center justify-between bg-[#222]">
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: `${getClassColor(main.classId || main.class)}22`, color: getClassColor(main.classId || main.class) }}
                >
                  {main.name[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: getClassColor(main.classId || main.class) }}>
                    {capitalizeName(main.name)}
                  </h3>
                  <p className="text-xs text-gray-500">{main.class} • {main.realm}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {main.keys && main.keys.length > 0 ? (
                  <div className="flex items-center gap-4">
                    {main.keys.map((key: any) => (
                      <div key={key.id} className="flex items-center gap-3 bg-[#111] px-4 py-2 rounded-lg border border-accent/30">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{key.dungeon}</p>
                          <p className="text-xl font-black text-white">+{key.level}</p>
                        </div>
                        <button
                          onClick={() => handleSignup(key)}
                          className="bg-accent text-xs px-3 py-1 rounded font-bold hover:opacity-80"
                        >
                          Anmelden
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-600 text-sm italic">Kein eigener Key</span>
                )}

                {main.alts && main.alts.length > 0 && (
                  <button
                    onClick={() => toggleExpand(main.id)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    {expandedMains.includes(main.id) ? 'Collapse' : `Twinks (${main.alts.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Twink List (Expanded) */}
            {expandedMains.includes(main.id) && (
              <div className="p-4 bg-[#151515] border-t border-gray-800 animate-in slide-in-from-top duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {main.alts.map((alt: any) => (
                    <div key={alt.id} className="bg-[#222] p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                      <div>
                        <p className="font-bold" style={{ color: getClassColor(alt.classId || alt.class) }}>
                          {capitalizeName(alt.name)}
                        </p>
                        <p className="text-[10px] text-gray-500">{alt.class}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {alt.keys && alt.keys.length > 0 ? (
                          <>
                            <div className="text-right">
                              <p className="text-[8px] text-gray-400 uppercase">{alt.keys[0].dungeon}</p>
                              <p className="font-black text-accent">+{alt.keys[0].level}</p>
                            </div>
                            <button
                              onClick={() => handleSignup(alt.keys[0])}
                              className="bg-[#333] hover:bg-[#444] text-[10px] px-2 py-1 rounded"
                            >
                              Join
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-700 italic">No Key</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signups Section */}
            {main.signups && main.signups.length > 0 && (
              <div className="px-4 py-2 bg-[#111] text-[10px] text-gray-500 border-t border-gray-800 flex gap-4 overflow-x-auto">
                <span className="font-bold uppercase tracking-widest text-gray-700 self-center">Interesse:</span>
                {main.signups.map((s: any) => (
                  <div key={s.id} className="bg-[#222] px-2 py-1 rounded border border-gray-800 flex items-center gap-2">
                    <span className="font-bold" style={{ color: getClassColor(s.character.classId || s.character.class) }}>
                      {capitalizeName(s.character.name)}
                    </span>
                    <span className="text-accent">{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {mains.length === 0 && (
          <div className="text-center py-20 bg-[#1a1a1a] rounded-xl border border-dashed border-gray-800">
            <p className="text-gray-500">Keine Charaktere für diese Gilde gefunden.</p>
          </div>
        )}
      </div>

      {showSignupModal && (
        <SignupModal
          selectedKey={selectedKey}
          onClose={() => setShowSignupModal(false)}
          onSuccess={() => {
            setShowSignupModal(false);
            if (selectedGuild) loadKeys(selectedGuild.id);
          }}
        />
      )}
    </section>
  );
}
