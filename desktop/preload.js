const { contextBridge, ipcRenderer } = require('electron');

// Backend URL Management
let workingBackendUrl = 'https://guild-manager-backend.onrender.com';
let backendCheckComplete = false;
let backendVerified = false;

async function verifyBackendUrl(url, retries = 1) {
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const timeout = isLocal ? 2000 : 8000;
  const maxRetries = isLocal ? 1 : 2;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(id);
      if (response.ok) return true;
    } catch (err) {
      console.log(`[PRELOAD] Try ${i + 1} failed for ${url}`);
      if (i < maxRetries) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

ipcRenderer.invoke('get-config').then(async (config) => {
  console.log('[PRELOAD] Config geladen:', config);

  // 1. Priorität: Config URL (meist cloud oder lokaler host)
  // 2. Fallback: Render Cloud
  const urlsToTry = [
    config.backendUrl,
    'https://guild-manager-backend.onrender.com'
  ].filter(Boolean);

  for (const url of urlsToTry) {
    console.log(`[PRELOAD] Verifying: ${url}`);
    const found = await verifyBackendUrl(url);
    if (found) {
      workingBackendUrl = url;
      backendVerified = true;
      break;
    }
  }

  backendCheckComplete = true;
  console.log(`[PRELOAD] Discovery Complete. Final URL: ${workingBackendUrl} (Verified: ${backendVerified})`);
});

// APIs für den Renderer-Prozess freigeben
contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => workingBackendUrl,
  isBackendReady: () => backendVerified,
  isCheckFinished: () => backendCheckComplete,
  setToken: (token) => ipcRenderer.send('set-token', token),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateMessage: (callback) => ipcRenderer.on('update-message', (event, msg) => callback(msg)),
  restartAndInstall: () => ipcRenderer.invoke('restart-and-install'),
  navigate: (callback) => ipcRenderer.on('navigate', (event, path) => callback(path)),
  getSources: (types) => ipcRenderer.invoke('get-sources', types),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  saveWowPath: (path) => ipcRenderer.invoke('save-wow-path', path),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-window-fullscreen'),
  onGuildChat: (callback) => ipcRenderer.on('guild-chat', (event, data) => callback(data)),
});