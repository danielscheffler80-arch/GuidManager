const { app, BrowserWindow, Menu, nativeImage, ipcMain, shell, desktopCapturer, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const WoWKeystoneSync = require('./wowSync');

// Hardware-Beschleunigung deaktivieren (hilft gegen lila Streifen/Grafikfehler/White-Screen)
app.disableHardwareAcceleration();

const isPackaged = app.isPackaged;
const projectRoot = path.join(__dirname, '..');

// Config laden - Prüfe Ressourcen-Ordner (Produktion) oder Projekt-Root (Dev)
let config = { backendUrl: 'http://localhost:3334', mode: 'host' };
try {
  const configPath = isPackaged
    ? path.join(process.resourcesPath, 'app-config.json')
    : path.join(projectRoot, 'app-config.json');

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Standardize to 3334
    if (config.backendUrl && config.backendUrl.includes(':3000')) {
      config.backendUrl = config.backendUrl.replace(':3000', ':3334');
    }
    console.log(`Config geladen von ${configPath}:`, config);
  } else {
    console.log(`Keine Config gefunden unter ${configPath}, verwende Default.`);
  }
} catch (err) {
  console.error('Fehler beim Laden der config:', err);
}

// Update Endpoint Discovery
const UPDATER_URLS = [
  'http://localhost:3334/updates',
  'http://192.168.178.65:3334/updates',
  'http://93.207.23.221:3334/updates',
  'https://guild-manager-backend.onrender.com/updates'
];

async function findUpdateEndpoint() {
  console.log('[UPDATE] Searching for reachable update server...');

  for (const url of UPDATER_URLS) {
    try {
      console.log(`[UPDATE] Checking: ${url}`);
      const res = await fetch(`${url}/latest.yml`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        console.log(`[UPDATE] Found reachable endpoint: ${url}`);
        return url;
      }
    } catch (e) {
      console.log(`[UPDATE] ${url} unreachable or timed out`);
    }
  }
  return null;
}

// IPC Handler
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-sources', async (event, types) => {
  const sources = await desktopCapturer.getSources({ types });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }));
});

ipcMain.handle('get-gpu-info', async () => {
  return await app.getGPUInfo('basic');
});

ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    try {
      const endpoint = await findUpdateEndpoint();
      if (endpoint) {
        autoUpdater.setFeedURL({
          provider: 'generic',
          url: endpoint
        });
        console.log(`[UPDATE] Feed URL set to: ${endpoint}`);
        await autoUpdater.checkForUpdatesAndNotify();
        return { success: true };
      } else {
        console.warn('[UPDATE] No reachable update endpoint found.');
        if (mainWindow) mainWindow.webContents.send('update-message', 'Kein Update-Server erreichbar.');
        return { success: false, error: 'No reachable server' };
      }
    } catch (e) {
      console.error('[UPDATE] Check failed:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: 'Not packaged' };
});

// Auto-Update Events
autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'Suche nach Updates...');
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-message', `Update verfügbar (v${info.version}). Wird geladen...`);
});

autoUpdater.on('update-not-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'Deine Version ist aktuell.');
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-message', 'UPDATE_READY');
});

autoUpdater.on('error', (err) => {
  console.error('[UPDATE] Fehler:', err);
  if (mainWindow) mainWindow.webContents.send('update-message', `Fehler beim Update-Check: ${err.message}`);
});

ipcMain.handle('restart-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('toggle-window-fullscreen', () => {
  if (mainWindow) {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
    return !isFull;
  }
  return false;
});

