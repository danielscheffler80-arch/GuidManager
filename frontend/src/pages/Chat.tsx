import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GuildService } from '../api/guildService';
import { io, Socket } from 'socket.io-client';
import { useGuild } from '../contexts/GuildContext';

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
  const { guilds, selectedGuild, setSelectedGuild } = useGuild();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Socket Connection & Room Management
  useEffect(() => {
    if (!selectedGuild) return;

    localStorage.setItem('chat_selected_guild', selectedGuild.id.toString());

    // Load History First
    const fetchHistory = async () => {
      try {
        const history = await GuildService.getChatHistory(selectedGuild.id);
        if (Array.isArray(history)) {
          // Normalize names in history fallback (Strip #1234)
          const normalizedHistory = history.map((m: ChatMessage) => ({
            ...m,
            sender: m.sender.includes('#') ? m.sender.split('#')[0] : m.sender
          }));
          setMessages(normalizedHistory);
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
        setMessages([]);
      }
    };
    fetchHistory();

    const backendUrl = (window as any).electronAPI?.getBackendUrl() || 'http://localhost:3334';
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Chat] Connected to socket, joining room:', selectedGuild.id);
      newSocket.emit('join-guild', selectedGuild.id);
    });

    const handleIncomingMessage = (msg: ChatMessage) => {
      console.log('[Chat] Incoming:', msg.sender, msg.guildId);
      // Type-safe check (Number) for guildId mismatch
      if (!msg.guildId || Number(msg.guildId) === Number(selectedGuild.id)) {
        setMessages(prev => {
          // Resolve name fallback (Strip #1234) if not already resolved by backend
          const cleanSender = msg.sender.includes('#') ? msg.sender.split('#')[0] : msg.sender;
          const cleanMsg = { ...msg, sender: cleanSender };

          // Better duplicate check: sender (clean) + content + timestamp
          const isDuplicate = prev.some(m =>
            m.timestamp === msg.timestamp &&
            m.content === msg.content &&
            (m.sender === cleanSender || m.sender === msg.sender)
          );

          if (isDuplicate) return prev;
          return [...prev.slice(-99), cleanMsg];
        });
      }
    };

    newSocket.on('guild-chat', handleIncomingMessage);
    newSocket.on('guild-chat-resolved', handleIncomingMessage);

    // Listen for messages from Electron Log Watcher (Your own outgoing messages via Relay)
    if ((window as any).electronAPI?.onGuildChat) {
      (window as any).electronAPI.onGuildChat((data: ChatMessage) => {
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

  const getTimestamp = (iso: string) => {
    const date = new Date(iso);
    const datePart = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const timePart = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    // datePart looks like "Di., 17.02." -> remove the dot and comma or format manually
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
    const dayMonth = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return `[${weekday} ${dayMonth}][${timePart}]`;
  };

  return (
    <div className="page-container" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', color: '#D1D9E0' }}>

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
            <span style={{ color: '#666', minWidth: '125px' }}>{getTimestamp(msg.timestamp)}</span>
            <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{msg.sender}:</span>
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
