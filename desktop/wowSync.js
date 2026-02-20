const fs = require('fs');
const path = require('path');
const axios = require('axios');

class WoWKeystoneSync {
    constructor(config) {
        this.config = config;
        this.watching = false;
        this.wowPath = null;
        this.accountPath = null;
        this.syncInterval = null;
    }

    slugify(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    async start() {
        if (this.watching) return;

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

        // Stelle sicher, dass das Addon installiert ist
        this.ensureAddonInstalled();

        // Initialer Scan aller Datenquellen
        await this.fullScan();

        // Periodischer Scan alle 60 Sekunden (fängt /reload und Logout-Events ab)
        this.syncInterval = setInterval(() => this.fullScan(), 60000);

        // Zusätzlich File-Watcher für sofortige Reaktion
        this.setupWatchers();
    }

    setupWatchers() {
        const accounts = fs.readdirSync(this.accountPath);
        for (const account of accounts) {
            if (account === 'SavedVariables') continue;
            const svDir = path.join(this.accountPath, account, 'SavedVariables');
            if (!fs.existsSync(svDir)) continue;

            // Watch our own addon
            const gmPath = path.join(svDir, 'GuildManagerBridgeSync.lua');
            if (fs.existsSync(gmPath)) this.watchFile(gmPath);

            // Watch BigWigs
            const bwPath = path.join(svDir, 'BigWigs.lua');
            if (fs.existsSync(bwPath)) this.watchFile(bwPath);

            // Watch AlterEgo
            const aePath = path.join(svDir, 'AlterEgo.lua');
            if (fs.existsSync(aePath)) this.watchFile(aePath);
        }
    }

    async fullScan() {
        this.logToFile('--- Starte Full-Scan aller Datenquellen ---');
        const allKeys = [];

        const accounts = fs.readdirSync(this.accountPath);
        for (const account of accounts) {
            if (account === 'SavedVariables') continue;
            const svDir = path.join(this.accountPath, account, 'SavedVariables');
            if (!fs.existsSync(svDir)) continue;

            // 1. Eigenes Addon (höchste Priorität)
            const gmKeys = this.parseGuildManagerBridge(path.join(svDir, 'GuildManagerBridgeSync.lua'));
            // 2. BigWigs
            const bwKeys = this.parseBigWigs(path.join(svDir, 'BigWigs.lua'));
            // 3. AlterEgo
            const aeKeys = this.parseAlterEgo(path.join(svDir, 'AlterEgo.lua'));

            this.logToFile(`Account ${account}: GM=${gmKeys.length}, BigWigs=${bwKeys.length}, AlterEgo=${aeKeys.length}`);

            // Merge: Eigenes Addon > BigWigs > AlterEgo (by char key)
            const merged = new Map();
            // AlterEgo first (lowest prio)
            for (const k of aeKeys) merged.set(`${k.name}-${k.realm}`, k);
            // BigWigs overwrites AlterEgo
            for (const k of bwKeys) merged.set(`${k.name}-${k.realm}`, k);
            // Our addon overwrites everything
            for (const k of gmKeys) merged.set(`${k.name}-${k.realm}`, k);

            allKeys.push(...merged.values());
        }

        if (allKeys.length > 0) {
            this.logToFile(`${allKeys.length} Keys gesamt gefunden. Sende an Cloud...`);
            await this.sendToBackend(allKeys);
        } else {
            this.logToFile('Keine Keys in irgendeiner Datenquelle gefunden.');
        }
    }

    watchFile(filePath) {
        try {
            console.log(`[WoWSync] Überwache Datei: ${filePath}`);
            fs.watch(filePath, (event) => {
                if (event === 'change') {
                    this.logToFile(`Datei geändert: ${filePath}`);
                    setTimeout(() => this.fullScan(), 1500);
                }
            });
        } catch (err) {
            this.logToFile(`WARNUNG: Konnte ${filePath} nicht überwachen: ${err.message}`);
        }
    }

    // ── Parser: GuildManagerBridgeSync.lua ──
    parseGuildManagerBridge(filePath) {
        try {
            if (!fs.existsSync(filePath)) return [];
            const content = fs.readFileSync(filePath, 'utf8');

            if (content.includes('GuildManagerBridgeDB = nil')) return [];

            const keysStartMarker = '["keys"] = {';
            const startIndex = content.indexOf(keysStartMarker);
            if (startIndex === -1) return [];

            const keysContent = content.substring(startIndex + keysStartMarker.length);
            return this.parseCharEntries(keysContent, 'addon');
        } catch (err) {
            this.logToFile(`FEHLER GM-Parse: ${err.message}`);
            return [];
        }
    }

    // ── Parser: BigWigs.lua ──
    parseBigWigs(filePath) {
        try {
            if (!fs.existsSync(filePath)) return [];
            const content = fs.readFileSync(filePath, 'utf8');

            const keys = [];
            // BigWigs stores: BigWigs3DB.myKeystones["Player-XXX"] = { name, realm, keyLevel, keyMap, ... }
            const marker = '["myKeystones"] = {';
            const startIndex = content.indexOf(marker);
            if (startIndex === -1) return [];

            // Extract the myKeystones block
            const block = content.substring(startIndex + marker.length);

            // Match each Player-XXX entry
            const entryRegex = /\["Player-[^"]+"\]\s*=\s*\{([\s\S]*?)\},?\s*(?=\["Player-|\})/g;
            let match;

            while ((match = entryRegex.exec(block)) !== null) {
                const data = match[1];
                const nameMatch = /\["name"\]\s*=\s*"([^"]+)"/.exec(data);
                const realmMatch = /\["realm"\]\s*=\s*"([^"]+)"/.exec(data);
                const levelMatch = /\["keyLevel"\]\s*=\s*(\d+)/.exec(data);
                const mapMatch = /\["keyMap"\]\s*=\s*(\d+)/.exec(data);

                if (nameMatch && realmMatch && levelMatch && mapMatch) {
                    const level = parseInt(levelMatch[1]);
                    const mapId = parseInt(mapMatch[1]);

                    // Skip entries with level 0 (no key)
                    if (level <= 0 || mapId <= 0) continue;

                    keys.push({
                        name: nameMatch[1].toLowerCase(),
                        realm: this.slugify(realmMatch[1]),
                        level: level,
                        dungeon: `MapID:${mapId}`,  // Backend will resolve dungeon name
                        mapId: mapId,
                        timestamp: null,
                        source: 'bigwigs',
                        isFromBag: true
                    });
                }
            }
            return keys;
        } catch (err) {
            this.logToFile(`FEHLER BigWigs-Parse: ${err.message}`);
            return [];
        }
    }

    // ── Parser: AlterEgo.lua ──
    parseAlterEgo(filePath) {
        try {
            if (!fs.existsSync(filePath)) return [];
            const content = fs.readFileSync(filePath, 'utf8');

            const keys = [];
            // AlterEgo stores keystone data per Player GUID with:
            // ["mythicplus"] = { ["keystone"] = { ["mapId"] = X, ["level"] = Y, ... } }
            // and ["info"] = { ["name"] = "...", ["realm"] = "..." }

            // Find all Player blocks that contain keystone data
            // Strategy: find each ["keystone"] block and look backwards for character info
            const playerRegex = /\["Player-[^\]]+"\]\s*=\s*\{/g;
            let playerMatch;

            while ((playerMatch = playerRegex.exec(content)) !== null) {
                const playerStart = playerMatch.index;
                // Get a reasonably large chunk after this player entry (up to 5000 chars)
                const chunk = content.substring(playerStart, playerStart + 5000);

                // Check if this player has keystone data
                const ksLevelMatch = /\["keystone"\]\s*=\s*\{[\s\S]*?\["level"\]\s*=\s*(\d+)/.exec(chunk);
                if (!ksLevelMatch) continue;

                const level = parseInt(ksLevelMatch[1]);
                if (level <= 0) continue;

                const ksMapMatch = /\["keystone"\]\s*=\s*\{[\s\S]*?\["mapId"\]\s*=\s*(\d+)/.exec(chunk);
                const nameMatch = /\["name"\]\s*=\s*"([^"]+)"/.exec(chunk);
                const realmMatch = /\["realm"\]\s*=\s*"([^"]+)"/.exec(chunk);

                if (nameMatch && realmMatch && ksMapMatch) {
                    const mapId = parseInt(ksMapMatch[1]);
                    if (mapId <= 0) continue;

                    keys.push({
                        name: nameMatch[1].toLowerCase(),
                        realm: this.slugify(realmMatch[1]),
                        level: level,
                        dungeon: `MapID:${mapId}`,
                        mapId: mapId,
                        timestamp: null,
                        source: 'alterego',
                        isFromBag: true
                    });
                }
            }
            return keys;
        } catch (err) {
            this.logToFile(`FEHLER AlterEgo-Parse: ${err.message}`);
            return [];
        }
    }

    // ── Shared: Parse character entries from GuildManagerBridge format ──
    parseCharEntries(content, source) {
        const keys = [];
        const charEntryRegex = /\["([^"]+-[^"]+)"\]\s*=\s*\{([\s\S]+?)\}/g;
        let match;

        while ((match = charEntryRegex.exec(content)) !== null) {
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
                        source: sourceMatch ? sourceMatch[1] : source,
                        isFromBag: true
                    });
                }
            }
        }
        return keys;
    }

    ensureAddonInstalled() {
        try {
            if (!this.wowPath) return;
            const addonPath = path.join(this.wowPath, '_retail_', 'Interface', 'AddOns', 'GuildManagerBridgeSync');
            const oldAddonPath = path.join(this.wowPath, '_retail_', 'Interface', 'AddOns', 'GuildManagerBridge');

            this.logToFile(`Prüfe Addon-Installation unter: ${addonPath}`);

            if (fs.existsSync(oldAddonPath)) {
                this.logToFile(`Alte Addon-Version gefunden. Lösche ${oldAddonPath}...`);
                fs.rmSync(oldAddonPath, { recursive: true, force: true });
            }

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

    async sendToBackend(keys) {
        try {
            this.logToFile(`Sende ${keys.length} Keys an Backend: ${this.config.backendUrl}/api/mythic/sync-addon`);
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
