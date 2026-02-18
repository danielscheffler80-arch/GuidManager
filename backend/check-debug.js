const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const chars = await prisma.character.findMany({
            where: { name: { contains: 'xava', mode: 'insensitive' } }
        });
        console.log('Characters check:', JSON.stringify(chars.map(c => ({
            id: c.id,
            name: c.name,
            realm: c.realm,
            guildId: c.guildId
        })), null, 2));

        const keys = await prisma.mythicKey.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log('Total keys in DB:', keys.length);
        console.log('Recent Keys Raw:', JSON.stringify(keys, null, 2));

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
