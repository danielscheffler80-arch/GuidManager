const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- SPECIFIC CHAR SEARCH ---');
        // Search by ID 7 and 23
        const charsById = await prisma.character.findMany({
            where: { id: { in: [7, 23] } }
        });
        console.log('Chars by ID:', JSON.stringify(charsById, null, 2));

        // Search for exact names from log
        const charsByName = await prisma.character.findMany({
            where: {
                OR: [
                    { name: 'xava' },
                    { name: 'xâvor' },
                    { name: 'xÃ¢vor' }
                ]
            }
        });
        console.log('Chars by Name Match:', JSON.stringify(charsByName.map(c => ({
            id: c.id,
            name: c.name,
            nameHex: Buffer.from(c.name).toString('hex'),
            realm: c.realm,
            guildId: c.guildId
        })), null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
