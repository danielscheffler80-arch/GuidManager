import prisma from '../prisma';

export class SchemaService {
    static async ensureSchema() {
        console.log('[SCHEMA] Checking database schema consistency...');

        try {
            // Columns to ensure in the 'guilds' table
            const columns = [
                { column: 'exclusiveRaidName', type: 'TEXT' },
                { column: 'manualRaidProgress', type: 'TEXT' },
                { column: 'mainRosterIncludedCharacterIds', type: 'INTEGER[] DEFAULT ARRAY[]::INTEGER[]' },
                { column: 'mainRosterExcludedCharacterIds', type: 'INTEGER[] DEFAULT ARRAY[]::INTEGER[]' }
            ];

            for (const col of columns) {
                try {
                    // Check if column exists first (optional but cleaner for logs)
                    const columnCheck = await prisma.$queryRawUnsafe(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'guilds' AND column_name = '${col.column}'
          `);

                    if ((columnCheck as any[]).length === 0) {
                        console.log(`[SCHEMA] Column "${col.column}" missing in "guilds". Adding...`);
                        await prisma.$executeRawUnsafe(`ALTER TABLE "guilds" ADD COLUMN "${col.column}" ${col.type}`);
                    }
                } catch (colErr: any) {
                    console.error(`[SCHEMA] Error ensuring column ${col.column}: ${colErr.message}`);
                }
            }

            console.log('[SCHEMA] Schema check completed.');
        } catch (err: any) {
            console.error(`[SCHEMA] Critical error during schema check: ${err.message}`);
        }
    }
}
