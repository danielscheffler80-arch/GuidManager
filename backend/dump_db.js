const dotenv = require('dotenv');
dotenv.config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function dump() {
    try {
        console.log('--- Dumping character data ---');
        const chars = await prisma.character.findMany({
            select: {
                id: true,
                name: true,
                realm: true,
                userId: true,
                guildId: true,
                allowedGuildIds: true,
                isMain: true,
                isFavorite: true
            }
        });

        const guilds = await prisma.guild.findMany();

        let output = 'CHARACTERS:\n';
        chars.forEach(c => {
            output += `${c.name}-${c.realm} (ID: ${c.id}, User: ${c.userId}, Guild: ${c.guildId}, Main: ${c.isMain}, Fav: ${c.isFavorite}, Allowed: ${JSON.stringify(c.allowedGuildIds)})\n`;
        });

        output += '\nGUILDS:\n';
        guilds.forEach(g => {
            output += `ID: ${g.id}, Name: ${g.name}, Realm: ${g.realm}\n`;
        });

        fs.writeFileSync('db_dump.txt', output);
        console.log('Dump written to db_dump.txt');
    } catch (e) {
        console.error('Error during dump:', e);
    } finally {
        await prisma.$disconnect();
    }
}

dump();
