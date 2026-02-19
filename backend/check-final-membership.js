const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const userId = 1;
        const memberships = await prisma.userGuild.findMany({
            where: { userId: userId },
            select: { guildId: true, guild: { select: { name: true } } }
        });

        console.log(`User ${userId} Memberships:`, JSON.stringify(memberships, null, 2));

        const isMemberOf12 = memberships.some(m => m.guildId === 12);
        console.log(`Is User 1 in Guild 12? ${isMemberOf12}`);

        // Check if characters are active
        const myChars = await prisma.character.findMany({
            where: { userId: userId },
            select: { id: true, name: true, realm: true, guildId: true, isActive: true }
        });
        console.log(`User ${userId} Characters:`, JSON.stringify(myChars, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
