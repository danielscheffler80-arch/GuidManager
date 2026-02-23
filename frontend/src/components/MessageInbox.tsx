import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { capitalizeName, getClassColor } from '../utils/formatUtils';

interface MessageInboxProps {
    onClose: () => void;
    onReply?: (receiverId: number, receiverName: string) => void;
}

interface Message {
    id: number;
    senderId: number;
    receiverId: number;
    content: string;
    read: boolean;
    createdAt: string;
    sender: {
        name: string;
        realm: string;
        class: string;
        classId: number;
    };
    receiver: {
        name: string;
        realm: string;
        class: string;
        classId: number;
    };
}

const MessageInbox: React.FC<MessageInboxProps> = ({ onClose, onReply }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeChar = user?.characters?.find((c: any) => c.isMain) || user?.characters?.[0];

    const fetchMessages = async () => {
        if (!activeChar) return;
        setLoading(true);
        try {
            const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/messages/${activeChar.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!resp.ok) throw new Error('Posteingang konnte nicht geladen werden');
            const data = await resp.json();
            setMessages(data);

            // Mark all unread messages as read when opening (or implement per group)
            const unreadIds = data.filter((m: Message) => !m.read && m.receiverId === activeChar.id).map((m: Message) => m.senderId);
            if (unreadIds.length > 0) {
                const uniqueSenders = Array.from(new Set(unreadIds));
                for (const sId of uniqueSenders) {
                    await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/messages/read`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ characterId: activeChar.id, senderId: sId })
                    });
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, [activeChar?.id]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div
                className="bg-[#1D1E1F] border border-[#333] rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300"
                style={{ boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.7)' }}
            >
                <div className="bg-[#252627] p-6 border-b border-[#333] flex justify-between items-center bg-gradient-to-r from-[#252627] to-[#1D1E1F]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-xl">
                            📩
                        </div>
                        <div>
                            <h2 className="text-[14px] font-black uppercase tracking-[0.3em] text-white m-0">Posteingang</h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider m-0 mt-1">
                                {activeChar ? `Nachrichten für ${capitalizeName(activeChar.name)}` : 'Kein aktiver Charakter'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-[#333]/30 hover:bg-[#333]/60 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all transform hover:rotate-90"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-500">
                            <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Lade Nachrichten...</span>
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-4 p-10">
                            <div className="text-4xl">⚠️</div>
                            <p className="text-red-400 text-sm font-bold">{error}</p>
                            <button onClick={fetchMessages} className="px-6 py-2 bg-[#252627] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#333]">Erneut versuchen</button>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-30 grayscale p-10">
                            <div className="text-6xl">📭</div>
                            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Dein Posteingang ist leer</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isOutgoing = msg.senderId === activeChar?.id;
                            const displayChar = isOutgoing ? msg.receiver : msg.sender;

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col gap-2 p-5 rounded-2xl border transition-all ${!msg.read && !isOutgoing ? 'bg-accent/5 border-accent/20 shadow-lg shadow-accent/5' : 'bg-[#151617] border-[#333]'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#252627] rounded-lg flex items-center justify-center text-xs overflow-hidden border border-white/5">
                                                <img
                                                    src={`https://render.worldofwarcraft.com/us/icons/56/classicon_${displayChar?.class?.toLowerCase().replace(/\s+/g, '')}.jpg`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                    {isOutgoing ? 'An' : 'Von'}
                                                </span>
                                                <span className="text-sm font-bold" style={{ color: getClassColor(displayChar?.classId ?? (displayChar as any)?.class) }}>
                                                    {capitalizeName(displayChar?.name ?? '')}
                                                    <span className="text-[10px] text-gray-600 font-medium ml-2">({displayChar?.realm ?? 'Unknown'})</span>
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 tabular-nums">
                                            {formatDate(msg.createdAt)}
                                        </span>
                                    </div>

                                    <div className="mt-2 bg-[#1A1B1C] p-4 rounded-xl border border-white/5 italic text-gray-300 text-sm leading-relaxed">
                                        "{msg.content}"
                                    </div>

                                    {!isOutgoing && onReply && (
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={() => onReply(msg.senderId, msg.sender?.name ?? '')}
                                                className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <span>↩️</span> Antworten
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="bg-[#151617] p-4 text-center border-t border-[#333]">
                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                        Nachrichten werden automatisch als gelesen markiert
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MessageInbox;
