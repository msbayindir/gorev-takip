-- Bir görev birden fazla kişiye verilebilsin: sorumlular ayrı tabloya taşınır.

-- 1) Yeni tablo
CREATE TABLE "task_assignees" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("taskId","userId")
);
CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Mevcut sorumluları kopyala (veri kaybı olmasın)
INSERT INTO "task_assignees" ("taskId", "userId", "createdAt")
SELECT "id", "assigneeId", "createdAt" FROM "tasks" WHERE "assigneeId" IS NOT NULL;

-- 3) Eski sütunu kaldır
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assigneeId_fkey";
DROP INDEX "tasks_assigneeId_status_idx";
ALTER TABLE "tasks" DROP COLUMN "assigneeId";
