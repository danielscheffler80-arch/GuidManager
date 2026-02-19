const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Prisma Properties:', Object.keys(prisma).filter(k => !k.startsWith('_')));
    await prisma.$disconnect();
}

main();
