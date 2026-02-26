import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const updatesDir = path.join(__dirname, '../../updates');
const latestYmlPath = path.join(updatesDir, 'latest.yml');

function cleanLegacyUpdates() {
    console.log('[CLEANUP] Starting cleanup of legacy updates...');

    if (!fs.existsSync(latestYmlPath)) {
        console.error('[CLEANUP] Error: latest.yml not found. Aborting.');
        return;
    }

    try {
        const files = fs.readdirSync(updatesDir);

        // 1. Identify all versioned files (7z updates and EXEs)
        const versionFiles = files
            .filter(f => (f.endsWith('.7z') && f.includes('standalone-')) ||
                (f.endsWith('.exe') && (f.includes('Setup_') || f.includes('UniversalSetup_'))))
            .map(f => {
                const match = f.match(/standalone-(.*?)-x64/) || f.match(/Setup_(.*?)\.exe/);
                return {
                    name: f,
                    version: match ? match[1] : '0.0.0'
                };
            });

        // 2. Sort by version (simple semver-like sorting)
        versionFiles.sort((a, b) => {
            const partsA = a.version.split('.').map(Number);
            const partsB = b.version.split('.').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const valA = partsA[i] || 0;
                const valB = partsB[i] || 0;
                if (valA !== valB) return valB - valA; // Descending
            }
            return 0;
        });

        const versionsToKeep = versionFiles.slice(0, 2).map(v => v.name);
        console.log(`[CLEANUP] Keeping versions: ${versionFiles.slice(0, 2).map(v => v.version).join(', ')}`);

        let removedCount = 0;

        files.forEach(file => {
            // ALWAYS keep these
            if (file === 'latest.yml' || file === 'GuildManagerUniversalSetup.exe' || file === 'GuildManagerSetup.exe' || file === 'GuildManagerUniversalSetup.exe.blockmap') {
                return;
            }

            // Keep only the top 2 versions for both .7z and versioned .exe
            if (file.endsWith('.7z') || (file.endsWith('.exe') && (file.includes('Setup_') || file.includes('UniversalSetup_')))) {
                if (!versionsToKeep.includes(file)) {
                    const filePath = path.join(updatesDir, file);
                    fs.unlinkSync(filePath);
                    console.log(`[CLEANUP] Removed old versioned file: ${file}`);
                    removedCount++;
                }
                return;
            }

            // Remove any other stray exe files
            if (file.endsWith('.exe') && !file.includes('Setup')) {
                const filePath = path.join(updatesDir, file);
                fs.unlinkSync(filePath);
                console.log(`[CLEANUP] Removed stray exe: ${file}`);
                removedCount++;
            }
        });

        console.log(`[CLEANUP] Finished. Removed ${removedCount} legacy files.`);
    } catch (err: any) {
        console.error(`[CLEANUP] Error: ${err.message}`);
    }
}

cleanLegacyUpdates();
