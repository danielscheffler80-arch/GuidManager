const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..', '..');
const configPath = path.join(projectRoot, 'app-config.json');

// Argumente prüfen (mehrere IPs möglich)
let backendUrls = process.argv.slice(2);
if (backendUrls.length === 1 && backendUrls[0].includes(',')) {
    backendUrls = backendUrls[0].split(',');
}

if (backendUrls.length === 0) {
    console.error('Bitte gib mindestens eine Backend-URL an.');
    process.exit(1);
}

// URLs sicherstellen (http:// hinzufügen falls fehlt)
backendUrls = backendUrls.map(url => url.startsWith('http') ? url : `http://${url}:3334`);

console.log(`Bereite Client-Installer vor mit Failover-URLs: ${backendUrls.join(', ')}`);

// 1. Original Config sichern
let originalConfig = '';
if (fs.existsSync(configPath)) {
    originalConfig = fs.readFileSync(configPath, 'utf8');
}

try {
    // 2. Client-Config schreiben
    const clientConfig = {
        backendUrls: backendUrls,
        mode: 'client'
    };
    fs.writeFileSync(configPath, JSON.stringify(clientConfig, null, 2));
    console.log('Client-Config vorübergehend geschrieben.');

    // 3. Build ausführen
    console.log('Starte electron-builder Build...');
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    console.log('Build erfolgreich abgeschlossen.');

} catch (err) {
    console.error('Fehler beim Build:', err);
} finally {
    // 4. Original Config wiederherstellen
    if (originalConfig) {
        fs.writeFileSync(configPath, originalConfig);
        console.log('Original-Config wiederhergestellt.');
    }
}
