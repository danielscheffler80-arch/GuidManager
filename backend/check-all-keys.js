const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- ALL MYTHIC KEYS ---');
        const keys = await prisma.mythicKey.findMany({
            include: { character: true }
        });
        console.log(JSON.stringify(keys.map(k => ({
            id: k.id,
            charName: k.character.name,
            charRealm: k.character.realm,
            charId: k.characterId,
            dungeon: k.dungeon,
            level: k.level,
            isFromBag: k.isFromBag
        })), null, 2));

        console.log('\n--- SYNCED CHARS CHECK ---');
        // Check for xava and xâvor specifically
        const chars = await prisma.character.findMany({
            where: {
                OR: [
                    { name: { equals: 'xava', mode: 'insensitive' } },
                    { name: { equals: 'xâvor', mode: 'insensitive' } }
                ]
            }
        });
        console.log(JSON.stringify(chars, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
