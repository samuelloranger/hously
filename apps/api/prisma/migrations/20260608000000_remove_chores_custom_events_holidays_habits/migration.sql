-- DropForeignKey
ALTER TABLE "custom_events" DROP CONSTRAINT "custom_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_chore_id_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chores" DROP CONSTRAINT "chores_added_by_fkey";

-- DropForeignKey
ALTER TABLE "chores" DROP CONSTRAINT "chores_assigned_to_fkey";

-- DropForeignKey
ALTER TABLE "chores" DROP CONSTRAINT "chores_completed_by_fkey";

-- DropForeignKey
ALTER TABLE "chores" DROP CONSTRAINT "chores_recurrence_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "habits" DROP CONSTRAINT "habits_user_id_fkey";

-- DropForeignKey
ALTER TABLE "habit_schedules" DROP CONSTRAINT "habit_schedules_habit_id_fkey";

-- DropForeignKey
ALTER TABLE "habit_completions" DROP CONSTRAINT "habit_completions_habit_id_fkey";

-- DropIndex
DROP INDEX "ix_users_calendar_token";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "calendar_token";

-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "calendar_subdivision_code";

-- DropTable
DROP TABLE "custom_events";

-- DropTable
DROP TABLE "reminders";

-- DropTable
DROP TABLE "chores";

-- DropTable
DROP TABLE "habits";

-- DropTable
DROP TABLE "habit_schedules";

-- DropTable
DROP TABLE "habit_completions";

-- DropEnum
DROP TYPE "HabitCompletionStatus";

