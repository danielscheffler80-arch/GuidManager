import * as shell from 'shelljs';
import * as semver from 'semver';
import * as path from 'path';
import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const isPkg = (process as any).pkg !== undefined;
const ROOT = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '../../../../');
const PROJECTS = [
    path.join(ROOT, 'backend/package.json'),
    path.join(ROOT, 'frontend/package.json'),
    path.join(ROOT, 'desktop/package.json'),
];

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('type', {
            alias: 't',
            type: 'string',
            description: 'Release type (patch, minor, major)',
            default: 'patch',
        })
        .option('dry-run', {
            type: 'boolean',
            description: 'Run without making changes',
            default: false,
        })
        .help()
        .argv;

    const releaseType = argv.type as semver.ReleaseType;

    console.log('--- Guild Manager Release Automation ---');
    console.log(`Root directory: ${ROOT}`);

    // 1. Get current version
    const desktopPkg = JSON.parse(fs.readFileSync(PROJECTS[2], 'utf8'));
    const currentVersion = desktopPkg.version;
    const nextVersion = semver.inc(currentVersion, releaseType);

    if (!nextVersion) {
        console.error('Invalid version increment');
        process.exit(1);
    }

    console.log(`Bumping version: ${currentVersion} -> ${nextVersion}`);

    if (argv['dry-run']) {
        console.log('[DRY RUN] Skipping file updates, builds, and git commands.');
        return;
    }

    // 2. Update all package.json files
    for (const pkgPath of PROJECTS) {
        const projectDir = path.dirname(pkgPath);
        if (!fs.existsSync(path.join(projectDir, 'node_modules'))) {
            console.error(`\n[ERROR] node_modules missing in ${projectDir}`);
            console.error(`Please run "npm install" in that directory first.`);
            process.exit(1);
        }

        console.log(`Updating ${pkgPath}...`);
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = nextVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    // 3. Build Frontend
    console.log('\n[1/4] Building Frontend...');
    shell.cd(path.join(ROOT, 'frontend'));
    if (shell.exec('npm run build').code !== 0) {
        console.error('Frontend build failed');
        process.exit(1);
    }

    // 4. Build Desktop
    console.log('\n[2/4] Building Desktop...');
    shell.cd(path.join(ROOT, 'desktop'));
    if (shell.exec('npm run build').code !== 0) {
        console.error('Desktop build failed');
        process.exit(1);
    }

    // 5. Cleanup and Copy Artifacts
    console.log('\n[3/4] Deploying artifacts to backend...');
    shell.cd(path.join(ROOT, 'backend'));
    shell.exec('npm run updates:clean');

    const buildOut = path.join(ROOT, 'desktop/dist-standalone/nsis-web');
    const updatesDir = path.join(ROOT, 'backend/updates/');

    shell.cp(path.join(buildOut, 'latest.yml'), updatesDir);
    shell.cp(path.join(buildOut, 'GuildManagerSetup.exe'), updatesDir);
    shell.cp(path.join(buildOut, '*.7z'), updatesDir);

    // 6. Git Operation
    console.log('\n[4/4] Committing to GitHub...');
    shell.cd(ROOT);
    shell.exec('git add .');
    shell.exec(`git commit -m "[RELEASE] Version ${nextVersion}"`);
    shell.exec('git push origin main');

    console.log('\n--- RELEASE COMPLETED SUCCESSFULLY ---');
    console.log(`New version ${nextVersion} is now live on GitHub and Railway.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
