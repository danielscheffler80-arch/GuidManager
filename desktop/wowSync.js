const fs = require('fs');
const path = require('path');
const axios = require('axios');

class WoWKeystoneSync {
    constructor(config) {
        this.config = config;
        this.watching = false;
        this.wowPath = null;
        this.accountPath = null;
    }

    slugify(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start
            .replace(/-+$/, '');            // Trim - from end
    }

    async start() {
        if (this.watching) return;

        // Versuche WoW Pfad zu finden
        // 1. Aus Config
        // 2. Standard-Pfade
        const possiblePaths = [
            'E:\\World of Warcraft',
            'C:\\Program Files (x86)\\World of Warcraft',
            'D:\\World of Warcraft'
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                this.wowPath = p;
                break;
            }
        }

        if (!this.wowPath) {
            console.log('[WoWSync] WoW Pfad nicht gefunden.');
            return;
        }

        const retailPath = path.join(this.wowPath, '_retail_', 'WTF', 'Account');
        if (!fs.existsSync(retailPath)) return;

        this.accountPath = retailPath;
        this.watching = true;
        console.log(`[WoWSync] Starte Überwachung von ${this.accountPath}`);

        // Scanne Accounts und stelle sicher, dass das Addon installiert ist
        this.ensureAddonInstalled();

        // Scanne alle Accounts
        const accounts = fs.readdirSync(this.accountPath);
        for (const account of accounts) {
            const svPath = path.join(this.accountPath, account, 'SavedVariables', 'GuildManagerBridgeSync.lua');
            if (fs.existsSync(svPath)) {
                this.watchFile(svPath);
                this.parseAndSync(svPath);
            }
        }
    }

    watchFile(filePath) {
        console.log(`[WoWSync] Überwache Datei: ${filePath}`);
        fs.watch(filePath, (event) => {
            if (event === 'change') {
                console.log(`[WoWSync] Datei geändert: ${filePath}`);
                // Verzögerung um Buffer-Probleme beim Schreiben von WoW zu vermeiden
                setTimeout(() => this.parseAndSync(filePath), 1000);
            }
        });
    }

    ensureAddonInstalled() {
        try {
            if (!this.wowPath) return;
            const addonPath = path.join(this.wowPath, '_retail_', 'Interface', 'AddOns', 'GuildManagerBridgeSync');
            const oldAddonPath = path.join(this.wowPath, '_retail_', 'Interface', 'AddOns', 'GuildManagerBridge');

            this.logToFile(`Prüfe Addon-Installation unter: ${addonPath}`);

            // 1. Alte Version löschen, falls vorhanden (auf Wunsch des Users für Sauberkeit)
            if (fs.existsSync(oldAddonPath)) {
                this.logToFile(`Alte Addon-Version gefunden. Lösche ${oldAddonPath}...`);
                fs.rmSync(oldAddonPath, { recursive: true, force: true });
            }

            // 2. Prüfe ob neue Version da ist
            if (!fs.existsSync(addonPath)) {
                this.logToFile(`Addon nicht gefunden. Installiere...`);
                fs.mkdirSync(addonPath, { recursive: true });

                const assetsPath = path.join(__dirname, 'assets', 'addon');
                if (fs.existsSync(assetsPath)) {
                    const files = fs.readdirSync(assetsPath);
                    for (const file of files) {
                        const src = path.join(assetsPath, file);
                        const dest = path.join(addonPath, file);
                        fs.copyFileSync(src, dest);
                        this.logToFile(`Kopiert: ${file}`);
                    }
                    this.logToFile('Addon erfolgreich installiert.');
                } else {
                    this.logToFile(`FEHLER: Addon-Assets nicht gefunden unter ${assetsPath}`);
                }
            } else {
                this.logToFile('Addon ist bereits installiert.');
            }
        } catch (err) {
            this.logToFile(`FEHLER bei Addon-Installation: ${err.message}`);
        }
    }

    logToFile(message) {
        try {
            const logPath = path.join(__dirname, 'sync-debug.log');
            const timestamp = new Date().toISOString();
            fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
            console.log(`[WoWSync] ${message}`);
        } catch (err) {
            console.error('[WoWSync] Log Fehler:', err);
        }
    }

    async parseAndSync(filePath) {
        try {
            if (!fs.existsSync(filePath)) return;
            const content = fs.readFileSync(filePath, 'utf8');

            this.logToFile(`Parse Datei: ${filePath}`);

            // Wir suchen den Inhalt der "keys" Tabelle. 
            // Da WoW-SavedVariables geschachtelt sind, nehmen wir alles nach dem "keys" Start.
            const keysStartMarker = '["keys"] = {';
            const startIndex = content.indexOf(keysStartMarker);

            if (startIndex === -1) {
                this.logToFile('Marker ["keys"] = { nicht gefunden.');
                return;
            }

            // Wir nehmen den Rest des Files ab dem Marker
            const keysContent = content.substring(startIndex + keysStartMarker.length);
            const keys = [];

            // Regex für Charakter-Einträge: ["Name-Realm"] = { ... }
            // Wir suchen nach dem Muster: ["irgendwas-mit-bindestrich"] = { ... }
            const charEntryRegex = /\["([^"]+-[^"]+)"\]\s*=\s*\{([\s\S]+?)\}/g;
            let match;

            while ((match = charEntryRegex.exec(keysContent)) !== null) {
                const charKey = match[1];
                const dataBlock = match[2];

                const levelMatch = /\["level"\]\s*=\s*(\d+)/.exec(dataBlock);
                const dungeonMatch = /\["dungeonName"\]\s*=\s*"([^"]+)"/.exec(dataBlock);
                const timestampMatch = /\["timestamp"\]\s*=\s*(\d+)/.exec(dataBlock);
                const sourceMatch = /\["source"\]\s*=\s*"([^"]+)"/.exec(dataBlock);

                if (levelMatch && dungeonMatch) {
                    const parts = charKey.split('-');
                    if (parts.length >= 2) {
                        const name = parts[0];
                        const rawRealm = parts.slice(1).join('-');
                        const realm = this.slugify(rawRealm);

                        keys.push({
                            name: name.toLowerCase(),
                            realm: realm,
                            level: parseInt(levelMatch[1]),
                            dungeon: dungeonMatch[1],
                            timestamp: timestampMatch ? parseInt(timestampMatch[1]) : null,
                            source: sourceMatch ? sourceMatch[1] : 'native',
                            isFromBag: true
                        });
                    }
                }
            }

            this.logToFile(`${keys.length} Keys erfolgreich extrahiert. Sende an Cloud...`);
            await this.sendToBackend(keys);
        } catch (err) {
            this.logToFile(`FEHLER beim Parsen: ${err.message}`);
        }
    }

    async sendToBackend(keys) {
        try {
            this.logToFile(`Sende an Backend: ${this.config.backendUrl}/api/mythic/sync-addon`);
            const response = await axios.post(`${this.config.backendUrl}/api/mythic/sync-addon`, {
                keys
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            this.logToFile(`Cloud-Antwort: ${JSON.stringify(response.data)}`);
        } catch (err) {
            this.logToFile(`Upload fehlgeschlagen: ${err.message}${err.response ? ' - ' + JSON.stringify(err.response.data) : ''}`);
        }
    }
}

module.exports = WoWKeystoneSync;
