
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const guildName = 'Okay';
    const charName = 'Xalliara';

    console.log('--- Debugging Roster Visibility ---');

    // 1. Find the Guild
    const guild = await prisma.guild.findFirst({
        where: { name: guildName },
        include: { characters: true }
    });

    if (!guild) {
        console.log(`Guild '${guildName}' not found.`);
        return;
    }

    console.log(`Guild: ${guild.name} (ID: ${guild.id})`);

    // 2. Find the Character (Try Lowercase)
    const charNameLower = charName.toLowerCase();
    console.log(`Searching for '${charNameLower}'...`);

    const character = await prisma.character.findFirst({
        where: {
            name: charNameLower,
            guildId: guild.id
        }
    });

    if (character) {
        console.log(`\nCharacter '${charNameLower}' FOUND in guild!`);
        console.log(`- ID: ${character.id}`);
        console.log(`- Stored Name: ${character.name}`);
        console.log(`- Rank: ${character.rank}`);
        console.log(`- Realm: ${character.realm}`);
    } else {
        console.log(`\nCharacter '${charNameLower}' NOT found in guild '${guildName}'.`);
    }

    // 3. List sample characters
    const samples = await prisma.character.findMany({
        where: { guildId: guild.id },
        take: 5
    });
    console.log('\nSample Characters in Guild:');
    samples.forEach(s => console.log(`- ${s.name} (Rank: ${s.rank}, Realm: ${s.realm})`));
}

debug()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
