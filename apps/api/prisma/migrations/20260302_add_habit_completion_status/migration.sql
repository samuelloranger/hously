DO $$ BEGIN
    CREATE TYPE "HabitCompletionStatus" AS ENUM ('done', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "habit_completions"
ADD COLUMN "status" "HabitCompletionStatus" NOT NULL DEFAULT 'done';
