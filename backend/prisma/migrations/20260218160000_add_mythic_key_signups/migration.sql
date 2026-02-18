-- CreateTable
CREATE TABLE "mythic_key_signups" (
    "id" SERIAL NOT NULL,
    "keyId" INTEGER NOT NULL,
    "characterId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mythic_key_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mythic_key_signups_keyId_characterId_key" ON "mythic_key_signups"("keyId", "characterId");

-- AddForeignKey
ALTER TABLE "mythic_key_signups" ADD CONSTRAINT "mythic_key_signups_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "mythic_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mythic_key_signups" ADD CONSTRAINT "mythic_key_signups_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "mythic_keys" ADD COLUMN "isFromBag" BOOLEAN NOT NULL DEFAULT false;
