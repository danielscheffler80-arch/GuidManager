const dotenv = require('dotenv');
dotenv.config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const bloodrage = await prisma.guild.findFirst({
            where: { name: { contains: 'Bloodrage', mode: 'insensitive' } }
        });

        if (!bloodrage) {
            console.log('Bloodrage guild not found.');
        } else {
            console.log(`Bloodrage Guild ID: ${bloodrage.id}`);
        }

        const xalliara = await prisma.character.findFirst({
            where: { name: 'xalliara' },
            select: {
                id: true,
                name: true,
                guildId: true,
                allowedGuildIds: true,
                isMain: true,
                isFavorite: true,
                userId: true
            }
        });

        if (xalliara) {
            console.log('Xalliara Status:', JSON.stringify(xalliara, null, 2));
            if (bloodrage && xalliara.allowedGuildIds.includes(bloodrage.id)) {
                console.log('MATCH: Bloodrage IS in Xalliara\'s allowedGuildIds.');
            } else {
                console.log('NO MATCH: Bloodrage is NOT in Xalliara\'s allowedGuildIds.');
            }
        } else {
            console.log('Xalliara not found.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
