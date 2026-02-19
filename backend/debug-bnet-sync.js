
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function debug() {
    console.log('--- Debugging BNet Sync ---');

    // 1. Get a user with a token
    const user = await prisma.user.findFirst({
        where: { accessToken: { not: null } }
    });

    if (!user || !user.accessToken) {
        console.error('No user with access token found in DB.');
        return;
    }

    console.log(`Using token from user: ${user.battletag}`);

    // 2. Fetch Guild Roster from BNet
    // Guild: Okay, Realm: Eredar (slug: eredar), Region: eu
    const realmSlug = 'eredar';
    const guildNameSlug = 'okay';
    const region = 'eu';
    const namespace = `profile-${region}`;
    const locale = 'de_DE';

    const url = `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildNameSlug}/roster?namespace=${namespace}&locale=${locale}`;

    try {
        console.log(`Fetching: ${url}`);
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${user.accessToken}` }
        });

        const members = response.data.members;
        console.log(`API returned ${members.length} members.`);

        // 3. Search for Xalliara
        const targetName = 'Xalliara';
        const found = members.find(m => m.character.name.toLowerCase() === targetName.toLowerCase());

        if (found) {
            console.log(`\nFOUND '${targetName}' in BNet API response!`);
            console.log(`- Rank: ${found.rank}`);
            console.log(`- Name: ${found.character.name}`);
            console.log(`- Realm: ${found.character.realm.slug}`);
            console.log(`- Level: ${found.character.level}`);
            // console.log(JSON.stringify(found, null, 2));
        } else {
            console.log(`\n'${targetName}' NOT found in BNet API response.`);
            // List names starting with X just in case
            const xNames = members.filter(m => m.character.name.toLowerCase().startsWith('x'));
            console.log('Names starting with X:', xNames.map(m => m.character.name).join(', '));
        }

    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.statusText);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

debug()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
