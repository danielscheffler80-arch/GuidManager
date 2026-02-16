-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "raids" ADD COLUMN     "allowedRanks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "recurringId" TEXT;

-- CreateTable
CREATE TABLE "guild_chats" (
    "id" SERIAL NOT NULL,
    "guildId" INTEGER NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guild_chats_guildId_idx" ON "guild_chats"("guildId");

-- AddForeignKey
ALTER TABLE "guild_chats" ADD CONSTRAINT "guild_chats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
