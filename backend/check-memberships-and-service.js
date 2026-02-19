const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const userId = 1;
        console.log(`--- USER ${userId} MEMBERSHIPS ---`);
        const memberships = await prisma.userGuild.findMany({
            where: { userId: userId },
            include: { guild: true }
        });
        console.log(JSON.stringify(memberships.map(m => ({
            guildId: m.guildId,
            guildName: m.guild.name,
            rank: m.rank
        })), null, 2));

        console.log(`\n--- SERVICE TEST FOR GUILD 12 ---`);
        const { MythicPlusService } = require('./src/services/mythicPlusService');
        const results = await MythicPlusService.getGuildKeysGrouped(12);
        console.log(`Found ${results.length} grouped entries.`);
        const myEntry = results.find(r => r.userId === 1);
        if (myEntry) {
            console.log('User 1 found in result!');
            console.log('Keys:', myEntry.keys.length);
            console.log('Alt Keys:', myEntry.alts.reduce((sum, a) => sum + (a.keys ? a.keys.length : 0), 0));
            console.log('Alts Names:', myEntry.alts.map(a => a.name));
        } else {
            console.log('User 1 NOT found in result for Guild 12.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
