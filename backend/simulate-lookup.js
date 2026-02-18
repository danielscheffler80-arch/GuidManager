const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const targetName = "xava";
    const targetRealm = "blackrock";

    console.log(`Simulating lookup for [${targetName}] on [${targetRealm}]...`);

    try {
        const character = await prisma.character.findUnique({
            where: { name_realm: { name: targetName, realm: targetRealm } }
        });

        if (character) {
            console.log('SUCCESS: Character found!');
            console.log(JSON.stringify(character, null, 2));
        } else {
            console.log('FAILURE: Character not found via findUnique.');

            // Fallback search to see what is actually there
            const allXavas = await prisma.character.findMany({
                where: { name: { contains: 'xava', mode: 'insensitive' } }
            });
            console.log('All Xavas in DB:', JSON.stringify(allXavas.map(c => ({
                name: c.name,
                realm: c.realm,
                nameLen: c.name.length,
                realmLen: c.realm.length
            })), null, 2));
        }

    } catch (err) {
        console.error('Simulation failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
