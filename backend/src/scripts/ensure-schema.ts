import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureSchema() {
    console.log('[SCHEMA] Checking database schema consistency...');

    try {
        // 1. Array of columns to ensure
        const columns = [
            { table: 'guilds', column: 'exclusiveRaidName', type: 'TEXT' },
            { table: 'guilds', column: 'manualRaidProgress', type: 'TEXT' },
            { table: 'guilds', column: 'mainRosterIncludedCharacterIds', type: 'INTEGER[] DEFAULT ARRAY[]::INTEGER[]' },
            { table: 'guilds', column: 'mainRosterExcludedCharacterIds', type: 'INTEGER[] DEFAULT ARRAY[]::INTEGER[]' }
        ];

        for (const col of columns) {
            try {
                console.log(`[SCHEMA] Ensuring column "${col.column}" in table "${col.table}"...`);
                await prisma.$executeRawUnsafe(`ALTER TABLE "${col.table}" ADD COLUMN IF NOT EXISTS "${col.column}" ${col.type}`);
            } catch (colErr: any) {
                console.error(`[SCHEMA] Error ensuring column ${col.column}: ${colErr.message}`);
            }
        }

        console.log('[SCHEMA] Schema check completed.');
    } catch (err: any) {
        console.error(`[SCHEMA] Critical error during schema check: ${err.message}`);
    } finally {
        await prisma.$disconnect();
    }
}

ensureSchema().catch(err => {
    console.error('[SCHEMA] Fatal error:', err);
    process.exit(1);
});
