import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface MessagePopupProps {
    receiverId: number;
    receiverName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

const MessagePopup: React.FC<MessagePopupProps> = ({ receiverId, receiverName, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // We need to know which character is sending. For now, we use the character most recently synced or first one.
    // In a full implementation, we might let the user choose their sender character.
    const senderChar = user?.characters?.find((c: any) => c.isMain) || user?.characters?.[0];

    const handleSend = async () => {
        if (!content.trim() || !senderChar) return;

        setIsSending(true);
        setError(null);

        try {
            const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3334'}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    senderId: senderChar.id,
                    receiverId,
                    content: content.trim()
                })
            });

            if (!resp.ok) {
                throw new Error('Fehler beim Senden der Nachricht');
            }

            setContent('');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div
                className="bg-[#1D1E1F] border border-[#333] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200"
                style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
                <div className="bg-[#252627] p-4 border-b border-[#333] flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 m-0">
                        Nachricht an <span className="text-accent">{receiverName}</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Schreibe deine Nachricht..."
                        className="bg-[#151617] border border-[#333] rounded-xl p-4 text-sm text-gray-200 focus:outline-none focus:border-accent/50 min-h-[120px] resize-none transition-all"
                        autoFocus
                    />

                    {error && (
                        <div className="text-red-500 text-[10px] font-bold uppercase tracking-wider text-center bg-red-500/10 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-[#252627] hover:bg-[#2a2b2c] text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            Abbrechen
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !content.trim()}
                            className="flex-1 px-4 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-accent/20"
                        >
                            {isSending ? 'Sende...' : 'Senden'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessagePopup;
