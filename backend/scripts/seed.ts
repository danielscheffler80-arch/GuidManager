import prisma from '../src/prisma';

async function main() {
  // Simple seed data to bootstrap the database for MVP
  const guild = await prisma.guild.create({
    data: {
      name: 'Demo Guild',
    },
  });

  const member = await prisma.member.create({
    data: {
      discordUserId: 'discord-0001',
      username: 'DemoMember',
      guildId: guild.id,
      joinedAt: new Date(),
    },
  });

  // Sample main character
  await prisma.character.create({
    data: {
      memberId: member.id,
      name: 'DemoHero',
      classId: 'DK',
      specId: 'Blood',
      isMain: true,
      slot: 'MAIN',
    },
  });

  console.log('Seed data created: 1 guild, 1 member, 1 character');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
