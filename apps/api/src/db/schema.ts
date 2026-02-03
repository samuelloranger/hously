import { pgTable, index, foreignKey, serial, integer, varchar, text, boolean, timestamp, json, uniqueIndex, check, numeric, date, unique, bigint, doublePrecision, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const externalnotificationservicelogstatus = pgEnum("externalnotificationservicelogstatus", ['success', 'failure', 'pending'])


export const notifications = pgTable("notifications", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	title: varchar().notNull(),
	body: text().notNull(),
	type: varchar().notNull(),
	read: boolean().default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	url: varchar(),
	notificationMetadata: json("notification_metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("ix_notifications_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("ix_notifications_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
]);

export const notificationTemplates = pgTable("notification_templates", {
	id: serial().primaryKey().notNull(),
	serviceId: integer("service_id").notNull(),
	eventType: varchar("event_type").notNull(),
	language: varchar().default('en').notNull(),
	titleTemplate: text("title_template").notNull(),
	bodyTemplate: text("body_template").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	index("ix_notification_templates_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("ix_notification_templates_language").using("btree", table.language.asc().nullsLast().op("text_ops")),
	index("ix_notification_templates_service_id").using("btree", table.serviceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [externalNotificationServices.id],
			name: "notification_templates_service_id_fkey"
		}).onDelete("cascade"),
]);

export const externalNotificationServices = pgTable("external_notification_services", {
	id: serial().primaryKey().notNull(),
	serviceName: varchar("service_name").notNull(),
	enabled: boolean().default(false).notNull(),
	token: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	notifyAdminsOnly: boolean("notify_admins_only").default(true).notNull(),
}, (table) => [
	uniqueIndex("ix_external_notification_services_service_name").using("btree", table.serviceName.asc().nullsLast().op("text_ops")),
	uniqueIndex("ix_external_notification_services_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
]);

export const externalNotificationServiceLogs = pgTable("external_notification_service_logs", {
	id: serial().primaryKey().notNull(),
	serviceId: integer("service_id").notNull(),
	eventType: varchar("event_type").notNull(),
	payload: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	status: varchar({ length: 20 }).notNull(),
}, (table) => [
	index("ix_external_notification_service_logs_service_id").using("btree", table.serviceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [externalNotificationServices.id],
			name: "external_notification_service_logs_service_id_fkey"
		}).onDelete("cascade"),
]);

export const customEvents = pgTable("custom_events", {
	id: serial().primaryKey().notNull(),
	title: varchar().notNull(),
	description: text(),
	startDatetime: timestamp("start_datetime", { mode: 'string' }).notNull(),
	endDatetime: timestamp("end_datetime", { mode: 'string' }).notNull(),
	allDay: boolean("all_day"),
	color: varchar().notNull(),
	userId: integer("user_id").notNull(),
	recurrenceType: varchar("recurrence_type"),
	recurrenceIntervalDays: integer("recurrence_interval_days"),
	recurrenceOriginalCreatedAt: timestamp("recurrence_original_created_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "custom_events_user_id_fkey"
		}),
]);

export const recipes = pgTable("recipes", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	instructions: text().notNull(),
	category: varchar(),
	servings: integer().notNull(),
	prepTimeMinutes: integer("prep_time_minutes"),
	cookTimeMinutes: integer("cook_time_minutes"),
	imagePath: varchar("image_path"),
	isFavorite: integer("is_favorite").notNull(),
	addedBy: integer("added_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.addedBy],
			foreignColumns: [users.id],
			name: "recipes_added_by_fkey"
		}),
]);

export const alembicVersion = pgTable("alembic_version", {
	versionNum: varchar("version_num", { length: 32 }).primaryKey().notNull(),
});

export const reminders = pgTable("reminders", {
	id: serial().primaryKey().notNull(),
	choreId: integer("chore_id").notNull(),
	reminderDatetime: timestamp("reminder_datetime", { mode: 'string' }).notNull(),
	userId: integer("user_id").notNull(),
	active: boolean(),
	lastNotificationSent: timestamp("last_notification_sent", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.choreId],
			foreignColumns: [chores.id],
			name: "reminders_chore_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "reminders_user_id_fkey"
		}),
]);

