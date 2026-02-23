-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "allowedGuildIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
