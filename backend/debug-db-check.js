
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function debug() {
    console.log('--- Debugging API Roster Response ---');

    const guildId = 21;
    const user = await prisma.user.findUnique({ where: { id: 1 } }); // Assuming userId 1 is the one

    if (!user || !user.accessToken) {
        console.log('User 1 not found or no token.');
        return;
    }

    // We need the APP token (JWT) usually for AuthMiddleware, 
    // but if we are running the backend in dev mode maybe we can bypass or use the same token?
    // Wait, AuthMiddleware verifies the `Authorization: Bearer <token>`.
    // Is it the BNet token or a JWT issued by the app?
    // backend/src/middleware/auth.ts checks `jwt.verify(token, process.env.JWT_SECRET)`.
    // So I need a valid JWT.

    // I can generate a JWT if I have the secret, usually standard 'secret' in dev.
    // Or I can just login? 
    // Let's assume I can't easily generate a JWT without the secret (which might be in .env but I don't want to parse it manually if I can avoid it).

    // Alternative: The `debug-roster-visibility.js` FAILED to find the char in DB even though `upsert` said it exists.
    // This is the most suspicious part.
    // If `findFirst` failed, maybe `findUnique` in `GET /roster` also fails?
    // Why would `findFirst` fail?
    // Maybe `guildId` is NOT 21?
    // The upsert RETURNED `guildId: 21`.

    // Let's try to list characters in DB again with a simpler script.

    const checking = await prisma.character.findMany({
        where: { guildId: 21, name: 'xalliara' }
    });
    console.log(`Direct DB Search for guildId=21 name='xalliara': found ${checking.length}`);
    if (checking.length > 0) {
        console.log(checking[0]);
    }

}

debug()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
