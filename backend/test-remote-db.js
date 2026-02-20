const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.byxdneprmynjwbxsrnop:b4PZevKB7NpjHn@aws-1-eu-west-3.pooler.supabase.com:5432/postgres"
        }
    }
});

async function main() {
    console.log("Testing user profile query...");
    const user = await prisma.user.findFirst({
        include: {
            characters: {
                orderBy: { lastSync: 'desc' }
            },
            guildMemberships: {
                include: { guild: true }
            }
        }
    });
    console.log("User query success.", user ? "User found." : "No user found.");

    console.log("Testing guilds query...");
    const guilds = await prisma.guild.findMany({});
    console.log("Guilds query success. Guilds found:", guilds.length);
}

main()
    .catch(e => {
        console.error("Connection failed!");
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
