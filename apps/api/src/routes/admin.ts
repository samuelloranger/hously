import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { formatIso, nowUtc, sanitizeInput } from '../utils';
import {
  checkAndSendAllDayEventNotifications,
  checkAndSendReminders,
  cleanupOldNotifications,
  fetchYggTopPanelStats,
} from '../jobs';

// Generate a secure random password
const generateSecurePassword = (length: number = 16): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    password += alphabet[randomValues[i] % alphabet.length];
  }
  return password;
};

// Hash password using Bun's native API
const hashPassword = async (password: string): Promise<string> => {
  return await Bun.password.hash(password);
};

// Validate email format
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Admin-only middleware
const adminOnly = (
  user: { id: number; email: string; is_admin: boolean } | null,
  set: { status?: number | string }
): boolean => {
  if (!user) {
    set.status = 401;
    return false;
  }
  if (!user.is_admin) {
    set.status = 403;
    return false;
  }
  return true;
};

export const adminRoutes = new Elysia({ prefix: '/api/admin' })
  .use(auth)
  // GET /api/admin/scheduled-jobs - List scheduled cron jobs (admin only)
  .get('/scheduled-jobs', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    return {
      scheduler_running: true,
      jobs: [
        {
          id: 'checkReminders',
          name: 'Check reminders',
          next_run_time: null,
          trigger: '*/15 * * * *',
          func: 'check_and_send_reminders',
        },
        {
          id: 'checkAllDayEvents',
          name: 'Check all-day events',
          next_run_time: null,
          trigger: '0 20 * * *',
          func: 'check_and_send_all_day_custom_event_notifications',
        },
        {
          id: 'cleanupNotifications',
          name: 'Cleanup old notifications',
          next_run_time: null,
          trigger: '0 0 * * *',
          func: 'cleanup_old_notifications',
        },
        {
          id: 'fetchYggTopPanelStats',
          name: 'Fetch YGG top panel stats',
          next_run_time: null,
          trigger: '0 * * * *',
          func: 'fetch_ygg_top_panel_stats',
        },
      ],
    };
  })
  // POST /api/admin/trigger-action - Trigger a cron job manually (admin only)
  .post(
    '/trigger-action',
    async ({ user, body, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      try {
        switch (body.action) {
          case 'check_reminders': {
            await checkAndSendReminders();
            return { success: true, message: 'Reminders check executed' };
          }
          case 'check_all_day_events': {
            await checkAndSendAllDayEventNotifications();
            return { success: true, message: 'All-day events check executed' };
          }
          case 'cleanup_notifications': {
            const deleted = await cleanupOldNotifications();
            return { success: true, message: `Cleanup executed (${deleted} deleted)` };
          }
          case 'fetch_ygg_top_panel_stats': {
            await fetchYggTopPanelStats();
            return { success: true, message: 'YGG top panel stats fetched' };
          }
          default: {
            set.status = 400;
            return { success: false, message: 'Unknown action' };
          }
        }
      } catch (error) {
        console.error('Error triggering action:', error);
        set.status = 500;
        return { success: false, message: 'Failed to execute action' };
      }
    },
    {
      body: t.Object({
        action: t.String(),
      }),
    }
  )
  // GET /api/admin/users - List all users
  .get('/users', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    try {
      const allUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const usersData = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        first_name: u.firstName,
        last_name: u.lastName,
        is_admin: u.isAdmin,
        locale: u.locale || 'en',
        created_at: formatIso(u.createdAt),
        last_login: formatIso(u.lastLogin),
      }));

      return {
        success: true,
        users: usersData,
      };
    } catch (error) {
      console.error('Error listing users:', error);
      set.status = 500;
      return { error: 'Failed to list users' };
    }
  })

  // POST /api/admin/users - Create a new user
  .post(
    '/users',
    async ({ user, body, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      try {
        const { email, first_name, last_name, is_admin, locale } = body;

        const emailTrimmed = (email || '').trim().toLowerCase();

        // Validate email
        if (!emailTrimmed) {
          set.status = 400;
          return { error: 'Email is required' };
        }

        if (!validateEmail(emailTrimmed)) {
          set.status = 400;
          return { error: 'Invalid email format' };
        }

        // Sanitize inputs
        const sanitizedEmail = sanitizeInput(emailTrimmed);
        const sanitizedFirstName = first_name ? sanitizeInput(first_name.trim()) : null;
        const sanitizedLastName = last_name ? sanitizeInput(last_name.trim()) : null;
        const userLocale = (locale || 'en').trim().slice(0, 10);

        // Check if user already exists
        const existing = await prisma.user.findFirst({
          where: { email: sanitizedEmail },
        });

        if (existing) {
          console.warn(`Attempted to create user with existing email: ${sanitizedEmail}`);
          set.status = 400;
          return { error: 'User with this email already exists' };
        }

        // Generate secure password
        const password = generateSecurePassword();
        const passwordHash = await hashPassword(password);

        // Create user
        const newUser = await prisma.user.create({
          data: {
            email: sanitizedEmail,
            passwordHash,
            firstName: sanitizedFirstName,
            lastName: sanitizedLastName,
            isAdmin: is_admin || false,
            locale: userLocale,
            createdAt: nowUtc(),
          },
        });

        console.log(`Admin created new user: ${sanitizedEmail}`);

        set.status = 201;
        return {
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            first_name: newUser.firstName,
            last_name: newUser.lastName,
            is_admin: newUser.isAdmin,
            locale: newUser.locale,
          },
          password, // Return plain password for display (only shown once)
        };
      } catch (error) {
        console.error('Error creating user:', error);
        set.status = 500;
        return { error: 'Failed to create user' };
      }
    },
    {
      body: t.Object({
        email: t.String(),
        first_name: t.Optional(t.Union([t.String(), t.Null()])),
        last_name: t.Optional(t.Union([t.String(), t.Null()])),
        is_admin: t.Optional(t.Boolean()),
        locale: t.Optional(t.String()),
      }),
    }
  )

  // DELETE /api/admin/users/:id - Delete a user
  .delete(
    '/users/:id',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const userId = parseInt(params.id, 10);
      if (isNaN(userId)) {
        set.status = 400;
        return { error: 'Invalid user ID' };
      }

      try {
        // Prevent self-deletion
        if (userId === user!.id) {
          set.status = 400;
          return { error: 'Cannot delete your own account' };
        }

        // Find user to delete
        const userToDelete = await prisma.user.findFirst({
          where: { id: userId },
        });

        if (!userToDelete) {
          set.status = 404;
          return { error: 'User not found' };
        }

        const userEmail = userToDelete.email;

        // Delete user (cascade will handle related records)
        await prisma.user.delete({
          where: { id: userId },
        });

        console.log(`Admin deleted user: ${userEmail} (ID: ${userId})`);

        return {
          success: true,
          message: `User ${userEmail} deleted successfully`,
        };
      } catch (error) {
        console.error('Error deleting user:', error);
        set.status = 500;
        return { error: 'Failed to delete user' };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // GET /api/admin/export - Export all data
  .get('/export', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    try {
      // Build user ID to email mapping
      const allUsers = await prisma.user.findMany();
      const idToEmail = new Map<number, string>();
      for (const u of allUsers) {
        idToEmail.set(u.id, u.email);
      }

      // Get all data
      const allChores = await prisma.chore.findMany();
      const allReminders = await prisma.reminder.findMany();
      const allShoppingItems = await prisma.shoppingItem.findMany();
      const allTaskCompletions = await prisma.taskCompletion.findMany();

      // Export chores with user emails
      const choresData = allChores.map(chore => ({
        id: chore.id,
        chore_name: chore.choreName,
        description: chore.description,
        assigned_to_email: chore.assignedTo ? idToEmail.get(chore.assignedTo) : null,
        completed: chore.completed,
        added_by_email: chore.addedBy ? idToEmail.get(chore.addedBy) : null,
        completed_by_email: chore.completedBy ? idToEmail.get(chore.completedBy) : null,
        reminder_enabled: chore.reminderEnabled,
        image_path: chore.imagePath,
        created_at: formatIso(chore.createdAt),
        completed_at: formatIso(chore.completedAt),
        recurrence_type: chore.recurrenceType,
        recurrence_interval_days: chore.recurrenceIntervalDays,
        recurrence_weekday: chore.recurrenceWeekday,
        recurrence_original_created_at: formatIso(chore.recurrenceOriginalCreatedAt),
        recurrence_parent_id: chore.recurrenceParentId,
      }));

      // Export reminders with user emails
      const remindersData = allReminders.map(reminder => ({
        id: reminder.id,
        chore_id: reminder.choreId,
        reminder_datetime: formatIso(reminder.reminderDatetime),
        user_email: reminder.userId ? idToEmail.get(reminder.userId) : null,
        active: reminder.active,
        last_notification_sent: formatIso(reminder.lastNotificationSent),
        created_at: formatIso(reminder.createdAt),
      }));

      // Export shopping items with user emails
      const shoppingItemsData = allShoppingItems.map(item => ({
        id: item.id,
        item_name: item.itemName,
        notes: item.notes,
        completed: item.completed,
        added_by_email: item.addedBy ? idToEmail.get(item.addedBy) : null,
        completed_by_email: item.completedBy ? idToEmail.get(item.completedBy) : null,
        created_at: formatIso(item.createdAt),
        completed_at: formatIso(item.completedAt),
      }));

      // Export task completions with user emails
      const taskCompletionsData = allTaskCompletions.map(completion => ({
        id: completion.id,
        user_email: completion.userId ? idToEmail.get(completion.userId) : null,
        task_type: completion.taskType,
        task_id: completion.taskId,
        completed_at: formatIso(completion.completedAt),
        task_name: completion.taskName,
        emotion: completion.emotion,
      }));

      return {
        exported_at: formatIso(new Date()),
        chores: choresData,
        reminders: remindersData,
        shopping_items: shoppingItemsData,
        task_completions: taskCompletionsData,
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      set.status = 500;
      return { error: 'Failed to export data' };
    }
  })

  // POST /api/admin/import - Import data
  .post(
    '/import',
    async ({ user, body, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      try {
        // Build email to user ID mapping
        const allUsers = await prisma.user.findMany();
        const emailToId = new Map<string, number>();
        for (const u of allUsers) {
          emailToId.set(u.email, u.id);
        }

        const warnings: string[] = [];
        const importedCounts = {
          chores: 0,
          reminders: 0,
          shopping_items: 0,
          task_completions: 0,
        };

        // Mapping of old chore IDs to new IDs
        const choreIdMapping = new Map<number, number>();

        // Run all imports inside a transaction for atomicity
        await prisma.$transaction(async tx => {
          // Import chores
          if (body.chores && Array.isArray(body.chores)) {
            for (const choreData of body.chores) {
              const oldId = choreData.id;
              const addedByEmail = choreData.added_by_email;
              const assignedToEmail = choreData.assigned_to_email;
              const completedByEmail = choreData.completed_by_email;

              const addedById = addedByEmail ? emailToId.get(addedByEmail) : null;
              const assignedToId = assignedToEmail ? emailToId.get(assignedToEmail) : null;
              const completedById = completedByEmail ? emailToId.get(completedByEmail) : null;

              if (!addedById) {
                warnings.push(`Skipping chore '${choreData.chore_name}': user email '${addedByEmail}' not found`);
                continue;
              }

              const newChore = await tx.chore.create({
                data: {
                  choreName: choreData.chore_name,
                  description: choreData.description,
                  assignedTo: assignedToId,
                  completed: choreData.completed || false,
                  addedBy: addedById,
                  completedBy: completedById,
                  reminderEnabled: choreData.reminder_enabled || false,
                  imagePath: choreData.image_path,
                  recurrenceType: choreData.recurrence_type,
                  recurrenceIntervalDays: choreData.recurrence_interval_days,
                  recurrenceWeekday: choreData.recurrence_weekday,
                  recurrenceOriginalCreatedAt: choreData.recurrence_original_created_at,
                  recurrenceParentId: null,
                  position: 0,
                },
              });

              if (oldId !== undefined) {
                choreIdMapping.set(oldId, newChore.id);
              }
              importedCounts.chores++;
            }

            // Update recurrence_parent_id
            for (const choreData of body.chores) {
              const oldId = choreData.id;
              const oldParentId = choreData.recurrence_parent_id;
              if (oldParentId && choreIdMapping.has(oldId)) {
                const newId = choreIdMapping.get(oldId);
                const newParentId = choreIdMapping.get(oldParentId);
                if (newId && newParentId) {
                  await tx.chore.update({
                    where: { id: newId },
                    data: { recurrenceParentId: newParentId },
                  });
                }
              }
            }
          }

          // Import reminders
          if (body.reminders && Array.isArray(body.reminders)) {
            for (const reminderData of body.reminders) {
              const oldChoreId = reminderData.chore_id;
              const newChoreId = choreIdMapping.get(oldChoreId);
              const userEmail = reminderData.user_email;
              const userId = userEmail ? emailToId.get(userEmail) : null;

              if (!newChoreId) {
                warnings.push(`Skipping reminder: chore ID ${oldChoreId} not found in imported data`);
                continue;
              }

              if (!userId) {
                warnings.push(`Skipping reminder for chore ${oldChoreId}: user email '${userEmail}' not found`);
                continue;
              }

              await tx.reminder.create({
                data: {
                  choreId: newChoreId,
                  reminderDatetime: reminderData.reminder_datetime,
                  userId,
                  active: reminderData.active !== false,
                  lastNotificationSent: reminderData.last_notification_sent,
                },
              });

              importedCounts.reminders++;
            }
          }

          // Import shopping items
          if (body.shopping_items && Array.isArray(body.shopping_items)) {
            for (const itemData of body.shopping_items) {
              const addedByEmail = itemData.added_by_email;
              const completedByEmail = itemData.completed_by_email;

              const addedById = addedByEmail ? emailToId.get(addedByEmail) : null;
              const completedById = completedByEmail ? emailToId.get(completedByEmail) : null;

              if (!addedById) {
                warnings.push(`Skipping shopping item '${itemData.item_name}': user email '${addedByEmail}' not found`);
                continue;
              }

              await tx.shoppingItem.create({
                data: {
                  itemName: itemData.item_name,
                  notes: itemData.notes,
                  completed: itemData.completed || false,
                  addedBy: addedById,
                  completedBy: completedById,
                  completedAt: itemData.completed_at,
                  position: 0,
                },
              });

              importedCounts.shopping_items++;
            }
          }

          // Import task completions
          if (body.task_completions && Array.isArray(body.task_completions)) {
            for (const completionData of body.task_completions) {
              const userEmail = completionData.user_email;
              const userId = userEmail ? emailToId.get(userEmail) : null;

              if (!userId) {
                warnings.push(`Skipping task_completion: user email '${userEmail}' not found`);
                continue;
              }

              await tx.taskCompletion.create({
                data: {
                  userId,
                  taskType: completionData.task_type,
                  taskId: completionData.task_id,
                  completedAt: completionData.completed_at || nowUtc(),
                  taskName: completionData.task_name,
                  emotion: completionData.emotion,
                },
              });

              importedCounts.task_completions++;
            }
          }
        });

        return {
          success: true,
          imported: importedCounts,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      } catch (error) {
        console.error('Error importing data:', error);
        set.status = 500;
        return { error: 'Failed to import data' };
      }
    },
    {
      body: t.Object({
        chores: t.Optional(t.Array(t.Any())),
        reminders: t.Optional(t.Array(t.Any())),
        shopping_items: t.Optional(t.Array(t.Any())),
        task_completions: t.Optional(t.Array(t.Any())),
      }),
    }
  );
