const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- CLEARING OLD/TEST KEYS ---');
        const count = await prisma.mythicKey.deleteMany({
            where: {
                OR: [
                    { dungeon: 'Testdungeon' },
                    { dungeon: 'Testdungeon-New' },
                    { dungeon: 'Grim Batol' }
                ]
            }
        });
        console.log(`Deleted ${count.count} outdated keys.`);

        // Final sanity check for grouping
        console.log('\n--- TARGET CHARS IN DB ---');
        const chars = await prisma.character.findMany({
            where: { id: { in: [14, 7, 23] } },
            select: { id: true, name: true, guildId: true }
        });
        console.log(JSON.stringify(chars, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
