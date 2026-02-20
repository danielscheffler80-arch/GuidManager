const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
    try {
        const res = await prisma.$executeRawUnsafe('UPDATE characters SET "isMain" = false;');
        console.log(`Successfully reset isMain.`);
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

reset();
