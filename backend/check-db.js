const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            characters: { select: { id: true, name: true, realm: true, guildId: true } },
            guildMemberships: { include: { guild: { select: { id: true, name: true } } } }
        }
    });

    for (const u of users) {
        console.log(`\n=== User ${u.id}: ${u.name} ===`);
        console.log(`  Characters (${u.characters.length}):`, u.characters.map(c => `${c.name}@${c.realm}`).join(', ') || 'NONE');
        console.log(`  Guilds (${u.guildMemberships.length}):`, u.guildMemberships.map(g => g.guild.name).join(', ') || 'NONE');
    }

    const guildCount = await prisma.guild.count();
    const charCount = await prisma.character.count();
    console.log(`\n=== DB Summary: ${users.length} users, ${charCount} chars, ${guildCount} guilds ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
