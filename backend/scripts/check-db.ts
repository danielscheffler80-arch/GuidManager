
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.findMany({
            include: {
                guildMemberships: {
                    include: { guild: true }
                }
            }
        });

        console.log('--- USERS AND MEMBERSHIPS ---');
        users.forEach(u => {
            console.log(`User: ${u.name} (ID: ${u.id}, Bnet: ${u.battleNetId})`);
            console.log(`  Memberships: ${u.guildMemberships.length}`);
            u.guildMemberships.forEach(m => {
                console.log(`    - Guild: ${m.guild.name} (ID: ${m.guildId}, Rank: ${m.rank})`);
            });
        });

        const allGuilds = await prisma.guild.findMany();
        console.log('\n--- ALL GUILDS ---');
        allGuilds.forEach(g => {
            console.log(`Guild: ${g.name} (ID: ${g.id})`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
