
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGuilds() {
    try {
        console.log('--- Checking Guilds ---');
        const guilds = await prisma.guild.findMany({
            include: {
                _count: {
                    select: { characters: true }
                }
            }
        });

        if (guilds.length === 0) {
            console.log('No guilds found in database.');
        } else {
            for (const guild of guilds) {
                console.log(`Guild: ${guild.name} (${guild.realm}) - AccessToken: ${guild.adminAccessToken ? 'Yes' : 'No'} - Members: ${guild._count.characters}`);
            }
        }

        console.log('\n--- Checking User Characters (UserId != 0) ---');
        const userChars = await prisma.character.findMany({
            where: {
                userId: { not: 0 }
            },
            take: 10,
            select: { name: true, realm: true, userId: true, guildId: true }
        });
        console.log(`Found ${userChars.length} linked characters (showing max 10):`);
        userChars.forEach(c => console.log(`- ${c.name} (GuildID: ${c.guildId}) -> User: ${c.userId}`));

    } catch (e) {
        console.error('Error checking DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkGuilds();
