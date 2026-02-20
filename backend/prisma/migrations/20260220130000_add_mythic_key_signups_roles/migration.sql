-- AlterTable
ALTER TABLE "mythic_key_signups" ADD COLUMN "primaryRole" TEXT NOT NULL DEFAULT 'DPS';
ALTER TABLE "mythic_key_signups" ADD COLUMN "secondaryRole" TEXT;
