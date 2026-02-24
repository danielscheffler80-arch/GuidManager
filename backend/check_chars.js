const dotenv = require('dotenv');
dotenv.config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('--- Checking characters ---');
        const chars = await prisma.character.findMany({
            where: {
                OR: [
                    { name: { contains: 'xalliara', mode: 'insensitive' } },
                    { name: { contains: 'virridra', mode: 'insensitive' } }
                ]
            },
            select: {
                name: true,
                realm: true,
                guildId: true,
                allowedGuildIds: true,
                isMain: true,
                isFavorite: true
            }
        });
        console.log(JSON.stringify(chars, null, 2));

        const guilds = await prisma.guild.findMany({
            select: { id: true, name: true }
        });
        console.log('\n--- Guilds reference ---');
        console.log(JSON.stringify(guilds, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
