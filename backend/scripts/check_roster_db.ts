
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRoster() {
    try {
        const guildCount = await prisma.guild.count();
        console.log(`Total Guilds: ${guildCount}`);

        const guilds = await prisma.guild.findMany({
            select: { id: true, name: true, realm: true }
        });

        for (const guild of guilds) {
            const charCount = await prisma.character.count({
                where: { guildId: guild.id }
            });

            const rankDistribution = await prisma.character.groupBy({
                by: ['rank'],
                where: { guildId: guild.id },
                _count: { _all: true },
                orderBy: { rank: 'asc' }
            });

            console.log(`\nGuild: ${guild.name} (${guild.realm}) [ID: ${guild.id}]`);
            console.log(`Total Characters in DB: ${charCount}`);
            console.log(`Rank Distribution:`);
            rankDistribution.forEach(rd => {
                console.log(`  Rank ${rd.rank}: ${rd._count._all}`);
            });
        }

    } catch (error) {
        console.error('Error checking roster:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRoster();
