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

            // Wir suchen gezielt nach den Einträgen in der "keys" Tabelle
            // Format: ["keys"] = { ["Char-Realm"] = { ["level"] = X, ... } }

            const keysBlockMatch = /\["keys"\]\s*=\s*\{([\s\S]+?)\n\s*\}/.exec(content);
            if (!keysBlockMatch) {
                this.logToFile('Keine "keys" Tabelle im SavedVariable gefunden.');
                return;
            }

            const keysContent = keysBlockMatch[1];
            const keys = [];

            const charEntryRegex = /\["([^"]+)"\]\s*=\s*\{([^}]+)\}/g;
            let match;

            while ((match = charEntryRegex.exec(keysContent)) !== null) {
                const charKey = match[1];
                const dataBlock = match[2];

                const levelMatch = /\["level"\]\s*=\s*(\d+)/.exec(dataBlock);
                const dungeonMatch = /\["dungeonName"\]\s*=\s*"([^"]+)"/.exec(dataBlock);

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
                            isFromBag: true
                        });
                    }
                }
            }

            // Unabhängig davon, ob Keys gefunden wurden, senden wir den Sync ab
            this.logToFile(`${keys.length} Keys in Lua gefunden. Aktualisiere Cloud...`);
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
