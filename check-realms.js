const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function checkRealms() {
    const BNET_CLIENT_ID = process.env.BNET_CLIENT_ID;
    const BNET_CLIENT_SECRET = process.env.BNET_CLIENT_SECRET;
    const BNET_REGION = process.env.BNET_REGION || 'eu';

    console.log(`Region: ${BNET_REGION}`);

    try {
        const authResponse = await axios.post(`https://${BNET_REGION}.battle.net/oauth/token`,
            'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${BNET_CLIENT_ID}:${BNET_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const token = authResponse.data.access_token;
        const realmResponse = await axios.get(`https://${BNET_REGION}.api.blizzard.com/data/wow/realm/index`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                namespace: `dynamic-${BNET_REGION}`,
                locale: 'de_DE'
            }
        });

        const realms = realmResponse.data.realms;
        console.log(`Total Realms found: ${realms.length}`);
        console.log('Sample Realms:', realms.slice(0, 5).map(r => ({
            name: r.name,
            slug: r.slug
        })));

        const silbe = realms.find(r => r.slug.includes('silberne'));
        console.log('Searching for "Silberne":', silbe);

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

checkRealms();
