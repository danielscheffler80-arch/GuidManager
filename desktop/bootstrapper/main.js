const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 650,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#1a1a1a'
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.on('close-app', () => app.quit());

ipcMain.handle('get-versions', async () => {
    try {
        const response = await axios.get('https://guidmanager-production.up.railway.app/api/update/list');
        return response.data.versions;
    } catch (err) {
        console.error('Failed to fetch versions:', err);
        return [];
    }
});

ipcMain.handle('download-and-install', async (event, url) => {
    try {
        const fullUrl = url.startsWith('http') ? url : `https://guidmanager-production.up.railway.app${url}`;
        const tempPath = path.join(app.getPath('temp'), path.basename(fullUrl));

        // Download
        const response = await axios({
            url: fullUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                // Execute and Quit
                spawn(tempPath, [], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
                app.quit();
                resolve(true);
            });
            writer.on('error', reject);
        });
    } catch (err) {
        console.error('Download/Install failed:', err);
        return false;
    }
});
