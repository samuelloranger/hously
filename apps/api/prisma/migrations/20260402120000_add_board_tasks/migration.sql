-- CreateEnum
CREATE TYPE "BoardTaskStatus" AS ENUM ('ON_HOLD', 'TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "board_tasks" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "BoardTaskStatus" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_board_tasks_status_position" ON "board_tasks"("status", "position");

-- AddForeignKey
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
