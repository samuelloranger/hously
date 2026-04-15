-- AlterEnum: add BACKLOG status
ALTER TYPE "BoardTaskStatus" ADD VALUE 'BACKLOG';

-- CreateEnum
CREATE TYPE "BoardTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BoardTaskActivityType" AS ENUM ('created', 'comment', 'status_change', 'priority_change', 'assignee_change');

-- AlterTable: add new columns to board_tasks (archived is handled in a later migration)
ALTER TABLE "board_tasks"
ADD COLUMN "priority" "BoardTaskPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "start_date" DATE,
ADD COLUMN "due_date" DATE,
ADD COLUMN "assignee_id" INTEGER,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "estimated_minutes" INTEGER,
ADD COLUMN "logged_minutes" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey: assignee relation
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: board_time_logs
CREATE TABLE "board_time_logs" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_time_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ix_board_time_logs_task_id" ON "board_time_logs"("task_id");

ALTER TABLE "board_time_logs" ADD CONSTRAINT "board_time_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "board_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_time_logs" ADD CONSTRAINT "board_time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: board_task_dependencies
CREATE TABLE "board_task_dependencies" (
    "id" SERIAL NOT NULL,
    "blocking_task_id" INTEGER NOT NULL,
    "blocked_task_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_task_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_board_task_dependency" ON "board_task_dependencies"("blocking_task_id", "blocked_task_id");
CREATE INDEX "ix_board_task_dependency_blocked" ON "board_task_dependencies"("blocked_task_id");

ALTER TABLE "board_task_dependencies" ADD CONSTRAINT "board_task_dependencies_blocking_task_id_fkey" FOREIGN KEY ("blocking_task_id") REFERENCES "board_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_task_dependencies" ADD CONSTRAINT "board_task_dependencies_blocked_task_id_fkey" FOREIGN KEY ("blocked_task_id") REFERENCES "board_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: board_tags
CREATE TABLE "board_tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "board_tags_name_key" ON "board_tags"("name");

-- CreateTable: implicit many-to-many join table for BoardTask <-> BoardTag
CREATE TABLE "_BoardTaskTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_BoardTaskTags_AB_unique" ON "_BoardTaskTags"("A", "B");
CREATE INDEX "_BoardTaskTags_B_index" ON "_BoardTaskTags"("B");

ALTER TABLE "_BoardTaskTags" ADD CONSTRAINT "_BoardTaskTags_A_fkey" FOREIGN KEY ("A") REFERENCES "board_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BoardTaskTags" ADD CONSTRAINT "_BoardTaskTags_B_fkey" FOREIGN KEY ("B") REFERENCES "board_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: board_task_activities
CREATE TABLE "board_task_activities" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "BoardTaskActivityType" NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_task_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ix_board_task_activities_task_created" ON "board_task_activities"("task_id", "created_at");

ALTER TABLE "board_task_activities" ADD CONSTRAINT "board_task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "board_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_task_activities" ADD CONSTRAINT "board_task_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
