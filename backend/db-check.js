const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking character table columns...');
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'characters'
    `;
        console.log('Columns in characters:', columns.map(c => c.column_name).join(', '));

        const sample = await prisma.character.findFirst({
            where: { guildId: 12 }
        });
        console.log('Sample character:', JSON.stringify(sample, null, 2));

    } catch (err) {
        console.error('Database diagnostic failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
