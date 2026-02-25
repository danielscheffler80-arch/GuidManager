import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const updatesDir = path.join(__dirname, '../updates');
const latestYmlPath = path.join(updatesDir, 'latest.yml');

function cleanLegacyUpdates() {
    console.log('[CLEANUP] Starting cleanup of legacy updates...');

    if (!fs.existsSync(latestYmlPath)) {
        console.error('[CLEANUP] Error: latest.yml not found. Aborting.');
        return;
    }

    try {
        const fileContents = fs.readFileSync(latestYmlPath, 'utf8');
        const data = yaml.load(fileContents) as any;
        const currentVersion = data.version;

        console.log(`[CLEANUP] Current stable version: ${currentVersion}`);

        const files = fs.readdirSync(updatesDir);
        let removedCount = 0;

        files.forEach(file => {
            // Don't delete latest.yml or the Universal Setup
            if (file === 'latest.yml' || file === 'GuildManagerUniversalSetup.exe' || file === 'GuildManagerSetup.exe') {
                return;
            }

            // Keep only .7z files that match the current version
            if (file.endsWith('.7z') && !file.includes(currentVersion)) {
                const filePath = path.join(updatesDir, file);
                fs.unlinkSync(filePath);
                console.log(`[CLEANUP] Removed: ${file}`);
                removedCount++;
            }

            // Also remove any other old setup exes if they are present under different names (unlikely but safe)
            if (file.endsWith('.exe') && file !== 'GuildManagerSetup.exe' && file !== 'GuildManagerUniversalSetup.exe') {
                const filePath = path.join(updatesDir, file);
                fs.unlinkSync(filePath);
                console.log(`[CLEANUP] Removed old exe: ${file}`);
                removedCount++;
            }
        });

        console.log(`[CLEANUP] Finished. Removed ${removedCount} legacy files.`);
    } catch (err: any) {
        console.error(`[CLEANUP] Error: ${err.message}`);
    }
}

cleanLegacyUpdates();
