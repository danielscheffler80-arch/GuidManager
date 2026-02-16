import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkHealth() {
    console.log('--- Deployment Health Check ---');

    // 1. Check Database Connection
    try {
        await prisma.$connect();
        console.log('✅ Database connection: SUCCESS');

        // 2. Check basic query
        const userCount = await prisma.user.count();
        console.log(`✅ Database query: SUCCESS (Users in DB: ${userCount})`);
    } catch (error) {
        console.error('❌ Database connection: FAILED');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }

    // 3. Environment Variables Check
    const requiredEnv = [
        'BNET_CLIENT_ID',
        'BNET_CLIENT_SECRET',
        'BNET_REDIRECT_URI',
        'JWT_SECRET',
        'DATABASE_URL'
    ];

    console.log('\n--- Environment Variables Check ---');
    requiredEnv.forEach(env => {
        if (process.env[env]) {
            console.log(`✅ ${env}: SET`);
        } else {
            console.log(`❌ ${env}: MISSING`);
        }
    });
}

checkHealth().catch(console.error);
