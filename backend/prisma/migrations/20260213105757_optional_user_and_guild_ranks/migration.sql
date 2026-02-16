-- AlterTable
ALTER TABLE "characters" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "guilds" ADD COLUMN     "ranks" JSONB,
ALTER COLUMN "visibleRanks" SET DEFAULT ARRAY[5, 7]::INTEGER[];
