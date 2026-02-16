import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GuildService } from '../api/guildService';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: string;
  type?: 'guild' | 'system';
  guildId?: number;
}

interface Guild {
  id: number;
  name: string;
  icon?: string;
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lade Gilden des Users
  useEffect(() => {
    const loadGuilds = async () => {
      let availableGuilds: Guild[] = [];

      // 1. Versuch: Über Account-Daten (schneller & zuverlässiger wenn gesynced)
      if (user?.guildMemberships && user.guildMemberships.length > 0) {
        // Map memberships to Guild objects
        availableGuilds = user.guildMemberships.map((m: any) => ({
          id: m.guildId,
          name: m.guild?.name || `Guild ${m.guildId}`,
          icon: m.guild?.icon
        }));
      }

      // 2. Versuch: Fallback über API wenn leer
      if (availableGuilds.length === 0) {
        try {
          const apiGuilds = await GuildService.getGuilds();
          if (apiGuilds && apiGuilds.length > 0) {
            availableGuilds = apiGuilds;
          }
        } catch (err) {
          console.error('Failed to load guilds via API', err);
        }
      }

      if (availableGuilds.length > 0) {
        // Remove duplicates based on ID
        const uniqueGuilds = Array.from(new Map(availableGuilds.map(g => [g.id, g])).values());

        setGuilds(uniqueGuilds);

        // Restore selection or default to first
        const savedGuildId = localStorage.getItem('chat_selected_guild');
        const found = uniqueGuilds.find(g => g.id.toString() === savedGuildId);
        setSelectedGuild(found || uniqueGuilds[0]);
      }
    };
    loadGuilds();
  }, [user]);

  // Socket Connection & Room Management
  useEffect(() => {
    if (!selectedGuild) return;

    localStorage.setItem('chat_selected_guild', selectedGuild.id.toString());

    // Load History First
    const fetchHistory = async () => {
      try {
        const history = await GuildService.getChatHistory(selectedGuild.id);
        if (Array.isArray(history)) {
          setMessages(history);
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
        setMessages([]);
      }
    };
    fetchHistory();

    const backendUrl = window.electronAPI?.getBackendUrl() || 'http://localhost:3334';
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Chat] Connected to socket, joining room:', selectedGuild.id);
      newSocket.emit('join-guild', selectedGuild.id);
    });

    newSocket.on('guild-chat', (msg: ChatMessage) => {
      // Nur Nachrichten anzeigen, die zu dieser Gilde gehören (oder System-Nachrichten)
      if (!msg.guildId || msg.guildId === selectedGuild.id) {
        setMessages(prev => {
          // Check for duplicates (by timestamp + content + sender) to avoid double entry from history + live
          const isDuplicate = prev.some(m =>
            m.timestamp === msg.timestamp &&
            m.content === msg.content &&
            m.sender === msg.sender
          );
          if (isDuplicate) return prev;
          return [...prev.slice(-99), msg];
        });
      }
    });

    // Listen for messages from Electron Log Watcher (Your own outgoing messages via Relay)
    if (window.electronAPI?.onGuildChat) {
      window.electronAPI.onGuildChat((data: ChatMessage) => {
        // Relay to backend with Current Guild ID
        newSocket.emit('guild-chat', { ...data, guildId: selectedGuild.id });
      });
    }

    return () => {
      newSocket.close();
    };
  }, [selectedGuild]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page-container" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', color: '#D1D9E0' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#40ff40' }}>●</span> Gilden-Chat (Live)
          </h2>
        </div>

        {/* Guild Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#888', fontSize: '0.9em' }}>Gilde:</span>
          <select
            value={selectedGuild?.id || ''}
            onChange={(e) => {
              const g = guilds.find(g => g.id === Number(e.target.value));
              if (g) setSelectedGuild(g);
            }}
            style={{
              padding: '8px',
              borderRadius: '6px',
              background: '#252526',
              color: '#fff',
              border: '1px solid #444',
              outline: 'none'
            }}
          >
            {guilds.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          background: '#1D1E1F',
          borderRadius: '12px',
          padding: '20px',
          overflowY: 'auto',
          border: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {!selectedGuild && (
          <div style={{ textAlign: 'center', color: '#555', marginTop: '40px' }}>
            Bitte wähle eine Gilde aus.
          </div>
        )}

        {selectedGuild && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', marginTop: '40px' }}>
            Noch keine Nachrichten empfangen...<br />
            <small>Stelle sicher, dass du in WoW eingeloggt bist.</small>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.95rem' }}>
            <span style={{ color: '#666', minWidth: '50px' }}>[{getTime(msg.timestamp)}]</span>
            <span style={{ color: '#A330C9', fontWeight: 'bold' }}>{msg.sender}:</span>
            <span style={{ color: '#D1D9E0', wordBreak: 'break-word' }}>{msg.content}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px', background: '#252526', borderRadius: '8px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Nachricht an Gilden-Mitglieder (App-Only)..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLInputElement;
              const content = target.value.trim();
              if (content && socket && selectedGuild) {
                const msg: ChatMessage = {
                  sender: user?.battletag || 'AppUser',
                  content,
                  timestamp: new Date().toISOString(),
                  guildId: selectedGuild.id
                };
                socket.emit('guild-chat', msg);
                target.value = '';
              }
            }
          }}
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff' }}
        />
      </div>

      <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(163, 48, 201, 0.1)', borderRadius: '8px', fontSize: '0.85em', color: '#888' }}>
        <strong>Status:</strong> Verbunden mit Gilde <strong>{selectedGuild?.name}</strong>. Nur Mitglieder dieser Gilde sehen diese Nachrichten.
      </div>
    </div>
  );
}
