import { API_BASE_URL } from './client';

export async function logWebRTC(event: string, data: any) {
    try {
        const storedUser = localStorage.getItem('guild-manager-user');
        const user = storedUser ? JSON.parse(storedUser) : null;
        const userId = user?.battletag || 'unknown';

        await fetch(`${API_BASE_URL}/api/debug/webrtc-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                data,
                timestamp: new Date().toISOString(),
                userId
            })
        });
    } catch (err) {
        // Silent fail for logging
        console.warn('[Debug] Failed to send WebRTC log:', err);
    }
}
