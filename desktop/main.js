const { app, BrowserWindow, Menu, nativeImage, ipcMain, shell, desktopCapturer, session } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const WoWKeystoneSync = require('./wowSync');

// Hardware-Beschleunigung deaktivieren (hilft gegen lila Streifen/Grafikfehler)
app.disableHardwareAcceleration();

const projectRoot = path.join(__dirname, '..');
const isPackaged = app.isPackaged;

const configPath = isPackaged
  ? path.join(process.resourcesPath, 'app-config.json')
  : path.join(projectRoot, 'app-config.json');

const windowStatePath = isPackaged
  ? path.join(app.getPath('userData'), 'window-state.json')
  : path.join(projectRoot, 'window-state.json');

let config = { backendUrl: 'http://localhost:3334', mode: 'host' };
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error('Fehler beim Laden der config:', err);
}

let windowState = { width: 1440, height: 1000, x: undefined, y: undefined };
try {
  if (fs.existsSync(windowStatePath)) {
    windowState = JSON.parse(fs.readFileSync(windowStatePath, 'utf8'));
  }
} catch (err) {
  console.error('Fehler beim Laden des Window-States:', err);
}

// IPC Handler für externes Öffnen von URLs
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-sources', async (event, types) => {
  return await desktopCapturer.getSources({ types });
});

ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('get-gpu-info', async () => {
  return await app.getGPUInfo('basic');
});

let backendProc = null;
let frontendProc = null;

function createWindow() {
  const win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    title: "Guild Manager",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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

  let saveTimeout;
  const saveState = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      // Don't save if minimized or maximized logic might be needed but let's keep it simple
      if (win.isMinimized() || win.isMaximized()) return;

      const bounds = win.getBounds();
      windowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      };

      try {
        fs.writeFileSync(windowStatePath, JSON.stringify(windowState));
      } catch (err) {
        console.error('Failed to save window state:', err);
      }
    }, 500);
  };

  win.on('resize', saveState);
  win.on('move', saveState);
  win.on('close', () => {
    // Force final save if not minimized
    if (!win.isMinimized()) {
      const bounds = win.getBounds();
      fs.writeFileSync(windowStatePath, JSON.stringify({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      }));
    }
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

  if (isPackaged) {
    // In der installierten Version: Lokale Datei laden
    win.loadFile(path.join(process.resourcesPath, 'frontend', 'index.html')).catch(err => {
      console.error('Fehler beim Laden des Frontends:', err);
    });
  } else {
    // In der Entwicklung (Dev): Vite-Server laden
    const devUrl = process.env.FRONTEND_URL || 'http://localhost:5173/';

    // Öffne DevTools automatisch im Dev-Mode
    // win.webContents.openDevTools();

    const loadApp = () => {
      console.log(`[MAIN] Versuche Frontend zu laden: ${devUrl}`);
      win.loadURL(devUrl).catch((err) => {
        console.log(`[MAIN] Frontend noch nicht bereit (${err.code}), probiere in 2s erneut...`);
        setTimeout(loadApp, 2000);
      });
    };

    // Warte kurz bis Vite startet
    setTimeout(loadApp, 2000);
  }

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
            win.webContents.send('navigate', '/settings');
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Fullscreen Handlers
ipcMain.handle('toggle-window-fullscreen', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setFullScreen(!win.isFullScreen());
  }
});

ipcMain.handle('set-window-fullscreen', (event, flag) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setFullScreen(flag);
  }
});
}

function startProcesses() {
  if (app.isPackaged) return;

  const projectRoot = path.join(__dirname, '..');

  // Backend nur starten wenn wir NICHT im Client Modus sind
  if (config.mode !== 'client') {
    console.log('Starte Backend (minimiert)...');
    backendProc = spawn('cmd.exe', ['/c', 'start', '/min', 'npm.cmd', 'run', 'dev'], {
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

app.on('ready', () => {
  startProcesses();
  createWindow();

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
