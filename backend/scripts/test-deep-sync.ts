import { BattleNetAPIService } from '../src/services/battleNetAPIService';
import prisma from '../src/prisma';

async function testDeepSync() {
    console.log("--- Starting Deep Sync Verification ---");

    try {
        // 1. Find a user with a token
        const user = await prisma.user.findFirst({
            where: { accessToken: { not: null } },
            include: { guildMemberships: { include: { guild: true } } }
        });

        if (!user || !user.accessToken) {
            console.error("No user with access token found in DB. Please log in first.");
            return;
        }

        console.log(`Using user: ${user.name}`);

        if (user.guildMemberships.length === 0) {
            console.error("User has no guilds. Cannot test deep sync.");
            return;
        }

        const guild = user.guildMemberships[0].guild;
        console.log(`Testing with guild: ${guild.name} (${guild.realm})`);

        // 2. Run syncGuildMembers with deepSync=true
        console.log("Starting deep sync for 1 member (for test purposes)...");
        const service = new BattleNetAPIService(user.accessToken);
        const roster = await service.getGuildRoster(guild.realm, guild.name);

        if (roster.length === 0) {
            console.error("Guild roster is empty.");
            return;
        }

        // We only sync the first 2 members to avoid hitting rate limits or taking too long
        const testMembers = roster.slice(0, 2);
        console.log(`Syncing ${testMembers.length} members...`);

        for (const member of testMembers) {
            const charName = member.character.name.toLowerCase();
            const charRealm = member.character.realm.slug;
            console.log(`- Syncing ${charName}@${charRealm}`);
            await service.syncSingleCharacterDetails(0, charRealm, charName);

            // Verify character data in DB
            const char = await prisma.character.findUnique({
                where: { name_realm: { name: charName, realm: charRealm } },
                include: { mythicKeys: true }
            });

            if (char) {
                console.log(`  [OK] Character found: ilvl=${char.averageItemLevel}, RIO=${char.mythicRating}, Progress=${char.raidProgress}`);
                console.log(`  [OK] Keys found: ${char.mythicKeys.length}`);
                const weeklyKeys = char.mythicKeys.filter(k => k.level >= 10 && !k.isFromBag);
                console.log(`  [OK] Weekly Keys (10+): ${weeklyKeys.length}`);
            } else {
                console.error(`  [FAIL] Character ${charName} not found in DB after sync.`);
            }
        }

        console.log("--- Deep Sync Verification Completed ---");

    } catch (error) {
        console.error("Verification Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testDeepSync();
