function resolveBase(): string {
  if ((window as any).electronAPI?.getBackendUrl) {
    return (window as any).electronAPI.getBackendUrl();
  }
  const ls = typeof window !== 'undefined' ? window.localStorage.getItem('apiBaseUrl') : null;
  if (ls) return ls;
  return 'https://guild-manager-backend.onrender.com';
}
export const API_BASE_URL = resolveBase();

export async function getGuilds(): Promise<{ guilds: any[] }> {
  const resp = await fetch(`${API_BASE_URL}/api/guilds`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
