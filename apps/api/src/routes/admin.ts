import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { formatIso, nowUtc, sanitizeInput } from '../utils';
import {
  checkAndSendAllDayEventNotifications,
  checkAndSendReminders,
  cleanupOldNotifications,
  fetchTrackerStats,
  refreshUpcoming,
  refreshHabitsStreaks,
} from '../jobs';
import { logActivity } from '../utils/activityLogs';
import { sendInvitationEmail } from '../services/emailService';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/tokens';

const resolveAdminActionJob = (action: string): { id: string; name: string } | null => {
  switch (action) {
    case 'check_reminders':
      return { id: 'checkReminders', name: 'Check reminders' };
    case 'check_all_day_events':
      return { id: 'checkAllDayEvents', name: 'Check all-day events' };
    case 'cleanup_notifications':
      return { id: 'cleanupNotifications', name: 'Cleanup old notifications' };
    case 'fetch_c411_stats':
      return { id: 'fetchC411Stats', name: 'Fetch C411 stats' };
    case 'fetch_torr9_stats':
      return { id: 'fetchTorr9Stats', name: 'Fetch Torr9 stats' };
    case 'fetch_la_cale_stats':
      return { id: 'fetchLaCaleStats', name: 'Fetch La Cale stats' };
    case 'refresh_upcoming':
      return { id: 'refreshUpcoming', name: 'Refresh upcoming releases' };
    case 'refresh_habits_streaks':
      return { id: 'refreshHabitsStreaks', name: 'Refresh habits streaks' };
    default:
      return null;
  }
};

