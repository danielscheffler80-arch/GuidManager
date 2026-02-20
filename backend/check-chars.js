const fs = require('fs');
const dotenv = require('dotenv');

const envConfig1 = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig1) process.env[k] = envConfig1[k];

if (fs.existsSync('.env.production')) {
    const envConfig2 = dotenv.parse(fs.readFileSync('.env.production'));
    for (const k in envConfig2) process.env[k] = envConfig2[k];
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const chars = await prisma.character.findMany({
        where: { name: { in: ['viridra', 'xalliara'] } }
    });
    console.log('Characters:');
    console.log(JSON.stringify(chars, null, 2));

    const authData = await prisma.user.findMany({
        include: {
            characters: true,
            guildMemberships: true,
        }
    });

    const relevantUsers = authData.filter(u => u.characters.some(c => ['viridra', 'xalliara'].includes(c.name.toLowerCase())));
    console.log('Users associated:');
    console.log(JSON.stringify(relevantUsers, null, 2));
}

main().finally(() => prisma.$disconnect());
