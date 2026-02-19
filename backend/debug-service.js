const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MythicPlusService } = require('./src/services/mythicPlusService');

async function main() {
    const guildId = 12;
    console.log(`Debugging MythicPlusService for Guild ${guildId}...`);

    try {
        // Direct DB Check
        const charsInGuild = await prisma.character.findMany({
            where: { guildId, isActive: true },
            include: { mythicKeys: true }
        });
        console.log(`Direct Query: Found ${charsInGuild.length} active characters in guild.`);
        charsInGuild.forEach(c => {
            console.log(`- ${c.name} (isMain: ${c.isMain}, Keys: ${c.mythicKeys.length})`);
        });

        // Service Check
        const result = await MythicPlusService.getGuildKeysGrouped(guildId);
        console.log('Service Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
