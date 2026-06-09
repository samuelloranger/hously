-- DropForeignKey
ALTER TABLE "board_tasks" DROP CONSTRAINT "board_tasks_created_by_fkey";

-- DropForeignKey
ALTER TABLE "board_tasks" DROP CONSTRAINT "board_tasks_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "board_time_logs" DROP CONSTRAINT "board_time_logs_task_id_fkey";

-- DropForeignKey
ALTER TABLE "board_time_logs" DROP CONSTRAINT "board_time_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "board_task_dependencies" DROP CONSTRAINT "board_task_dependencies_blocking_task_id_fkey";

-- DropForeignKey
ALTER TABLE "board_task_dependencies" DROP CONSTRAINT "board_task_dependencies_blocked_task_id_fkey";

-- DropForeignKey
ALTER TABLE "board_task_activities" DROP CONSTRAINT "board_task_activities_task_id_fkey";

-- DropForeignKey
ALTER TABLE "board_task_activities" DROP CONSTRAINT "board_task_activities_user_id_fkey";

-- DropForeignKey
ALTER TABLE "_BoardTaskTags" DROP CONSTRAINT "_BoardTaskTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_BoardTaskTags" DROP CONSTRAINT "_BoardTaskTags_B_fkey";

-- DropTable
DROP TABLE "board_tasks";

-- DropTable
DROP TABLE "board_time_logs";

-- DropTable
DROP TABLE "board_task_dependencies";

-- DropTable
DROP TABLE "board_tags";

-- DropTable
DROP TABLE "board_task_activities";

-- DropTable
DROP TABLE "_BoardTaskTags";

-- DropEnum
DROP TYPE "BoardTaskStatus";

-- DropEnum
DROP TYPE "BoardTaskPriority";

-- DropEnum
DROP TYPE "BoardTaskActivityType";
