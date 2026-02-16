
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
    const result = await prisma.guild.updateMany({
        data: { visibleRanks: [5, 7] }
    });
    console.log(`Updated ${result.count} guilds to visibleRanks [5, 7]`);
    await prisma.$disconnect();
}

update();
