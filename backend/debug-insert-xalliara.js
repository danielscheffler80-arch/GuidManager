
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    console.log('--- Debugging Manual Insertion ---');

    const guildId = 21; // Okay
    const name = 'xalliara';
    const realm = 'blackrock';

    // Clean up any potential partial records first?
    // No, let's try upsert directly as RosterService does.

    console.log(`Attempting to upsert ${name}-${realm}...`);

    try {
        const char = await prisma.character.upsert({
            where: {
                name_realm: {
                    name: name,
                    realm: realm,
                }
            },
            update: {
                guildId: guildId,
                level: 80,
                rank: 6,
                class: 'Priester', // German name from BNet
                classId: 5,
                race: 'Blutelf',
                isActive: true,
                lastSync: new Date()
            },
            create: {
                name: name,
                realm: realm,
                guildId: guildId,
                level: 80,
                rank: 6,
                class: 'Priester',
                classId: 5,
                race: 'Blutelf',
                faction: 'Horde',
                battleNetId: '999999999', // Dummy ID for test
                averageItemLevel: 0,
                mythicRating: 0,
                raidProgress: '-',
                isActive: true,
                lastSync: new Date()
            }
        });
        console.log('Upsert successful!', char);
    } catch (error) {
        console.error('Upsert FAILED:', error);
        if (error.code === 'P2002') {
            console.error('Unique constraint violation on:', error.meta?.target);
        }
    }
}

debug()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
