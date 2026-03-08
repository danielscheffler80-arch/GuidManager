import { AccessToken } from 'livekit-server-sdk';

/**
 * LiveKit Service:
 * Manages room tokens for the SFU-based streaming.
 * Streamers and viewers both use this to get access keys.
 */

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

if (LIVEKIT_API_KEY === 'devkey' || LIVEKIT_API_SECRET === 'secret') {
    console.warn('[LiveKit] WARNING: Using default development keys. Broadcasting might not work correctly on production servers.');
} else {
    console.log('[LiveKit] API Keys loaded successfully.');
}

export class LiveKitService {
    /**
     * Generates a join token for a specific room and identity.
     * @param roomName The unique name/ID of the stream room
     * @param participantIdentity The identity of the user (e.g., BattleTag)
     * @param options Permissions for the participant
     */
    static async createToken(roomName: string, participantIdentity: string, isPublisher: boolean = false) {
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantIdentity,
            name: participantIdentity.split('#')[0],
        });

        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: isPublisher,
            canSubscribe: true,
            canPublishData: true,
        });

        return at.toJwt();
    }
}
