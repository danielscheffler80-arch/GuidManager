// Raid Service
// Frontend API calls for raid and calendar management

const getBackendUrl = () => {
    return (window as any).electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('apiBaseUrl') ||
        'http://localhost:3334';
};

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const RaidService = {
    // Get all raids for a guild
    getRaids: async (guildId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/raids`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Create a new raid
    createRaid: async (guildId: number, raidData: any) => {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(getAuthHeader() as Record<string, string>)
        };
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/raids`, {
            method: 'POST',
            headers,
            body: JSON.stringify(raidData)
        });
        return response.json();
    },

    // Sign up for a raid
    signup: async (guildId: number, raidId: number, signupData: any) => {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(getAuthHeader() as Record<string, string>)
        };
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/raids/${raidId}/attendance`, {
            method: 'POST',
            headers,
            body: JSON.stringify(signupData)
        });
        return response.json();
    }
};
