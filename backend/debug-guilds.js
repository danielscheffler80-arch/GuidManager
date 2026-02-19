const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.findMany({
            include: {
                guildMemberships: true,
                characters: true
            }
        });
        console.log('Users found:', users.length);
        for (const u of users) {
            console.log(`User ${u.id} (${u.battletag}):`);
            console.log(` - Memberships: ${u.guildMemberships.length}`);
            u.guildMemberships.forEach(m => console.log(`   - Guild IDs: ${m.guildId}, Rank: ${m.rank}`));
            console.log(` - Characters: ${u.characters.length}`);
        }

        const guilds = await prisma.guild.findMany();
        console.log('Total Guilds:', guilds.length);
        guilds.forEach(g => console.log(` - Guild ${g.id}: ${g.name} (${g.realm})`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
