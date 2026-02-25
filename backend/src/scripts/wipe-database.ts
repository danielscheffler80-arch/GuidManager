import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DANGEROUS DATABASE WIPE STARTED ---');

    try {
        // We delete in reverse order of dependencies
        console.log('Deleting Sync Logs...');
        await (prisma as any).syncLog.deleteMany({});

        console.log('Deleting Mythic Signups...');
        await (prisma as any).mythicKeySignup.deleteMany({});

        console.log('Deleting Mythic Keys...');
        await (prisma as any).mythicKey.deleteMany({});

        console.log('Deleting Raid Attendances...');
        await (prisma as any).attendance.deleteMany({});

        console.log('Deleting Raid Events...');
        await (prisma as any).raid.deleteMany({});

        console.log('Deleting Rosters...');
        await (prisma as any).roster.deleteMany({});

        console.log('Deleting Guild Chat History...');
        await (prisma as any).guildChat.deleteMany({});

        console.log('Deleting Guild Memberships...');
        await (prisma as any).userGuild.deleteMany({});

        console.log('Deleting Characters...');
        await (prisma as any).character.deleteMany({});

        console.log('Deleting Guilds...');
        await (prisma as any).guild.deleteMany({});

        console.log('Resetting Users initial sync status...');
        await prisma.user.updateMany({
            data: { initialSyncCompletedAt: null }
        });

        console.log('--- DATABASE WIPE COMPLETED SUCCESSFULLY ---');
        console.log('Users are preserved, but all character/guild relationships and logs are cleared.');
    } catch (error) {
        console.error('Error during wipe:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
