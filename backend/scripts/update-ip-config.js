const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const BACKEND_ENV_PATH = path.join(__dirname, '../.env');
const FRONTEND_CONFIG_PATH = path.join(__dirname, '../../../XavaGuildManager/app-config.json');
const PORT = 3334;

async function getPublicIP() {
    return new Promise((resolve, reject) => {
        https.get('https://api.ipify.org', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', reject);
    });
}

async function updateConfigs() {
    try {
        console.log('Detecting public IP...');
        const ip = await getPublicIP();
        console.log(`Public IP detected: ${ip}`);

        // Update Backend .env
        if (fs.existsSync(BACKEND_ENV_PATH)) {
            let envContent = fs.readFileSync(BACKEND_ENV_PATH, 'utf8');
            const newRedirectUri = `BNET_REDIRECT_URI="http://${ip}:${PORT}/auth/callback"`;

            if (envContent.includes('BNET_REDIRECT_URI=')) {
                envContent = envContent.replace(/BNET_REDIRECT_URI=.*/, newRedirectUri);
            } else {
                envContent += `\n${newRedirectUri}\n`;
            }

            fs.writeFileSync(BACKEND_ENV_PATH, envContent);
            console.log('Updated Backend .env');
        }

        // Update Frontend app-config.json
        if (fs.existsSync(FRONTEND_CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(FRONTEND_CONFIG_PATH, 'utf8'));
            const publicUrl = `http://${ip}:${PORT}`;

            if (!config.backendUrls) config.backendUrls = [];

            // Reconstruct backendUrls to have localhost first, then public IP, then cloud
            config.backendUrls = [
                "http://localhost:3334",
                publicUrl,
                "https://guild-manager-backend.onrender.com"
            ];
            config.backendUrl = publicUrl;

            fs.writeFileSync(FRONTEND_CONFIG_PATH, JSON.stringify(config, null, 2));
            console.log('Updated Frontend app-config.json');
        }

        console.log('\nSuccess! Configs updated to current IP.');
        console.log('Note: Ensure port 3334 is forwarded in your router to this machine (192.168.178.50).');

    } catch (error) {
        console.error('Error updating configs:', error);
    }
}

updateConfigs();
