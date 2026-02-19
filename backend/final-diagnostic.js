const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const g1Count = await prisma.character.count({ where: { guildId: 1 } });
        const g5Count = await prisma.character.count({ where: { guildId: 5 } });
        const g12Count = await prisma.character.count({ where: { guildId: 12 } });

        console.log(`Guild 1 (High Council) count: ${g1Count}`);
        console.log(`Guild 5 (mir alles egal) count: ${g5Count}`);
        console.log(`Guild 12 (Okay) count: ${g12Count}`);

        const g12Members = await prisma.character.findMany({
            where: { guildId: 12 },
            select: { name: true, realm: true },
            take: 5
        });
        console.log('Guild 12 Sample Members:', JSON.stringify(g12Members, null, 2));

        const g1Members = await prisma.character.findMany({
            where: { guildId: 1 },
            select: { name: true, realm: true },
            take: 5
        });
        console.log('Guild 1 Sample Members:', JSON.stringify(g1Members, null, 2));

    } catch (err) {
        console.error('Final diagnostic failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
