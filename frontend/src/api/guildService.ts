// Guild Service
// Frontend API calls for guild and roster management

const getBackendUrl = () => {
    return (window as any).electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('apiBaseUrl') ||
        'http://localhost:3334';
};

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const GuildService = {
    // Get all guilds
    getGuilds: async () => {
        const response = await fetch(`${getBackendUrl()}/api/guilds`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Get guild roster
    getRoster: async (guildId: number, includeFiltered = false) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/roster?includeFiltered=${includeFiltered}`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Sync guild members from Blizzard
    syncMembers: async (guildId: number) => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/sync-members`, {
            method: 'POST',
            headers
        });
        return response.json();
    },

    // Get guild ranks and settings
    getRanks: async (guildId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/ranks`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Update admin ranks
    updateAdminRanks: async (guildId: number, ranks: number[]) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/admin-ranks`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            } as HeadersInit,
            body: JSON.stringify({ ranks })
        });
        return response.json();
    },

    // Update visible ranks
    updateVisibleRanks: async (guildId: number, ranks: number[]) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/visible-ranks`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            } as HeadersInit,
            body: JSON.stringify({ ranks })
        });
        return response.json();
    },

    // Update Main Roster Overrides
    updateMainRosterOverrides: async (guildId: number, includedIds: number[], excludedIds: number[]) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/main-roster-overrides`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            } as HeadersInit,
            body: JSON.stringify({ includedIds, excludedIds })
        });
        return response.json();
    },

    // Add external member to Main Roster
    addExternalToMainRoster: async (guildId: number, name: string, realm: string) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/main-roster/add-external`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            } as HeadersInit,
            body: JSON.stringify({ name, realm })
        });
        return response.json();
    },

    // Get chat history
    getChatHistory: async (guildId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/chat`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Promote member
    promoteMember: async (guildId: number, characterId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/members/${characterId}/promote`, {
            method: 'POST',
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Demote member
    demoteMember: async (guildId: number, characterId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/members/${characterId}/demote`, {
            method: 'POST',
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // Kick member
    kickMember: async (guildId: number, characterId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/members/${characterId}/kick`, {
            method: 'POST',
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    // --- ROSTER MANAGEMENT ---
    getRosters: async (guildId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/rosters`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    saveRoster: async (guildId: number, rosterData: any) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/rosters`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            } as HeadersInit,
            body: JSON.stringify(rosterData)
        });
        return response.json();
    },

    deleteRoster: async (guildId: number, rosterId: number) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/rosters/${rosterId}`, {
            method: 'DELETE',
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    },

    addExternalMember: async (guildId: number, rosterId: number, name: string, realm: string) => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/${guildId}/rosters/${rosterId}/add-external`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            } as HeadersInit,
            body: JSON.stringify({ name, realm })
        });
        return response.json();
    },

    getRealms: async () => {
        const response = await fetch(`${getBackendUrl()}/api/guilds/realms`, {
            headers: getAuthHeader() as HeadersInit
        });
        return response.json();
    }
};
