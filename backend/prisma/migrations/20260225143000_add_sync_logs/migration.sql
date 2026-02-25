-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phase" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);
