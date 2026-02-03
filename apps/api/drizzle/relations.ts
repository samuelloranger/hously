import { relations } from "drizzle-orm/relations";
import { users, notifications, externalNotificationServices, notificationTemplates, externalNotificationServiceLogs, customEvents, recipes, chores, reminders, shoppingItems, userSubscriptions, taskCompletions, recipeIngredients, mealPlans, storagePaths, services, passwordResetTokens } from "./schema";

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	notifications: many(notifications),
	customEvents: many(customEvents),
	recipes: many(recipes),
	reminders: many(reminders),
	shoppingItems_addedBy: many(shoppingItems, {
		relationName: "shoppingItems_addedBy_users_id"
	}),
	shoppingItems_completedBy: many(shoppingItems, {
		relationName: "shoppingItems_completedBy_users_id"
	}),
	userSubscriptions: many(userSubscriptions),
	taskCompletions: many(taskCompletions),
	chores_addedBy: many(chores, {
		relationName: "chores_addedBy_users_id"
	}),
	chores_assignedTo: many(chores, {
		relationName: "chores_assignedTo_users_id"
	}),
	chores_completedBy: many(chores, {
		relationName: "chores_completedBy_users_id"
	}),
	mealPlans: many(mealPlans),
	storagePaths: many(storagePaths),
	services: many(services),
	passwordResetTokens: many(passwordResetTokens),
}));

export const notificationTemplatesRelations = relations(notificationTemplates, ({one}) => ({
	externalNotificationService: one(externalNotificationServices, {
		fields: [notificationTemplates.serviceId],
		references: [externalNotificationServices.id]
	}),
}));

export const externalNotificationServicesRelations = relations(externalNotificationServices, ({many}) => ({
	notificationTemplates: many(notificationTemplates),
	externalNotificationServiceLogs: many(externalNotificationServiceLogs),
}));

export const externalNotificationServiceLogsRelations = relations(externalNotificationServiceLogs, ({one}) => ({
	externalNotificationService: one(externalNotificationServices, {
		fields: [externalNotificationServiceLogs.serviceId],
		references: [externalNotificationServices.id]
	}),
}));

export const customEventsRelations = relations(customEvents, ({one}) => ({
	user: one(users, {
		fields: [customEvents.userId],
		references: [users.id]
	}),
}));

export const recipesRelations = relations(recipes, ({one, many}) => ({
	user: one(users, {
		fields: [recipes.addedBy],
		references: [users.id]
	}),
	recipeIngredients: many(recipeIngredients),
	mealPlans: many(mealPlans),
}));

export const remindersRelations = relations(reminders, ({one}) => ({
	chore: one(chores, {
		fields: [reminders.choreId],
		references: [chores.id]
	}),
	user: one(users, {
		fields: [reminders.userId],
		references: [users.id]
	}),
}));

export const choresRelations = relations(chores, ({one, many}) => ({
	reminders: many(reminders),
	user_addedBy: one(users, {
		fields: [chores.addedBy],
		references: [users.id],
		relationName: "chores_addedBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [chores.assignedTo],
		references: [users.id],
		relationName: "chores_assignedTo_users_id"
	}),
	user_completedBy: one(users, {
		fields: [chores.completedBy],
		references: [users.id],
		relationName: "chores_completedBy_users_id"
	}),
	chore: one(chores, {
		fields: [chores.recurrenceParentId],
		references: [chores.id],
		relationName: "chores_recurrenceParentId_chores_id"
	}),
	chores: many(chores, {
		relationName: "chores_recurrenceParentId_chores_id"
	}),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({one}) => ({
	user_addedBy: one(users, {
		fields: [shoppingItems.addedBy],
		references: [users.id],
		relationName: "shoppingItems_addedBy_users_id"
	}),
	user_completedBy: one(users, {
		fields: [shoppingItems.completedBy],
		references: [users.id],
		relationName: "shoppingItems_completedBy_users_id"
	}),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({one}) => ({
	user: one(users, {
		fields: [userSubscriptions.userId],
		references: [users.id]
	}),
}));

export const taskCompletionsRelations = relations(taskCompletions, ({one}) => ({
	user: one(users, {
		fields: [taskCompletions.userId],
		references: [users.id]
	}),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({one}) => ({
	recipe: one(recipes, {
		fields: [recipeIngredients.recipeId],
		references: [recipes.id]
	}),
}));

export const mealPlansRelations = relations(mealPlans, ({one}) => ({
	user: one(users, {
		fields: [mealPlans.addedBy],
		references: [users.id]
	}),
	recipe: one(recipes, {
		fields: [mealPlans.recipeId],
		references: [recipes.id]
	}),
}));

export const storagePathsRelations = relations(storagePaths, ({one}) => ({
	user: one(users, {
		fields: [storagePaths.addedBy],
		references: [users.id]
	}),
}));

export const servicesRelations = relations(services, ({one}) => ({
	user: one(users, {
		fields: [services.addedBy],
		references: [users.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));