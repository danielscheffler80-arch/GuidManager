// Mythic Plus Service
// Frontend API calls for Mythic+ keys

const getBackendUrl = () => {
    return (window as any).electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('apiBaseUrl') ||
        'http://localhost:3334';
};

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const MythicPlusService = {
    // Get all keys for a guild
    getGuildKeys: async (guildId: number) => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/mythic`, {
            headers
        });
        return response.json();
    },

    // Sync Mythic+ data for guild
    syncKeys: async (guildId: number) => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/sync-mythic-plus`, {
            method: 'POST',
            headers
        });
        return response.json();
    },

    // Signup for a key
    signup: async (guildId: number, keyId: number, characterId: number, primaryRole: string, secondaryRole?: string, message?: string) => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/mythic/${keyId}/signup`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ characterId, primaryRole, secondaryRole, message })
        });
        return response.json();
    },

    // Update signup status (accept/decline)
    updateSignupStatus: async (guildId: number, signupId: number, status: string) => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/mythic/signups/${signupId}`, {
            method: 'PATCH',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        return response.json();
    },

    // Remove own signup or delete signup as key owner
    removeSignup: async (guildId: number, signupId: number) => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/mythic/signups/${signupId}`, {
            method: 'DELETE',
            headers
        });
        return response.json();
    }
};
