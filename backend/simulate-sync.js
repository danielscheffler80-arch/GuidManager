const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateSync() {
    const keys = [
        { name: 'xava', realm: 'blackrock', level: 16, dungeon: 'Testdungeon-New', isFromBag: true },
        { name: 'xâvor', realm: 'blackrock', level: 12, dungeon: 'Grim Batol', isFromBag: true }
    ];

    console.log(`[SIM] Starting simulation for ${keys.length} keys...`);

    for (const key of keys) {
        const lowerName = key.name.toLowerCase();
        const lowerRealm = key.realm.toLowerCase();

        console.log(`[SIM] Processing ${lowerName} on ${lowerRealm}...`);

        const character = await prisma.character.findUnique({
            where: { name_realm: { name: lowerName, realm: lowerRealm } }
        });

        if (character) {
            console.log(`[SIM] MATCH: Found character ID ${character.id}`);

            try {
                // Delete
                const del = await prisma.mythicKey.deleteMany({
                    where: { characterId: character.id, isFromBag: true }
                });
                console.log(`[SIM] Deleted ${del.count} old keys.`);

                // Create
                const created = await prisma.mythicKey.create({
                    data: {
                        characterId: character.id,
                        dungeon: key.dungeon,
                        level: key.level,
                        affixes: '[]',
                        isFromBag: true,
                        completed: false
                    }
                });
                console.log(`[SIM] SUCCESS: Created key ID ${created.id}`);
            } catch (err) {
                console.error(`[SIM] DB Error for ${character.name}:`, err.message);
            }
        } else {
            console.log(`[SIM] SKIP: Character not found.`);
        }
    }
}

async function main() {
    try {
        await simulateSync();
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
