-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" DATETIME;
ALTER TABLE "User" ADD COLUMN "pendingCodeExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "pendingCodeHash" TEXT;

