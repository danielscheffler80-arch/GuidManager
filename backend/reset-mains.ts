import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetMains() {
    try {
        console.log('Resetting isMain for all characters...');
        const result = await prisma.character.updateMany({
            data: {
                isMain: false,
            },
        });
        console.log(`Successfully reset isMain for ${result.count} characters.`);
    } catch (error) {
        console.error('Error resetting isMain:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetMains();