ipcMain.handle('save-wow-path', (event, pathStr) => {
  console.log('[IPC] Saving WoW Path:', pathStr);
  config.wowPath = pathStr;

  // Config speichern
  try {
    const configPath = isPackaged
      ? path.join(process.resourcesPath, 'app-config.json')
      : path.join(projectRoot, 'app-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Addon sofort installieren
    installAddon();

    // WoW Chat Watcher (Currently DISABLED for standalone mode)
    // Chat Watcher neu starten mit neuem Pfad
    stopWatchingChat();
    // setTimeout(startWatchingChat, 1000); // Commented out as per instruction

    return { success: true };
  } catch (err) {
    console.error('Fehler beim Speichern der Config:', err);
    return { success: false, error: err.message };
  }
});

let mainWindow = null;

function createWindow() {
  // Verhindere mehrere Instanzen
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    // Jemand versucht eine zweite Instanz zu starten
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: (() => {
      try {
        const iconPath = path.join(__dirname, 'assets', 'app-icon.png');
        if (fs.existsSync(iconPath)) {
          const img = nativeImage.createFromPath(iconPath);
          if (!img.isEmpty()) return img;
        }
      } catch { }
      return undefined;
    })(),
  });

  // Berechtigungen für Kamera/Mikrofon automatisch erteilen
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      console.log(`[MAIN] Permission denied: ${permission}`);
      callback(false);
    }
  });

  const isPackaged = app.isPackaged;

  if (isPackaged) {
    // In der installierten Version: Lokale Datei aus resources laden
    const frontendPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(frontendPath).catch(err => {
      console.error('Fehler beim Laden des Frontends aus resources:', err);
    });
  } else {
    // In der Entwicklung (Dev): Vite-Server laden
    const devUrl = process.env.FRONTEND_URL || 'http://localhost:5173/';

    // Öffne DevTools automatisch im Dev-Mode
    // mainWindow.webContents.openDevTools();

    const loadApp = () => {
      console.log(`[MAIN] Versuche Frontend zu laden: ${devUrl}`);
      mainWindow.loadURL(devUrl).catch((err) => {
        console.log(`[MAIN] Frontend noch nicht bereit (${err.code}), probiere in 2s erneut...`);
        setTimeout(loadApp, 2000);
      });
    };

    // Warte kurz bis Vite startet
    setTimeout(loadApp, 2000);
  }

  // Menü erstellen
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Settings',
          click: () => {
            mainWindow.webContents.send('navigate', '/settings');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Event-Handler
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let backendProc = null;
let frontendProc = null;

function startProcesses() {
  if (app.isPackaged) return;

  const projectRoot = path.join(__dirname, '..');

  // Backend nur starten wenn wir NICHT im Client Modus sind
  if (config.mode !== 'client') {
    console.log('Starte Backend...');
    backendProc = spawn('npm.cmd', ['run', 'dev'], {
      cwd: path.join(projectRoot, 'backend'),
      shell: true,
      stdio: 'inherit'
    });

    backendProc.on('error', (err) => {
      console.error('[MAIN] FEHLER beim Starten des Backends:', err);
    });

    backendProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[MAIN] Backend mit Fehler beendet (Code: ${code})`);
      }
    });
  } else {
    console.log('Client Modus: Backend wird nicht gestartet.');
  }

  // Frontend IMMER starten im Dev Mode (damit localhost:5173 verfügbar ist)
  console.log('Starte Frontend...');
  frontendProc = spawn('npm.cmd', ['run', 'dev'], {
    cwd: path.join(projectRoot, 'frontend'),
    shell: true,
    stdio: 'inherit'
  });
}

function killProcesses() {
  if (process.platform === 'win32') {
    if (backendProc) {
      exec(`taskkill /pid ${backendProc.pid} /T /F`);
      backendProc = null;
    }
    if (frontendProc) {
      exec(`taskkill /pid ${frontendProc.pid} /T /F`);
      frontendProc = null;
    }
  } else {
    if (backendProc) backendProc.kill();
    if (frontendProc) frontendProc.kill();
  }
}

// Starte Watcher und Installer wenn App bereit
app.on('ready', () => {
  startProcesses();
  createWindow();

  // Addon Installation/Update
  installAddon();

  // Chat-Watcher mit Verzögerung starten
  setTimeout(startWatchingChat, 5000);

  // Update-Check nur in der installierten Version
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Start WoW Keystone Sync
  const wowSync = new WoWKeystoneSync(config);
  wowSync.start();
});

app.on('window-all-closed', () => {
  killProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killProcesses();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Addon Auto-Installer
// ---------------------------------------------------------
function installAddon() {
  const wowPath = detectWoWPath();
  if (!wowPath) {
    console.log('[Installer] WoW Path (_retail_) could not be detected.');
    return;
  }

  const addonDestDir = path.join(wowPath, 'Interface', 'AddOns', 'GuildManagerBridgeSync');

  const sourceAddonDir = isPackaged
    ? path.join(process.resourcesPath, 'addon')
    : path.join(__dirname, 'assets', 'addon');

  console.log(`[Installer] Installing addon from ${sourceAddonDir} to ${addonDestDir}`);

  try {
    if (!fs.existsSync(addonDestDir)) {
      fs.mkdirSync(addonDestDir, { recursive: true });
    }

    const filesToCopy = ['GuildManagerBridgeSync.toc', 'Core.lua'];
    filesToCopy.forEach(file => {
      const src = path.join(sourceAddonDir, file);
      const dest = path.join(addonDestDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[Installer] Copied ${file}`);
      } else {
        console.error(`[Installer] Source file not found: ${src}`);
      }
    });

    console.log('[Installer] Addon installation/update complete.');
  } catch (err) {
    console.error('[Installer] Error during addon installation:', err);
  }
}

// WoW Log Watcher für Gilden-Chat
// ---------------------------------------------------------
// WoW Log Watcher für Gilden-Chat
// ---------------------------------------------------------
let logWatchers = [];

