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
    const guild = await prisma.guild.findFirst({ where: { name: 'Okay' } });
    console.log('Guild:', guild.id);

    const guildMemberUserIds = await prisma.userGuild.findMany({
        where: { guildId: guild.id },
        select: { userId: true }
    }).then(members => members.map(m => m.userId));

    const assignedCharacters = await prisma.character.findMany({
        where: {
            userId: { in: guildMemberUserIds }
        }
    });

    const missing = assignedCharacters.filter(c => ['viridra', 'xalliara'].includes(c.name.toLowerCase()));
    console.log('Are Viridra and Xalliara assigned to members of Okay?', missing);
}

main().finally(() => prisma.$disconnect());
