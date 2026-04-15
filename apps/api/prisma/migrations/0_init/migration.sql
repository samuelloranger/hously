-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_admin" BOOLEAN,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),
    "last_activity" TIMESTAMP(3),
    "first_name" TEXT,
    "last_name" TEXT,
    "locale" TEXT,
    "avatar_url" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "url" TEXT,
    "notification_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "title_template" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_notification_services" (
    "id" SERIAL NOT NULL,
    "service_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "notify_admins_only" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "external_notification_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_notification_service_logs" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL,

    CONSTRAINT "external_notification_service_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_events" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN,
    "color" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "recurrence_type" TEXT,
    "recurrence_interval_days" INTEGER,
    "recurrence_original_created_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),

    CONSTRAINT "custom_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT NOT NULL,
    "category" TEXT,
    "servings" INTEGER NOT NULL,
    "prep_time_minutes" INTEGER,
    "cook_time_minutes" INTEGER,
    "image_path" TEXT,
    "is_favorite" INTEGER NOT NULL,
    "added_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" SERIAL NOT NULL,
    "chore_id" INTEGER NOT NULL,
    "reminder_datetime" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "active" BOOLEAN,
    "last_notification_sent" TIMESTAMP(3),
    "created_at" TIMESTAMP(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_items" (
    "id" SERIAL NOT NULL,
    "item_name" TEXT NOT NULL,
    "completed" BOOLEAN,
    "added_by" INTEGER NOT NULL,
    "completed_by" INTEGER,
    "created_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "subscription_info" TEXT NOT NULL,
    "endpoint" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "device_name" TEXT,
    "os_name" TEXT,
    "os_version" TEXT,
    "browser_name" TEXT,
    "browser_version" TEXT,
    "platform" TEXT,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "task_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "task_name" VARCHAR(255) NOT NULL,
    "emotion" VARCHAR(10),

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chores" (
    "id" SERIAL NOT NULL,
    "chore_name" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to" INTEGER,
    "completed" BOOLEAN,
    "added_by" INTEGER NOT NULL,
    "completed_by" INTEGER,
    "reminder_enabled" BOOLEAN,
    "created_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "image_path" TEXT,
    "recurrence_type" TEXT,
    "recurrence_interval_days" INTEGER,
    "recurrence_weekday" INTEGER,
    "recurrence_original_created_at" TIMESTAMP(3),
    "recurrence_parent_id" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "chores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "planned_date" DATE NOT NULL,
    "meal_type" TEXT NOT NULL,
    "notes" TEXT,
    "added_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3),

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ix_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "ix_notifications_created_at" ON "notifications"("created_at");
CREATE INDEX "ix_notifications_user_id" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "ix_notification_templates_event_type" ON "notification_templates"("event_type");
CREATE INDEX "ix_notification_templates_language" ON "notification_templates"("language");
CREATE INDEX "ix_notification_templates_service_id" ON "notification_templates"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "ix_external_notification_services_service_name" ON "external_notification_services"("service_name");
CREATE UNIQUE INDEX "ix_external_notification_services_token" ON "external_notification_services"("token");

-- CreateIndex
CREATE INDEX "ix_external_notification_service_logs_service_id" ON "external_notification_service_logs"("service_id");

-- CreateIndex
CREATE INDEX "ix_user_subscriptions_endpoint" ON "user_subscriptions"("endpoint");
CREATE INDEX "ix_user_subscriptions_user_id" ON "user_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ix_password_reset_tokens_token" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ix_refresh_tokens_token" ON "refresh_tokens"("token");
CREATE INDEX "ix_refresh_tokens_user_id" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ix_push_tokens_token" ON "push_tokens"("token");
CREATE INDEX "ix_push_tokens_user_id" ON "push_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "external_notification_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_notification_service_logs" ADD CONSTRAINT "external_notification_service_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "external_notification_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_events" ADD CONSTRAINT "custom_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_chore_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chores" ADD CONSTRAINT "chores_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chores" ADD CONSTRAINT "chores_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "chores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
