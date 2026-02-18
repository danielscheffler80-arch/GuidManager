const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking exact casing for xava...');
    try {
        const chars = await prisma.character.findMany({
            where: { name: { contains: 'xava', mode: 'insensitive' } }
        });
        console.log('Results:', JSON.stringify(chars.map(c => ({
            id: c.id,
            name: c.name,
            realm: c.realm
        })), null, 2));

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
