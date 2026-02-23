-- CreateTable
CREATE TABLE "private_messages" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "private_messages_senderId_idx" ON "private_messages"("senderId");

-- CreateIndex
CREATE INDEX "private_messages_receiverId_idx" ON "private_messages"("receiverId");

-- AddForeignKey
ALTER TABLE "private_messages" ADD CONSTRAINT "private_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_messages" ADD CONSTRAINT "private_messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
