const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getGuildKeysGrouped(guildId) {
    console.log(`[MOCK] Fetching for guild ${guildId}...`);

    // 1. Get user IDs from guild membership
    const memberships = await prisma.userGuild.findMany({
        where: { guildId },
        select: { userId: true }
    });
    const memberUserIds = memberships.map(m => m.userId).filter(id => id !== null);
    console.log(`Member User IDs: ${memberUserIds}`);

    // 2. Get characters
    const characters = await prisma.character.findMany({
        where: {
            OR: [
                { guildId: guildId },
                { userId: { in: memberUserIds } }
            ],
            isActive: true
        },
        include: {
            mythicKeys: true
        }
    });

    console.log(`Characters found: ${characters.length}`);
    const processedUserIds = new Set();
    const result = [];

    for (const char of characters) {
        if (!char.userId) {
            result.push({
                name: char.name,
                userId: null,
                isOrphan: true,
                keys: char.mythicKeys
            });
            continue;
        }
        if (processedUserIds.has(char.userId)) continue;

        const userChars = characters.filter(c => c.userId === char.userId);
        const mainChar = userChars.find(c => c.isMain) || userChars[0];

        const allKeys = [];
        userChars.forEach(c => {
            if (c.mythicKeys && c.mythicKeys.length > 0) {
                allKeys.push(...c.mythicKeys);
            }
        });

        result.push({
            userId: char.userId,
            name: mainChar.name,
            main: mainChar.name,
            altCount: userChars.length - 1,
            keys: mainChar.mythicKeys,
            hasAltKeys: allKeys.length > mainChar.mythicKeys.length,
            totalKeys: allKeys.length
        });
        processedUserIds.add(char.userId);
    }
    return result;
}

async function main() {
    try {
        const res = await getGuildKeysGrouped(12);
        console.log(`Total grouped entries: ${res.length}`);

        const user1 = res.find(r => r.userId === 1);
        console.log('User 1 entry:', JSON.stringify(user1, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
