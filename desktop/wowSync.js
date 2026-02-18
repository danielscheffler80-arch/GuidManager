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
            const svPath = path.join(this.accountPath, account, 'SavedVariables', 'GuildManagerBridge.lua');
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

    async parseAndSync(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // Sehr simpler Regex-Parser für das Lua-Tabellenformat
            // Wir suchen nach: ["Char-Realm"] = { ... level = X, mapID = Y ... }
            const charRegex = /\["([^"]+)"\]\s*=\s*\{([^}]+)\}/g;
            let match;
            const keys = [];

            while ((match = charRegex.exec(content)) !== null) {
                const charKey = match[1];
                const dataBlock = match[2];

                const levelMatch = /level"\s*\]\s*=\s*(\d+)/.exec(dataBlock);
                const mapIdMatch = /mapID"\s*\]\s*=\s*(\d+)/.exec(dataBlock);
                const dungeonMatch = /dungeonName"\s*\]\s*=\s*"([^"]+)"/.exec(dataBlock);

                if (levelMatch && mapIdMatch && dungeonMatch) {
                    const [name, realm] = charKey.split('-');
                    keys.push({
                        name: name.toLowerCase(),
                        realm: realm,
                        level: parseInt(levelMatch[1]),
                        dungeon: dungeonMatch[1],
                        isFromBag: true
                    });
                }
            }

            if (keys.length > 0) {
                console.log(`[WoWSync] Gefundene Keys: ${keys.length}. Sende an Backend...`);
                await this.sendToBackend(keys);
            }
        } catch (err) {
            console.error('[WoWSync] Fehler beim Parsen:', err);
        }
    }

    async sendToBackend(keys) {
        try {
            // Wir senden die Keys an ein neues Batch-Update-Endpunkt (müssen wir noch erstellen oder einzeln senden)
            // Hier nutzen wir den bestehenden Sync-Mechanismus oder erstellen einen neuen.
            // Für den Anfang: Sende an einen dedizierten Sync-Endpunkt.

            const response = await axios.post(`${this.config.backendUrl}/api/mythic/sync-addon`, {
                keys
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('[WoWSync] Backend-Antwort:', response.data);
        } catch (err) {
            console.error('[WoWSync] Upload fehlgeschlagen:', err.message);
        }
    }
}

module.exports = WoWKeystoneSync;
