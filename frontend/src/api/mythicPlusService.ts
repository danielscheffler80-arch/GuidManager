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
    }
};
