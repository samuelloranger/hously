-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."externalnotificationservicelogstatus" AS ENUM('success', 'failure', 'pending');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar NOT NULL,
	"body" text NOT NULL,
	"type" varchar NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"url" varchar,
	"notification_metadata" json,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"event_type" varchar NOT NULL,
	"language" varchar DEFAULT 'en' NOT NULL,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "external_notification_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" varchar NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"token" varchar,
	"created_at" timestamp,
	"updated_at" timestamp,
	"notify_admins_only" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_notification_service_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"event_type" varchar NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp,
	"status" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"start_datetime" timestamp NOT NULL,
	"end_datetime" timestamp NOT NULL,
	"all_day" boolean,
	"color" varchar NOT NULL,
	"user_id" integer NOT NULL,
	"recurrence_type" varchar,
	"recurrence_interval_days" integer,
	"recurrence_original_created_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"category" varchar,
	"servings" integer NOT NULL,
	"prep_time_minutes" integer,
	"cook_time_minutes" integer,
	"image_path" varchar,
	"is_favorite" integer NOT NULL,
	"added_by" integer NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alembic_version" (
	"version_num" varchar(32) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"chore_id" integer NOT NULL,
	"reminder_datetime" timestamp NOT NULL,
	"user_id" integer NOT NULL,
	"active" boolean,
	"last_notification_sent" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_name" varchar NOT NULL,
	"completed" boolean,
	"added_by" integer NOT NULL,
	"completed_by" integer,
	"created_at" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"position" integer NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subscription_info" text NOT NULL,
	"endpoint" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"device_name" varchar,
	"os_name" varchar,
	"os_version" varchar,
	"browser_name" varchar,
	"browser_version" varchar,
	"platform" varchar
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"is_admin" boolean,
	"last_login" timestamp,
	"created_at" timestamp,
	"last_activity" timestamp,
	"first_name" varchar,
	"last_name" varchar,
	"locale" varchar
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_type" varchar(50) NOT NULL,
	"task_id" integer NOT NULL,
	"completed_at" timestamp NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"emotion" varchar(10),
	CONSTRAINT "valid_emotion" CHECK ((emotion)::text = ANY ((ARRAY['🥵'::character varying, '😢'::character varying, '😐'::character varying, '😄'::character varying, '🔥'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"name" varchar NOT NULL,
	"quantity" numeric(10, 2),
	"unit" varchar,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" serial PRIMARY KEY NOT NULL,
	"chore_name" varchar NOT NULL,
	"description" text,
	"assigned_to" integer,
	"completed" boolean,
	"added_by" integer NOT NULL,
	"completed_by" integer,
	"reminder_enabled" boolean,
	"created_at" timestamp,
	"completed_at" timestamp,
	"image_path" varchar,
	"recurrence_type" varchar,
	"recurrence_interval_days" integer,
	"recurrence_weekday" integer,
	"recurrence_original_created_at" timestamp,
	"recurrence_parent_id" integer,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"planned_date" date NOT NULL,
	"meal_type" varchar NOT NULL,
	"notes" text,
	"added_by" integer NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "storage_paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"path" varchar NOT NULL,
	"total_bytes" bigint,
	"used_bytes" bigint,
	"free_bytes" bigint,
	"percent_used" double precision,
	"last_checked_at" timestamp,
	"is_accessible" integer NOT NULL,
	"added_by" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "storage_paths_path_key" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"name" varchar NOT NULL,
	"url" varchar NOT NULL,
	"expected_status" integer NOT NULL,
	"icon" varchar,
	"is_online" boolean NOT NULL,
	"last_checked_at" timestamp,
	"last_online_at" timestamp,
	"last_offline_at" timestamp,
	"last_down_notification_sent" timestamp,
	"last_up_notification_sent" timestamp,
	"added_by" integer NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."external_notification_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_notification_service_logs" ADD CONSTRAINT "external_notification_service_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."external_notification_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_events" ADD CONSTRAINT "custom_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_chore_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "fk_chores_recurrence_parent" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."chores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_paths" ADD CONSTRAINT "storage_paths_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_notifications_created_at" ON "notifications" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ix_notifications_user_id" ON "notifications" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_notification_templates_event_type" ON "notification_templates" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "ix_notification_templates_language" ON "notification_templates" USING btree ("language" text_ops);--> statement-breakpoint
CREATE INDEX "ix_notification_templates_service_id" ON "notification_templates" USING btree ("service_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_external_notification_services_service_name" ON "external_notification_services" USING btree ("service_name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_external_notification_services_token" ON "external_notification_services" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "ix_external_notification_service_logs_service_id" ON "external_notification_service_logs" USING btree ("service_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_user_subscriptions_endpoint" ON "user_subscriptions" USING btree ("endpoint" text_ops);--> statement-breakpoint
CREATE INDEX "ix_user_subscriptions_user_id" ON "user_subscriptions" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "ix_services_is_online" ON "services" USING btree ("is_online" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_password_reset_tokens_token" ON "password_reset_tokens" USING btree ("token" text_ops);
*/