export const shoppingItems = pgTable("shopping_items", {
	id: serial().primaryKey().notNull(),
	itemName: varchar("item_name").notNull(),
	completed: boolean(),
	addedBy: integer("added_by").notNull(),
	completedBy: integer("completed_by"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	notes: text(),
	position: integer().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.addedBy],
			foreignColumns: [users.id],
			name: "shopping_items_added_by_fkey"
		}),
	foreignKey({
			columns: [table.completedBy],
			foreignColumns: [users.id],
			name: "shopping_items_completed_by_fkey"
		}),
]);

export const userSubscriptions = pgTable("user_subscriptions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	subscriptionInfo: text("subscription_info").notNull(),
	endpoint: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	deviceName: varchar("device_name"),
	osName: varchar("os_name"),
	osVersion: varchar("os_version"),
	browserName: varchar("browser_name"),
	browserVersion: varchar("browser_version"),
	platform: varchar(),
}, (table) => [
	index("ix_user_subscriptions_endpoint").using("btree", table.endpoint.asc().nullsLast().op("text_ops")),
	index("ix_user_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_subscriptions_user_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: varchar("email").notNull(),
	passwordHash: varchar("password_hash").notNull(),
	isAdmin: boolean("is_admin"),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	lastActivity: timestamp("last_activity", { mode: 'string' }),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	locale: varchar("locale"),
}, (table) => [
	uniqueIndex("ix_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const taskCompletions = pgTable("task_completions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	taskType: varchar("task_type", { length: 50 }).notNull(),
	taskId: integer("task_id").notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }).notNull(),
	taskName: varchar("task_name", { length: 255 }).notNull(),
	emotion: varchar({ length: 10 }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "task_completions_user_id_fkey"
		}),
	check("valid_emotion", sql`(emotion)::text = ANY ((ARRAY['🥵'::character varying, '😢'::character varying, '😐'::character varying, '😄'::character varying, '🔥'::character varying])::text[])`),
]);

export const recipeIngredients = pgTable("recipe_ingredients", {
	id: serial().primaryKey().notNull(),
	recipeId: integer("recipe_id").notNull(),
	name: varchar().notNull(),
	quantity: numeric({ precision: 10, scale:  2 }),
	unit: varchar(),
	position: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: "recipe_ingredients_recipe_id_fkey"
		}),
]);

export const chores = pgTable("chores", {
	id: serial().primaryKey().notNull(),
	choreName: varchar("chore_name").notNull(),
	description: text(),
	assignedTo: integer("assigned_to"),
	completed: boolean(),
	addedBy: integer("added_by").notNull(),
	completedBy: integer("completed_by"),
	reminderEnabled: boolean("reminder_enabled"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	imagePath: varchar("image_path"),
	recurrenceType: varchar("recurrence_type"),
	recurrenceIntervalDays: integer("recurrence_interval_days"),
	recurrenceWeekday: integer("recurrence_weekday"),
	recurrenceOriginalCreatedAt: timestamp("recurrence_original_created_at", { mode: 'string' }),
	recurrenceParentId: integer("recurrence_parent_id"),
	position: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.addedBy],
			foreignColumns: [users.id],
			name: "chores_added_by_fkey"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "chores_assigned_to_fkey"
		}),
	foreignKey({
			columns: [table.completedBy],
			foreignColumns: [users.id],
			name: "chores_completed_by_fkey"
		}),
	foreignKey({
			columns: [table.recurrenceParentId],
			foreignColumns: [table.id],
			name: "fk_chores_recurrence_parent"
		}).onDelete("set null"),
]);

export const mealPlans = pgTable("meal_plans", {
	id: serial().primaryKey().notNull(),
	recipeId: integer("recipe_id").notNull(),
	plannedDate: date("planned_date").notNull(),
	mealType: varchar("meal_type").notNull(),
	notes: text(),
	addedBy: integer("added_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.addedBy],
			foreignColumns: [users.id],
			name: "meal_plans_added_by_fkey"
		}),
	foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: "meal_plans_recipe_id_fkey"
		}),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	token: varchar().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_password_reset_tokens_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_fkey"
		}).onDelete("cascade"),
]);
