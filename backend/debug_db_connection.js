const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.byxdneprmynjwbxsrnop:b4PZevKB7NpjHn@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true"
        }
    }
});

async function main() {
    console.log('Versuche Verbindung zur Datenbank...');
    try {
        const count = await prisma.user.count();
        console.log('Verbindung erfolgreich! Anzahl User:', count);
    } catch (e) {
        console.error('Verbindungsfehler:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
