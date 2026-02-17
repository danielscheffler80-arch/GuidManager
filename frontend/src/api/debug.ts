import { API_BASE_URL } from './client';
import { storage } from '../utils/storage';

export async function logWebRTC(event: string, data: any) {
    try {
        const user = storage.get<any>('guild-manager-user', null);
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
