const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const yaml = require('js-yaml');
const cliProgress = require('cli-progress');
const chalk = require('chalk');

const UPDATES_URL = 'https://guidmanager-production.up.railway.app/updates/latest.yml';
const BASE_URL = 'https://guidmanager-production.up.railway.app/updates/';

async function downloadFile(url, targetPath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
    });

    const totalLength = response.headers['content-length'];
    const progressBar = new cliProgress.SingleBar({
        format: 'Downloading |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} Chunks',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(parseInt(totalLength), 0);
    const writer = fs.createWriteStream(targetPath);

    response.data.on('data', (chunk) => {
        progressBar.increment(chunk.length);
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            progressBar.stop();
            resolve();
        });
        writer.on('error', reject);
    });
}

async function main() {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('   Xava Guild Manager Installer        '));
    console.log(chalk.cyan('========================================\n'));

    try {
        console.log(chalk.yellow('Checking for latest version...'));
        const response = await axios.get(UPDATES_URL);
        const data = yaml.load(response.data);

        const fileName = data.path;
        if (!fileName) {
            throw new Error('Could not find latest version path in latest.yml');
        }

        const downloadUrl = BASE_URL + fileName;
        const tempDir = path.join(process.env.TEMP, 'GuildManagerInstaller');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const targetPath = path.join(tempDir, fileName);

        console.log(chalk.green(`Found version: ${data.version}`));
        console.log(chalk.white(`Downloading: ${fileName}...`));

        await downloadFile(downloadUrl, targetPath);

        console.log(chalk.green('\nDownload complete! Starting installation...'));

        // Launch the installer
        const child = spawn(targetPath, [], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        console.log(chalk.cyan('\nThe setup has been launched. You can now close this window.'));
        console.log(chalk.cyan('Thank you for using Guild Manager!'));

        // Wait a bit before exiting
        setTimeout(() => process.exit(0), 3000);

    } catch (error) {
        console.error(chalk.red('\nFAILED:'), error.message);
        console.log(chalk.white('\nPlease check your internet connection and try again.'));
        process.exit(1);
    }
}

main();
