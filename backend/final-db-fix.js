const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- UPDATING CHARACTERS FOR GUILD 12 ---');

        // Link xava and xâvor to Guild 12
        const updated = await prisma.character.updateMany({
            where: {
                id: { in: [7, 23] }
            },
            data: {
                guildId: 12,
                isActive: true
            }
        });
        console.log(`Updated ${updated.count} characters.`);

        // Ensure xalliara is set as Main (if not already)
        await prisma.character.update({
            where: { id: 14 },
            data: { isMain: true }
        });
        console.log('Ensured xalliara (ID 14) is Main.');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
