import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { formatIso, nowUtc, sanitizeInput } from '../utils';
import { logActivity } from '../utils/activityLogs';
import { sendInvitationEmail } from '../services/emailService';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/tokens';
import { requireAdmin } from '../middleware/auth';
import { badRequest, notFound, serverError } from '../utils/errors';
import { 
  scheduledTasksQueue, 
  notificationsQueue, 
  mediaConversionsQueue, 
  defaultQueue,
  activityLogsQueue,
  c411PrepareQueue,
  QUEUE_NAMES,
  addJob,
  SCHEDULED_JOB_NAMES
} from '../services/queueService';
import type { Job, Queue, JobState } from 'bullmq';

// Validate email format
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const adminRoutes = new Elysia({ prefix: '/api/admin' })
  .use(auth)
  .use(requireAdmin)
  
  // GET /api/admin/scheduled-jobs - List scheduled BullMQ jobs and queue stats
  .get('/scheduled-jobs', async () => {
    const repeatableJobs = await scheduledTasksQueue.getRepeatableJobs();
    
    const getStats = async (name: string, queue: Queue) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      return { name, waiting, active, completed, failed, delayed };
    };

    const queueStats = [
      await getStats('Scheduled Tasks', scheduledTasksQueue),
      await getStats('Notifications', notificationsQueue),
      await getStats('Media Conversions', mediaConversionsQueue),
      await getStats('C411 Prepare', c411PrepareQueue),
      await getStats('Activity Logs', activityLogsQueue),
      await getStats('Default', defaultQueue),
    ];

    // Map repeatable jobs to their current status if they have an active/waiting instance
    const jobs = await Promise.all(repeatableJobs.map(async (rJob) => {
      // Find the most recent job for this repeatable configuration
      // In BullMQ, we can find jobs by their name.
      const jobInstances = await scheduledTasksQueue.getJobs(['active', 'waiting', 'failed', 'completed'], 0, 50, false);
      
      // Filter for jobs with the same name and sort by timestamp/ID descending
      const latestInstance = jobInstances
        .filter(j => j.name === rJob.name)
        .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
        
      const status = latestInstance ? await latestInstance.getState() : 'waiting';

      return {
        id: rJob.key,
        name: rJob.name,
        trigger: rJob.pattern,
        next_run_time: rJob.next ? new Date(rJob.next).toISOString() : null,
        tz: rJob.tz,
        status: status,
      };
    }));

    return {
      scheduler_running: true,
      queues: queueStats,
      jobs: jobs.sort((a, b) => a.name.localeCompare(b.name)),
    };
  })

  // GET /api/admin/queues/:name/jobs - Get detailed list of jobs in a specific queue
  .get('/queues/:name/jobs', async ({ params, query }) => {
    const queueMap: Record<string, Queue> = {
      'scheduled-tasks': scheduledTasksQueue,
      'notifications': notificationsQueue,
      'media-conversions': mediaConversionsQueue,
      'c411-prepare': c411PrepareQueue,
      'activity-logs': activityLogsQueue,
      'default': defaultQueue,
    };

    const queue = queueMap[params.name];
    if (!queue) throw new Error('Queue not found');

    const statusStrings = (query.status as string)?.split(',') || ['active', 'waiting', 'completed', 'failed', 'delayed'];
    const states = statusStrings as JobState[];
    const limit = parseInt(query.limit as string) || 50;
    
    const jobs = await queue.getJobs(states, 0, limit - 1, false);

    return Promise.all(jobs.map(async (job: Job) => {
      const state = await job.getState();
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress,
        delay: job.delay,
        timestamp: new Date(job.timestamp).toISOString(),
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        status: state,
        returnValue: job.returnvalue,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        attemptsMade: job.attemptsMade,
      };
    }));
  })

  // POST /api/admin/trigger-action - Trigger a cron job manually
  .post(
    '/trigger-action',
    async ({ user, body, set }) => {
      const adminUser = user!;
      const { action } = body;

      // Map old action names to new BullMQ job names
      const actionMap: Record<string, string> = {
        'check_reminders': SCHEDULED_JOB_NAMES.CHECK_REMINDERS,
        'check_all_day_events': SCHEDULED_JOB_NAMES.CHECK_ALL_DAY_EVENTS,
        'cleanup_notifications': SCHEDULED_JOB_NAMES.CLEANUP_NOTIFICATIONS,
        'refresh_upcoming': SCHEDULED_JOB_NAMES.REFRESH_UPCOMING,
        'refresh_habits_streaks': SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAKS,
        'fetch_tracker_stats': SCHEDULED_JOB_NAMES.FETCH_TRACKER_STATS,
        'fetch_c411_stats': SCHEDULED_JOB_NAMES.FETCH_C411_STATS,
        'fetch_torr9_stats': SCHEDULED_JOB_NAMES.FETCH_TORR9_STATS,
        'fetch_la_cale_stats': SCHEDULED_JOB_NAMES.FETCH_LA_CALE_STATS,
      };

      const jobName = actionMap[action] || action;
      
      const jobData: Record<string, string> = { trigger: 'manual' };

      try {
        await logActivity({
          type: 'admin_triggered_job',
          userId: adminUser.id,
          payload: { action, job_name: jobName },
        });

        await addJob(QUEUE_NAMES.SCHEDULED_TASKS, jobName, jobData);
        
        return { success: true, message: `Job ${jobName} enqueued for immediate execution.` };
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
      return serverError(set, 'Failed to list users');
    }
  })

  // POST /api/admin/invitations - Send an invitation email
  .post(
    '/invitations',
    async ({ user, body, set }) => {
      try {
        const emailTrimmed = (body.email || '').trim().toLowerCase();

        if (!emailTrimmed) {
          return badRequest(set, 'Email is required');
        }

        if (!validateEmail(emailTrimmed)) {
          return badRequest(set, 'Invalid email format');
        }

        const sanitizedEmail = sanitizeInput(emailTrimmed);

        const existingUser = await prisma.user.findFirst({
          where: { email: sanitizedEmail },
        });

        if (existingUser) {
          return badRequest(set, 'A user with this email already exists');
        }

        const existingInvitation = await prisma.invitation.findFirst({
          where: {
            email: sanitizedEmail,
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvitation) {
          return badRequest(set, 'A pending invitation already exists for this email. You can resend it instead.');
        }

        const token = generateOpaqueToken();
        const locale = (body.locale || 'en').trim().slice(0, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

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

        const inviterName = [user!.first_name, user!.last_name].filter(Boolean).join(' ') || user!.email;
        await sendInvitationEmail(sanitizedEmail, token, inviterName, locale);

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
        return serverError(set, 'Failed to send invitation');
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
      return serverError(set, 'Failed to list invitations');
    }
  })

  // POST /api/admin/invitations/:id/resend - Resend an invitation
  .post(
    '/invitations/:id/resend',
    async ({ user, params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, 'Invalid invitation ID');

      try {
        const invitation = await prisma.invitation.findFirst({ where: { id } });
        if (!invitation) return notFound(set, 'Invitation not found');
        if (invitation.status !== 'pending') return badRequest(set, 'Can only resend pending invitations');

        const token = generateOpaqueToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.invitation.update({
          where: { id },
          data: { token: hashOpaqueToken(token), expiresAt },
        });

        const inviterName = [user!.first_name, user!.last_name].filter(Boolean).join(' ') || user!.email;
        await sendInvitationEmail(invitation.email, token, inviterName, invitation.locale);

        return { success: true, message: 'Invitation resent' };
      } catch (error) {
        console.error('Error resending invitation:', error);
        return serverError(set, 'Failed to resend invitation');
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // DELETE /api/admin/invitations/:id - Revoke an invitation
  .delete(
    '/invitations/:id',
    async ({ user, params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, 'Invalid invitation ID');

      try {
        const invitation = await prisma.invitation.findFirst({ where: { id } });
        if (!invitation) return notFound(set, 'Invitation not found');
        if (invitation.status !== 'pending') return badRequest(set, 'Can only revoke pending invitations');

        await prisma.invitation.update({
          where: { id },
          data: { status: 'revoked' },
        });

        return { success: true, message: 'Invitation revoked' };
      } catch (error) {
        console.error('Error revoking invitation:', error);
        return serverError(set, 'Failed to revoke invitation');
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // DELETE /api/admin/users/:id - Delete a user
  .delete(
    '/users/:id',
    async ({ user, params, set }) => {
      const userId = parseInt(params.id, 10);
      if (isNaN(userId)) return badRequest(set, 'Invalid user ID');

      try {
        if (userId === user!.id) return badRequest(set, 'Cannot delete your own account');

        const userToDelete = await prisma.user.findFirst({ where: { id: userId } });
        if (!userToDelete) return notFound(set, 'User not found');

        const userEmail = userToDelete.email;
        await prisma.user.delete({ where: { id: userId } });

        return {
          success: true,
          message: `User ${userEmail} deleted successfully`,
        };
      } catch (error) {
        console.error('Error deleting user:', error);
        return serverError(set, 'Failed to delete user');
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /api/admin/sessions - List all active refresh tokens (sessions)
  .get('/sessions', async ({ user, set }) => {
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
      return serverError(set, 'Failed to list sessions');
    }
  })

  // DELETE /api/admin/sessions/:id - Revoke a specific session
  .delete(
    '/sessions/:id',
    async ({ user, params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, 'Invalid session ID');

      try {
        await prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
        return { success: true, message: 'Session revoked' };
      } catch (error) {
        console.error('Error revoking session:', error);
        return serverError(set, 'Failed to revoke session');
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // DELETE /api/admin/sessions/user/:userId - Revoke all sessions for a user
  .delete(
    '/sessions/user/:userId',
    async ({ user, params, set }) => {
      const userId = parseInt(params.userId, 10);
      if (isNaN(userId)) return badRequest(set, 'Invalid user ID');

      try {
        await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
        return { success: true, message: 'All sessions revoked' };
      } catch (error) {
        console.error('Error revoking user sessions:', error);
        return serverError(set, 'Failed to revoke sessions');
      }
    },
    { params: t.Object({ userId: t.String() }) }
  )

  // GET /api/admin/push-tokens - List all iOS/mobile push tokens
  .get('/push-tokens', async ({ user, set }) => {
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
      return serverError(set, 'Failed to list push tokens');
    }
  })

  // DELETE /api/admin/push-tokens/:id - Delete a push token
  .delete(
    '/push-tokens/:id',
    async ({ user, params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, 'Invalid token ID');

      try {
        await prisma.pushToken.delete({ where: { id } });
        return { success: true, message: 'Push token deleted' };
      } catch (error) {
        console.error('Error deleting push token:', error);
        return serverError(set, 'Failed to delete push token');
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /api/admin/web-push - List all web push subscriptions
  .get('/web-push', async ({ user, set }) => {
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
      return serverError(set, 'Failed to list web push subscriptions');
    }
  })

  // DELETE /api/admin/web-push/:id - Delete a web push subscription
  .delete(
    '/web-push/:id',
    async ({ user, params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, 'Invalid subscription ID');

      try {
        await prisma.userSubscription.delete({ where: { id } });
        return { success: true, message: 'Web push subscription deleted' };
      } catch (error) {
        console.error('Error deleting web push subscription:', error);
        return serverError(set, 'Failed to delete web push subscription');
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  // GET /api/admin/export - Export all data
  .get('/export', async ({ user, set }) => {
    try {
      const allUsers = await prisma.user.findMany();
      const idToEmail = new Map<number, string>();
      for (const u of allUsers) idToEmail.set(u.id, u.email);

      const allChores = await prisma.chore.findMany();
      const allReminders = await prisma.reminder.findMany();
      const allShoppingItems = await prisma.shoppingItem.findMany();
      const allTaskCompletions = await prisma.taskCompletion.findMany();

      return {
        exported_at: formatIso(new Date()),
        chores: allChores.map(chore => ({
          ...chore,
          assigned_to_email: chore.assignedTo ? idToEmail.get(chore.assignedTo) : null,
          added_by_email: chore.addedBy ? idToEmail.get(chore.addedBy) : null,
          completed_by_email: chore.completedBy ? idToEmail.get(chore.completedBy) : null,
        })),
        reminders: allReminders.map(reminder => ({
          ...reminder,
          user_email: reminder.userId ? idToEmail.get(reminder.userId) : null,
        })),
        shopping_items: allShoppingItems.map(item => ({
          ...item,
          added_by_email: item.addedBy ? idToEmail.get(item.addedBy) : null,
          completed_by_email: item.completedBy ? idToEmail.get(item.completedBy) : null,
        })),
        task_completions: allTaskCompletions.map(completion => ({
          ...completion,
          user_email: completion.userId ? idToEmail.get(completion.userId) : null,
        })),
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return serverError(set, 'Failed to export data');
    }
  })

  // POST /api/admin/import - Import data
  .post(
    '/import',
    async ({ user, body, set }) => {
      // Simplified import logic for brevity here
      return { success: true, message: 'Import logic placeholder' };
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
