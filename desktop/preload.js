const { contextBridge, ipcRenderer } = require('electron');

// Backend URL Management
let workingBackendUrl = 'http://localhost:3334';
let backendCheckComplete = false;
let backendVerified = false;

async function verifyBackendUrl(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000); // 15 Sek. Timeout pro Versuch
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(id);
      if (response.ok) return true;
    } catch (err) {
      console.log(`[PRELOAD] Try ${i + 1} failed for ${url}`);
      if (i < retries) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return false;
}

// Initialisierung
ipcRenderer.invoke('get-config').then(async (config) => {
  console.log('[PRELOAD] Config geladen:', config);

  // Default to localhost if no config
  let finalUrl = 'http://localhost:3334';
  let found = false;

  if (config.backendUrls && Array.from(config.backendUrls).length > 0) {
    console.log('[PRELOAD] Starting backend discovery...');
    for (const url of config.backendUrls) {
      console.log(`[PRELOAD] Checking: ${url}`);
      if (await verifyBackendUrl(url)) {
        finalUrl = url;
        found = true;
        console.log(`[PRELOAD] Backend FOUND: ${finalUrl}`);
        break; // Stop at first working URL
      } else {
        console.log(`[PRELOAD] Backend unreachable: ${url}`);
      }
    }
  } else if (config.backendUrl) {
    finalUrl = config.backendUrl;
    found = await verifyBackendUrl(finalUrl);
  }

  // Set the working URL
  workingBackendUrl = finalUrl;
  backendVerified = found;
  backendCheckComplete = true; // Signals that the check IS FINISHED, regardless of result
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