function detectWoWPath() {
  const pathsToTry = [
    config.wowPath,
    'E:\\World of Warcraft',
    'C:\\Program Files (x86)\\World of Warcraft',
    'C:\\Program Files\\World of Warcraft',
    'D:\\Games\\World of Warcraft'
  ].map(p => {
    if (!p) return null;
    if (p.toLowerCase().endsWith('_retail_')) return p;
    return path.join(p, '_retail_');
  }).filter(p => {
    const exists = p && fs.existsSync(p);
    if (p) console.log(`[WoWPath] Checking ${p}: ${exists}`);
    return exists;
  });

  if (pathsToTry.length > 0) {
    console.log('[WoWPath] Found:', pathsToTry[0]);
    return pathsToTry[0];
  }
  return null;
}

function stopWatchingChat() {
  logWatchers.forEach(w => clearInterval(w.interval));
  logWatchers = [];
  console.log('[WoWWatcher] Stopped watching all logs.');
}

function startWatchingChat() {
  if (logWatchers.length > 0) return;

  const wowBase = detectWoWPath();
  if (!wowBase) {
    console.log('[WoWWatcher] WoW path not found. Retrying in 30s...');
    setTimeout(startWatchingChat, 30000);
    return;
  }

  const filesToWatch = [
    path.join(wowBase, 'Logs', 'WoWChatLog.txt'),
    path.join(wowBase, 'Logs', 'FrameXML.log')
  ];

  filesToWatch.forEach(filePath => {
    console.log(`[WoWWatcher] Starting watcher for: ${filePath}`);

    let lastFilePos = 0;
    try {
      if (fs.existsSync(filePath)) {
        lastFilePos = fs.statSync(filePath).size;
      }
    } catch (e) { }

    const interval = setInterval(() => {
      try {
        if (!fs.existsSync(filePath)) return;

        // Windows Aggressive Poke: Append empty string to force filesystem write update
        try {
          fs.appendFileSync(filePath, '');
        } catch (e) { }

        const stats = fs.statSync(filePath);

        if (stats.size < lastFilePos) {
          lastFilePos = 0;
        }

        if (stats.size > lastFilePos) {
          const stream = fs.createReadStream(filePath, {
            start: lastFilePos,
            end: stats.size
          });

          let data = '';
          stream.on('data', chunk => data += chunk);
          stream.on('end', () => {
            const watcherObj = logWatchers.find(w => w.filePath === filePath);
            if (watcherObj) watcherObj.lastFilePos = stats.size;
            processLogData(data);
          });
        }
      } catch (err) {
        console.error(`[WoWWatcher] Error reading ${filePath}:`, err);
      }
    }, 1000); // Aggressiver Check alle 1 Sekunde

    logWatchers.push({ filePath, interval, lastFilePos });
  });
}

function processLogData(text) {
  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    if (!line.trim() || line.includes('[GM_FILLER]')) return;

    // 1. Check for our standardized prefix first (most reliable)
    // Format: "2/16 00:05:00.000 [GM_CHAT][GUILD][PlayerName-Server]: Message"
    if (line.includes('[GM_CHAT][GUILD]')) {
      const gmMatch = line.match(/\[GM_CHAT\]\[GUILD\]\[(.*?)\]:\s*(.*)/);
      if (gmMatch) {
        const sender = gmMatch[1]?.trim() || 'Unknown';
        const content = gmMatch[2]?.trim() || '';

        console.log(`[WoWWatcher] GM_CHAT: ${sender}: ${content}`);
        if (mainWindow) {
          mainWindow.webContents.send('guild-chat', {
            sender,
            content,
            timestamp: new Date().toISOString()
          });
        }
        return; // Skip fallback if we hit our primary format
      }
    }

    // 2. Fallback: Standard WoW Log Format
    // Remove WoW escape sequences (|H...|h, |c..., |r, |T...|t)
    const cleanLine = line.replace(/\|H.*?\|h|\|c[0-9a-fA-F]{8}|\|r|\|T.*?\|t/g, '')
      .replace(/\|h/g, '');

    if (cleanLine.includes('[Guild]') || cleanLine.includes('[Gilde]') || cleanLine.includes('[Guilde]')) {
      const match = cleanLine.match(/\[(?:Guild|Gilde|Guilde)\]\s*(?:\[(.*?)\])?\s*([^:]+)?\s*:(.*)/);
      if (match) {
        const sender = (match[1] || match[2] || 'Unknown').trim();
        const content = match[3]?.trim() || '';

        console.log(`[WoWWatcher] Fallback Chat: ${sender}: ${content}`);

        if (mainWindow) {
          mainWindow.webContents.send('guild-chat', {
            sender,
            content,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  });
}