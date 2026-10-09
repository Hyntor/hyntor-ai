-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "courseId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "tier" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("authorId", "body", "createdAt", "id", "workspaceId") SELECT "authorId", "body", "createdAt", "id", "workspaceId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_workspaceId_idx" ON "ChatMessage"("workspaceId");
CREATE INDEX "ChatMessage_courseId_idx" ON "ChatMessage"("courseId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "universityId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" DATETIME,
    "pendingCodeHash" TEXT,
    "pendingCodeExpiresAt" DATETIME,
    CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "id", "lastActiveAt", "name", "passwordHash", "pendingCodeExpiresAt", "pendingCodeHash", "role", "streakCount", "universityId", "xp") SELECT "createdAt", "email", "emailVerified", "id", "lastActiveAt", "name", "passwordHash", "pendingCodeExpiresAt", "pendingCodeHash", "role", "streakCount", "universityId", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_universityId_idx" ON "User"("universityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

