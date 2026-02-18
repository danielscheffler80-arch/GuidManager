const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const charId = 23;
    console.log(`Attempting to insert test key for character ${charId}...`);

    try {
        // 1. Delete existing bag keys for this char
        await prisma.mythicKey.deleteMany({
            where: { characterId: charId, isFromBag: true }
        });

        // 2. Insert new key
        const newKey = await prisma.mythicKey.create({
            data: {
                characterId: charId,
                dungeon: "Testdungeon",
                level: 16,
                affixes: "[]",
                isFromBag: true,
                completed: false
            }
        });

        console.log('SUCCESS: Key inserted!', JSON.stringify(newKey, null, 2));

        // 3. Check table again
        const count = await prisma.mythicKey.count();
        console.log(`Total keys in table now: ${count}`);

        // 4. FIX: Assign character to Guild 12 so it shows up
        console.log('Assigning character to Guild 12...');
        await prisma.character.update({
            where: { id: charId },
            data: { guildId: 12 }
        });
        console.log('Character 23 now in Guild 12.');

    } catch (err) {
        console.error('Insertion/Update failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
