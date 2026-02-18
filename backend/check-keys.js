const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fetching recent Mythic+ keys...');
    try {
        const keys = await prisma.mythicKey.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                character: true
            }
        });
        console.log('Recent Keys:', JSON.stringify(keys, null, 2));

        const mainsCount = await prisma.character.count({ where: { isMain: true, guildId: 12 } });
        console.log(`Main characters in guild 12: ${mainsCount}`);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
