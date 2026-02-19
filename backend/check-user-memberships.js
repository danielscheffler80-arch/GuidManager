const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const userId = 1;
        console.log(`--- USER ${userId} MEMBERSHIPS ---`);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                guildMemberships: {
                    include: { guild: true }
                }
            }
        });
        console.log(JSON.stringify(user, null, 2));

        console.log(`\n--- CHARACTERS FOR USER ${userId} ---`);
        const chars = await prisma.character.findMany({
            where: { userId: userId },
            select: { id: true, name: true, realm: true, guildId: true, isMain: true }
        });
        console.log(JSON.stringify(chars, null, 2));

    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
