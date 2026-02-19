
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// We need to import the service. Since we are in JS script, we can't import TS directly unless we use ts-node or similar.
// But we are running with node.
// So we can't easily import `src/services/rosterService.ts`.
// We have to fallback to using the internal API or re-implementing the sync logic simplified.
// Or we can rely on `debug-bnet-sync` approach but actually WRITE to DB.

// Let's use the manual loop from debug-bnet-sync but actually perform the upserts for ALL members.
// This is safer than trying to mock the TS environment.

const axios = require('axios');

async function sync() {
    console.log('--- Triggering Full Roster Sync (Manual Script) ---');

    // 1. Get Token
    const user = await prisma.user.findFirst({ where: { accessToken: { not: null } } });
    if (!user || !user.accessToken) { console.error('No token.'); return; }

    // 2. Fetch Guild Roster
    const realmSlug = 'eredar';
    const guildNameSlug = 'okay';
    const region = 'eu';
    const url = `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${guildNameSlug}/roster?namespace=profile-${region}&locale=de_DE`;

    try {
        console.log(`Fetching Roster from BNet...`);
        const response = await axios.get(url, { headers: { Authorization: `Bearer ${user.accessToken}` } });
        const members = response.data.members; // Array
        console.log(`Fetched ${members.length} members.`);

        const guildId = 21; // Okay

        let updated = 0;
        let errors = 0;

        // 3. Upsert Loop
        for (const member of members) {
            const charData = member.character;
            const rank = member.rank;

            try {
                await prisma.character.upsert({
                    where: {
                        name_realm: {
                            name: charData.name.toLowerCase(),
                            realm: charData.realm.slug,
                        }
                    },
                    update: {
                        guildId: guildId, // FORCE update guildId
                        level: charData.level,
                        rank: rank,
                        class: charData.playable_class?.name?.de_DE || 'Unknown',
                        classId: charData.playable_class?.id || null,
                        race: charData.playable_race?.name?.de_DE || 'Unknown',
                        lastSync: new Date()
                    },
                    create: {
                        name: charData.name.toLowerCase(),
                        realm: charData.realm.slug,
                        guildId: guildId,
                        level: charData.level,
                        rank: rank,
                        class: charData.playable_class?.name?.de_DE || 'Unknown',
                        classId: charData.playable_class?.id || null,
                        race: charData.playable_race?.name?.de_DE || 'Unknown',
                        faction: 'Horde', // hardcoded for speed
                        battleNetId: charData.id.toString(),
                        isActive: true,
                        lastSync: new Date()
                    }
                });
                updated++;
                if (updated % 50 === 0) process.stdout.write('.');
            } catch (e) {
                // console.error(`Error for ${charData.name}:`, e.message);
                errors++;
            }
        }
        console.log(`\nSync Complete. Updated: ${updated}, Errors: ${errors}`);

    } catch (error) {
        console.error('Fatal Error:', error.message);
    }
}

sync()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