const runManualJobWithActivity = async <T>(
  job: { id: string; name: string },
  userId: number,
  fn: () => Promise<T>
): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    await logActivity({
      type: 'cron_job_ended',
      userId,
      payload: { job_id: job.id, job_name: job.name, success: true, duration_ms: durationMs, trigger: 'manual' },
    });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Unknown error';
    await logActivity({
      type: 'cron_job_ended',
      userId,
      payload: {
        job_id: job.id,
        job_name: job.name,
        success: false,
        duration_ms: durationMs,
        trigger: 'manual',
        message,
      },
    });
    throw error;
  }
};

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
          id: 'fetchC411Stats',
          name: 'Fetch C411 stats',
          next_run_time: null,
          trigger: '0 * * * *',
          func: 'fetch_c411_stats',
        },
        {
          id: 'fetchTorr9Stats',
          name: 'Fetch Torr9 stats',
          next_run_time: null,
          trigger: '0 * * * *',
          func: 'fetch_torr9_stats',
        },
        {
          id: 'fetchLaCaleStats',
          name: 'Fetch La Cale stats',
          next_run_time: null,
          trigger: '0 * * * *',
          func: 'fetch_la_cale_stats',
        },
        {
          id: 'refreshUpcoming',
          name: 'Refresh upcoming releases',
          next_run_time: null,
          trigger: '30 */12 * * *',
          func: 'refresh_upcoming',
        },
        {
          id: 'refreshHabitsStreaks',
          name: 'Refresh habits streaks',
          next_run_time: null,
          trigger: '*/15 * * * *',
          func: 'refresh_habits_streaks',
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
      const adminUser = user!;

      try {
        const job = resolveAdminActionJob(body.action);
        if (job) {
          await logActivity({
            type: 'admin_triggered_job',
            userId: adminUser.id,
            payload: { action: body.action, job_id: job.id, job_name: job.name },
          });
        }

        switch (body.action) {
          case 'check_reminders': {
            await runManualJobWithActivity(
              { id: 'checkReminders', name: 'Check reminders' },
              adminUser.id,
              checkAndSendReminders
            );
            return { success: true, message: 'Reminders check executed' };
          }
          case 'check_all_day_events': {
            await runManualJobWithActivity(
              { id: 'checkAllDayEvents', name: 'Check all-day events' },
              adminUser.id,
              checkAndSendAllDayEventNotifications
            );
            return { success: true, message: 'All-day events check executed' };
          }
          case 'cleanup_notifications': {
            const deleted = await runManualJobWithActivity(
              { id: 'cleanupNotifications', name: 'Cleanup old notifications' },
              adminUser.id,
              cleanupOldNotifications
            );
            return { success: true, message: `Cleanup executed (${deleted} deleted)` };
          }
          case 'fetch_c411_stats': {
            await fetchTrackerStats('c411', { trigger: 'manual' });
            return { success: true, message: 'C411 stats fetched' };
          }
          case 'fetch_torr9_stats': {
            await fetchTrackerStats('torr9', { trigger: 'manual' });
            return { success: true, message: 'Torr9 stats fetched' };
          }
          case 'fetch_la_cale_stats': {
            await fetchTrackerStats('la-cale', { trigger: 'manual' });
            return { success: true, message: 'La Cale stats fetched' };
          }
          case 'refresh_upcoming': {
            await refreshUpcoming({ trigger: 'manual' });
            return { success: true, message: 'Upcoming releases refreshed' };
          }
          case 'refresh_habits_streaks': {
            await refreshHabitsStreaks({ trigger: 'manual' });
            return { success: true, message: 'Habits streaks refreshed' };
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

  // POST /api/admin/invitations - Send an invitation email
  .post(
    '/invitations',
    async ({ user, body, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      try {
        const emailTrimmed = (body.email || '').trim().toLowerCase();

        if (!emailTrimmed) {
          set.status = 400;
          return { error: 'Email is required' };
        }

        if (!validateEmail(emailTrimmed)) {
          set.status = 400;
          return { error: 'Invalid email format' };
        }

        const sanitizedEmail = sanitizeInput(emailTrimmed);

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: { email: sanitizedEmail },
        });

        if (existingUser) {
          set.status = 400;
          return { error: 'A user with this email already exists' };
        }

        // Check if there is already a pending, non-expired invitation
        const existingInvitation = await prisma.invitation.findFirst({
          where: {
            email: sanitizedEmail,
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvitation) {
          set.status = 400;
          return { error: 'A pending invitation already exists for this email. You can resend it instead.' };
        }

        // Generate secure token
        const token = generateOpaqueToken();

        const locale = (body.locale || 'en').trim().slice(0, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = await prisma.invitation.create({
          data: {
            email: sanitizedEmail,
            token: hashOpaqueToken(token),
            status: 'pending',
            expiresAt,
            invitedBy: user!.id,
            locale,
            isAdmin: body.is_admin || false,
          },
        });

        // Build inviter display name
        const inviterName = [user!.first_name, user!.last_name].filter(Boolean).join(' ') || user!.email;

        await sendInvitationEmail(sanitizedEmail, token, inviterName, locale);

        console.log(`Admin ${user!.email} invited ${sanitizedEmail}`);

        set.status = 201;
        return {
          success: true,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            status: invitation.status,
            is_admin: invitation.isAdmin,
            locale: invitation.locale,
            expires_at: invitation.expiresAt.toISOString(),
            created_at: invitation.createdAt.toISOString(),
            accepted_at: null,
          },
        };
      } catch (error) {
        console.error('Error sending invitation:', error);
        set.status = 500;
        return { error: 'Failed to send invitation' };
      }
    },
    {
      body: t.Object({
        email: t.String(),
        is_admin: t.Optional(t.Boolean()),
        locale: t.Optional(t.String()),
      }),
    }
  )

  // GET /api/admin/invitations - List all invitations
  .get('/invitations', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    try {
      const invitations = await prisma.invitation.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          inviter: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      });

      const now = new Date();

      return {
        success: true,
        invitations: invitations.map(inv => ({
          id: inv.id,
          email: inv.email,
          status: inv.status === 'pending' && inv.expiresAt < now ? 'expired' : inv.status,
          is_admin: inv.isAdmin,
          locale: inv.locale,
          expires_at: inv.expiresAt.toISOString(),
          created_at: inv.createdAt.toISOString(),
          accepted_at: inv.acceptedAt?.toISOString() || null,
          invited_by_email: inv.inviter.email,
          invited_by_name: [inv.inviter.firstName, inv.inviter.lastName].filter(Boolean).join(' ') || null,
        })),
      };
    } catch (error) {
      console.error('Error listing invitations:', error);
      set.status = 500;
      return { error: 'Failed to list invitations' };
    }
  })

  // POST /api/admin/invitations/:id/resend - Resend an invitation
  .post(
    '/invitations/:id/resend',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: 'Invalid invitation ID' };
      }

      try {
        const invitation = await prisma.invitation.findFirst({
          where: { id },
        });

        if (!invitation) {
          set.status = 404;
          return { error: 'Invitation not found' };
        }

        if (invitation.status !== 'pending') {
          set.status = 400;
          return { error: 'Can only resend pending invitations' };
        }

        // Generate new token and reset expiry
        const token = generateOpaqueToken();

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.invitation.update({
          where: { id },
          data: { token: hashOpaqueToken(token), expiresAt },
        });

        const inviterName = [user!.first_name, user!.last_name].filter(Boolean).join(' ') || user!.email;

        await sendInvitationEmail(invitation.email, token, inviterName, invitation.locale);

        console.log(`Admin ${user!.email} resent invitation to ${invitation.email}`);

        return { success: true, message: 'Invitation resent' };
      } catch (error) {
        console.error('Error resending invitation:', error);
        set.status = 500;
        return { error: 'Failed to resend invitation' };
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // DELETE /api/admin/invitations/:id - Revoke an invitation
  .delete(
    '/invitations/:id',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: 'Invalid invitation ID' };
      }

      try {
        const invitation = await prisma.invitation.findFirst({
          where: { id },
        });

        if (!invitation) {
          set.status = 404;
          return { error: 'Invitation not found' };
        }

        if (invitation.status !== 'pending') {
          set.status = 400;
          return { error: 'Can only revoke pending invitations' };
        }

        await prisma.invitation.update({
          where: { id },
          data: { status: 'revoked' },
        });

        console.log(`Admin ${user!.email} revoked invitation for ${invitation.email}`);

        return { success: true, message: 'Invitation revoked' };
      } catch (error) {
        console.error('Error revoking invitation:', error);
        set.status = 500;
        return { error: 'Failed to revoke invitation' };
      }
    },
    { params: t.Object({ id: t.String() }) }
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

  // GET /api/admin/sessions - List all active refresh tokens (sessions)
  .get('/sessions', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    try {
      const tokens = await prisma.refreshToken.findMany({
        where: { revoked: false, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        sessions: tokens.map(t => ({
          id: t.id,
          user_id: t.userId,
          user_email: t.user.email,
          user_name: [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || null,
          expires_at: t.expiresAt.toISOString(),
          created_at: t.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      console.error('Error listing sessions:', error);
      set.status = 500;
      return { error: 'Failed to list sessions' };
    }
  })

  // DELETE /api/admin/sessions/:id - Revoke a specific session
  .delete(
    '/sessions/:id',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: 'Invalid session ID' };
      }

      try {
        await prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
        return { success: true, message: 'Session revoked' };
      } catch (error) {
        console.error('Error revoking session:', error);
        set.status = 500;
        return { error: 'Failed to revoke session' };
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // DELETE /api/admin/sessions/user/:userId - Revoke all sessions for a user
  .delete(
    '/sessions/user/:userId',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const userId = parseInt(params.userId, 10);
      if (isNaN(userId)) {
        set.status = 400;
        return { error: 'Invalid user ID' };
      }

      try {
        await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
        return { success: true, message: 'All sessions revoked' };
      } catch (error) {
        console.error('Error revoking user sessions:', error);
        set.status = 500;
        return { error: 'Failed to revoke sessions' };
      }
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // GET /api/admin/push-tokens - List all iOS/mobile push tokens
  .get('/push-tokens', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    try {
      const tokens = await prisma.pushToken.findMany({
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        push_tokens: tokens.map(t => ({
          id: t.id,
          user_id: t.userId,
          user_email: t.user.email,
          user_name: [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || null,
          token: t.token.slice(0, 12) + '...',
          platform: t.platform,
          created_at: t.createdAt.toISOString(),
          updated_at: t.updatedAt?.toISOString() ?? null,
        })),
      };
    } catch (error) {
      console.error('Error listing push tokens:', error);
      set.status = 500;
      return { error: 'Failed to list push tokens' };
    }
  })

  // DELETE /api/admin/push-tokens/:id - Delete a push token
  .delete(
    '/push-tokens/:id',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: 'Invalid token ID' };
      }

      try {
        await prisma.pushToken.delete({ where: { id } });
        return { success: true, message: 'Push token deleted' };
      } catch (error) {
        console.error('Error deleting push token:', error);
        set.status = 500;
        return { error: 'Failed to delete push token' };
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /api/admin/web-push - List all web push subscriptions
  .get('/web-push', async ({ user, set }) => {
    if (!adminOnly(user, set)) {
      return { error: user ? 'Forbidden' : 'Unauthorized' };
    }

    try {
      const subs = await prisma.userSubscription.findMany({
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        subscriptions: subs.map(s => ({
          id: s.id,
          user_id: s.userId,
          user_email: s.user.email,
          user_name: [s.user.firstName, s.user.lastName].filter(Boolean).join(' ') || null,
          endpoint: s.endpoint ? s.endpoint.slice(0, 40) + '...' : null,
          device_name: s.deviceName,
          os_name: s.osName,
          os_version: s.osVersion,
          browser_name: s.browserName,
          browser_version: s.browserVersion,
          platform: s.platform,
          created_at: s.createdAt?.toISOString() ?? null,
          updated_at: s.updatedAt?.toISOString() ?? null,
        })),
      };
    } catch (error) {
      console.error('Error listing web push subscriptions:', error);
      set.status = 500;
      return { error: 'Failed to list web push subscriptions' };
    }
  })

  // DELETE /api/admin/web-push/:id - Delete a web push subscription
  .delete(
    '/web-push/:id',
    async ({ user, params, set }) => {
      if (!adminOnly(user, set)) {
        return { error: user ? 'Forbidden' : 'Unauthorized' };
      }

      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: 'Invalid subscription ID' };
      }

      try {
        await prisma.userSubscription.delete({ where: { id } });
        return { success: true, message: 'Web push subscription deleted' };
      } catch (error) {
        console.error('Error deleting web push subscription:', error);
        set.status = 500;
        return { error: 'Failed to delete web push subscription' };
      }
    },
    { params: t.Object({ id: t.String() }) }
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
                  choreName: choreData.chore_name ?? '',
                  description: choreData.description ?? null,
                  assignedTo: assignedToId,
                  completed: choreData.completed || false,
                  addedBy: addedById,
                  completedBy: completedById,
                  reminderEnabled: choreData.reminder_enabled || false,
                  imagePath: choreData.image_path ?? null,
                  recurrenceType: choreData.recurrence_type ?? null,
                  recurrenceIntervalDays: choreData.recurrence_interval_days ?? null,
                  recurrenceWeekday: choreData.recurrence_weekday ?? null,
                  recurrenceOriginalCreatedAt: choreData.recurrence_original_created_at ?? null,
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
              if (oldId !== undefined && oldParentId != null && choreIdMapping.has(oldId)) {
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
                  itemName: itemData.item_name ?? '',
                  notes: itemData.notes ?? null,
                  completed: itemData.completed || false,
                  addedBy: addedById,
                  completedBy: completedById,
                  completedAt: itemData.completed_at ?? null,
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
                  taskType: completionData.task_type ?? '',
                  taskId: completionData.task_id ?? 0,
                  completedAt: completionData.completed_at || nowUtc(),
                  taskName: completionData.task_name ?? '',
                  emotion: completionData.emotion ?? null,
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
        chores: t.Optional(
          t.Array(
            t.Object({
              id: t.Optional(t.Number()),
              chore_name: t.Optional(t.String()),
              description: t.Optional(t.Union([t.String(), t.Null()])),
              added_by_email: t.Optional(t.Union([t.String(), t.Null()])),
              assigned_to_email: t.Optional(t.Union([t.String(), t.Null()])),
              completed_by_email: t.Optional(t.Union([t.String(), t.Null()])),
              completed: t.Optional(t.Boolean()),
              reminder_enabled: t.Optional(t.Boolean()),
              image_path: t.Optional(t.Union([t.String(), t.Null()])),
              recurrence_type: t.Optional(t.Union([t.String(), t.Null()])),
              recurrence_interval_days: t.Optional(t.Union([t.Number(), t.Null()])),
              recurrence_weekday: t.Optional(t.Union([t.Number(), t.Null()])),
              recurrence_original_created_at: t.Optional(t.Union([t.String(), t.Null()])),
              recurrence_parent_id: t.Optional(t.Union([t.Number(), t.Null()])),
            })
          )
        ),
        reminders: t.Optional(
          t.Array(
            t.Object({
              chore_id: t.Number(),
              reminder_datetime: t.String(),
              user_email: t.Optional(t.Union([t.String(), t.Null()])),
              active: t.Optional(t.Boolean()),
              last_notification_sent: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
        shopping_items: t.Optional(
          t.Array(
            t.Object({
              item_name: t.Optional(t.String()),
              notes: t.Optional(t.Union([t.String(), t.Null()])),
              completed: t.Optional(t.Boolean()),
              added_by_email: t.Optional(t.Union([t.String(), t.Null()])),
              completed_by_email: t.Optional(t.Union([t.String(), t.Null()])),
              completed_at: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
        task_completions: t.Optional(
          t.Array(
            t.Object({
              user_email: t.Optional(t.Union([t.String(), t.Null()])),
              task_type: t.Optional(t.String()),
              task_id: t.Optional(t.Union([t.Number(), t.Null()])),
              completed_at: t.Optional(t.Union([t.String(), t.Null()])),
              task_name: t.Optional(t.Union([t.String(), t.Null()])),
              emotion: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
      }),
    }
  );
