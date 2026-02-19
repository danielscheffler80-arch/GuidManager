const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- GUILDS ---');
        const guilds = await prisma.guild.findMany({ select: { id: true, name: true, realm: true } });
        console.log(JSON.stringify(guilds, null, 2));

        console.log('\n--- TARGET CHARACTER (xava) ---');
        const xavas = await prisma.character.findMany({
            where: { name: { equals: 'xava', mode: 'insensitive' } },
            select: { id: true, name: true, realm: true, guildId: true, isMain: true, userId: true }
        });
        console.log(JSON.stringify(xavas, null, 2));

        if (xavas.length > 0) {
            const charId = xavas[0].id;
            console.log(`\n--- KEYS FOR CHARACTER ${charId} ---`);
            const keys = await prisma.mythicKey.findMany({
                where: { characterId: charId }
            });
            console.log(JSON.stringify(keys, null, 2));
        }

    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
