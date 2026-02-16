const { app, BrowserWindow, Menu, nativeImage, ipcMain, shell, desktopCapturer } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// Hardware-Beschleunigung deaktivieren (hilft gegen lila Streifen/Grafikfehler)
app.disableHardwareAcceleration();

const projectRoot = path.join(__dirname, '..');
const isPackaged = app.isPackaged;

// Config laden - Prüfe Projekt-Root (Dev) oder Ressourcen-Ordner (Produktion)
let config = { backendUrl: 'http://localhost:3334', mode: 'host' };
try {
  const configPath = isPackaged
    ? path.join(process.resourcesPath, 'app-config.json')
    : path.join(projectRoot, 'app-config.json');

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`Config geladen von ${configPath}:`, config);
  } else {
    console.log(`Keine Config gefunden unter ${configPath}, verwende Default.`);
  }
} catch (err) {
  console.error('Fehler beim Laden der config:', err);
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

let backendProc = null;
let frontendProc = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
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
