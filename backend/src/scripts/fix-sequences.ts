import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSequences() {
    console.log('--- Starting Sequence Fix ---');

    const tables = ['users', 'characters', 'guilds', 'user_guilds', 'mythic_keys', 'mythic_key_signups'];

    for (const table of tables) {
        try {
            console.log(`Fixing sequence for ${table}...`);
            // Get the current max ID
            const result = await prisma.$queryRawUnsafe(`SELECT MAX(id) FROM ${table}`);
            const maxId = (result as any)[0].max || 0;

            // Update the sequence to the current MAX(id) + 1
            // Note: We use pg_get_serial_sequence to get the correct sequence name
            await prisma.$executeRawUnsafe(`
        SELECT setval(pg_get_serial_sequence('${table}', 'id'), ${maxId}, true);
      `);

            console.log(`Success: ${table} sequence reset to ${maxId}`);
        } catch (error: any) {
            console.error(`Error fixing sequence for ${table}:`, error.message);
        }
    }

    console.log('--- Sequence Fix Completed ---');
}

fixSequences()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
