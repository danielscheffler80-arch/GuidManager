const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- ALL CHARACTERS STARTING WITH XA ---');
        const chars = await prisma.character.findMany({
            where: {
                name: { startsWith: 'xa', mode: 'insensitive' }
            },
            select: { id: true, name: true, realm: true, guildId: true }
        });

        chars.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.name}, Realm: ${c.realm}, Guild: ${c.guildId}, Name-Hex: ${Buffer.from(c.name).toString('hex')}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
