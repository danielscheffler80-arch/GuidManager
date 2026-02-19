const { contextBridge, ipcRenderer } = require('electron');

// Backend URL Management
let workingBackendUrl = 'http://localhost:3334';
let backendCheckComplete = false;
let backendVerified = false;

async function verifyBackendUrl(url, retries = 1) {
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const timeout = isLocal ? 2000 : 8000; // 2s for local, 8s for cloud
  const maxRetries = isLocal ? 1 : 2;    // fewer retries for local

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

// Initialisierung
ipcRenderer.invoke('get-config').then(async (config) => {
  console.log('[PRELOAD] Config geladen:', config);

  // Support backendUrls array (try in order: localhost first, cloud fallback)
  const urlsToTry = config.backendUrls && config.backendUrls.length > 0
    ? config.backendUrls
    : config.backendUrl
      ? [config.backendUrl]
      : ['http://localhost:3334', 'https://guild-manager-backend.onrender.com'];

  let finalUrl = urlsToTry[urlsToTry.length - 1]; // use last as default
  let found = false;

  console.log('[PRELOAD] Starting backend discovery...', urlsToTry);
  for (const url of urlsToTry) {
    console.log(`[PRELOAD] Checking: ${url}`);
    if (await verifyBackendUrl(url)) {
      finalUrl = url;
      found = true;
      console.log(`[PRELOAD] Backend FOUND: ${finalUrl}`);
      break;
    } else {
      console.log(`[PRELOAD] Backend unreachable: ${url}, trying next...`);
    }
  }

  // Set the working URL
  workingBackendUrl = finalUrl;
  backendVerified = found;
  backendCheckComplete = true;
  console.log(`[PRELOAD] Discovery Complete. Final URL: ${workingBackendUrl} (Verified: ${found})`);
});

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => {
    ipcRenderer.send('open-external', url);
  },
  getBackendUrl: () => {
    return workingBackendUrl;
  },
  getSources: (types) => {
    return ipcRenderer.invoke('get-sources', types);
  },
  getGPUInfo: () => {
    return ipcRenderer.invoke('get-gpu-info');
  },
  isBackendReady: () => {
    return backendCheckComplete && backendVerified;
  },
  isCheckFinished: () => {
    return backendCheckComplete;
  },
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },
  onUpdateMessage: (callback) => {
    ipcRenderer.on('update-message', (event, message) => callback(message));
  },
  restartAndInstall: () => {
    return ipcRenderer.invoke('restart-and-install');
  },
  getVersion: () => {
    return ipcRenderer.invoke('get-version');
  },
  onGuildChat: (callback) => {
    ipcRenderer.on('guild-chat', (event, data) => callback(data));
  },
  toggleWindowFullscreen: () => {
    return ipcRenderer.invoke('toggle-window-fullscreen');
  },
  setWindowFullscreen: (flag) => {
    return ipcRenderer.invoke('set-window-fullscreen', flag);
  }
});