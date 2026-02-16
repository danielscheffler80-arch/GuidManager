// Character Service
// Frontend API calls for character management

const getBackendUrl = () => {
    return (window as any).electronAPI?.getBackendUrl?.() ||
        localStorage.getItem('apiBaseUrl') ||
        'http://localhost:3334';
};

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const CharacterService = {
    // Update character details (Role, Class, etc.)
    updateCharacter: async (characterId: number, data: any) => {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(getAuthHeader() as Record<string, string>)
        };
        const response = await fetch(`${getBackendUrl()}/users/characters/${characterId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(data)
        });
        return response.json();
    },

    // Get user's characters
    getMyCharacters: async () => {
        const headers: HeadersInit = getAuthHeader() as Record<string, string>;
        const response = await fetch(`${getBackendUrl()}/users/profile`, {
            headers
        });
        return response.json();
    }
};
