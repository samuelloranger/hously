import { Queue, Worker, type Job, type QueueOptions, type JobsOptions } from 'bullmq';
import { redisConnection } from '../db/redis';

// Define queue names
export const QUEUE_NAMES = {
  DEFAULT: 'default',
  NOTIFICATIONS: 'notifications',
  MEDIA_CONVERSIONS: 'media-conversions',
  SCHEDULED_TASKS: 'scheduled-tasks',
  ACTIVITY_LOGS: 'activity-logs',
  C411_PREPARE: 'c411-prepare',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Job names for Scheduled Tasks
export const SCHEDULED_JOB_NAMES = {
  CHECK_REMINDERS: 'check-reminders',
  CHECK_ALL_DAY_EVENTS: 'check-all-day-events',
  CLEANUP_NOTIFICATIONS: 'cleanup-notifications',
  FETCH_TRACKER_STATS: 'fetch-tracker-stats',
  FETCH_C411_STATS: 'fetch-c411-stats',
  FETCH_TORR9_STATS: 'fetch-torr9-stats',
  FETCH_LA_CALE_STATS: 'fetch-la-cale-stats',
  CHECK_HABIT_REMINDERS: 'check-habit-reminders',
  REFRESH_UPCOMING: 'refresh-upcoming',
  REFRESH_HABITS_STREAKS: 'refresh-habits-streaks',
  REFRESH_HABITS_STREAK_FOR_USER: 'refresh-habits-streak-for-user',
  CHECK_CLOCKIFY_HOURS: 'check-clockify-hours',
} as const;

// Job names for Notifications queue
export const NOTIFICATION_JOB_NAMES = {
  SEND_NOTIFICATION: 'send-notification',
  SILENT_PUSH: 'silent-push',
} as const;

const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { age: 24 * 3600 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
};

// Initialize Queues
export const defaultQueue = new Queue(QUEUE_NAMES.DEFAULT, defaultQueueOptions);
export const notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, defaultQueueOptions);
export const mediaConversionsQueue = new Queue(QUEUE_NAMES.MEDIA_CONVERSIONS, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 1,
  },
});
export const scheduledTasksQueue = new Queue(QUEUE_NAMES.SCHEDULED_TASKS, defaultQueueOptions);
export const activityLogsQueue = new Queue(QUEUE_NAMES.ACTIVITY_LOGS, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 2,
    removeOnComplete: true,
  },
});
export const c411PrepareQueue = new Queue(QUEUE_NAMES.C411_PREPARE, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 1, // Heavy process
  }
});

const queues: Record<QueueName, Queue> = {
  [QUEUE_NAMES.DEFAULT]: defaultQueue,
  [QUEUE_NAMES.NOTIFICATIONS]: notificationsQueue,
  [QUEUE_NAMES.MEDIA_CONVERSIONS]: mediaConversionsQueue,
  [QUEUE_NAMES.SCHEDULED_TASKS]: scheduledTasksQueue,
  [QUEUE_NAMES.ACTIVITY_LOGS]: activityLogsQueue,
  [QUEUE_NAMES.C411_PREPARE]: c411PrepareQueue,
};

/**
 * Utility to add a job to a specific queue
 */
export async function addJob<T = Record<string, unknown>>(
  queueName: QueueName, 
  jobName: string, 
  data: T, 
  opts?: JobsOptions
) {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);
  return queue.add(jobName, data, opts);
}

/**
 * Initialize Workers
 */
export function initWorkers() {
  console.log('🚀 Initializing BullMQ workers...');

  // 1. Notifications Worker
  new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job) => {
      const { processNotificationJob } = await import('./jobs/notificationWorker');
      return processNotificationJob(job);
    },
    { connection: redisConnection, concurrency: 5 }
  );

  // 2. Media Conversions Worker
  new Worker(
    QUEUE_NAMES.MEDIA_CONVERSIONS,
    async (job: Job) => {
      const { processMediaConversionJob } = await import('./jobs/mediaConversionWorker');
      return processMediaConversionJob(job);
    },
    { connection: redisConnection, concurrency: 1 }
  );

  // 3. Scheduled Tasks Worker
  new Worker(
    QUEUE_NAMES.SCHEDULED_TASKS,
    async (job: Job) => {
      const { processScheduledJob } = await import('./jobs/scheduledTasksWorker');
      return processScheduledJob(job);
    },
    { connection: redisConnection, concurrency: 3 } // Allow a few scheduled tasks at once
  );

  // 4. Activity Logs Worker
  new Worker(
    QUEUE_NAMES.ACTIVITY_LOGS,
    async (job: Job) => {
      const { processActivityLogJob } = await import('./jobs/activityLogWorker');
      return processActivityLogJob(job);
    },
    { connection: redisConnection, concurrency: 10 }
  );

  // 5. C411 Prepare Worker
  new Worker(
    QUEUE_NAMES.C411_PREPARE,
    async (job: Job) => {
      const { processC411PrepareJob } = await import('./jobs/c411Worker');
      return processC411PrepareJob(job);
    },
    { connection: redisConnection, concurrency: 2 }
  );

  // 6. Default Worker
  new Worker(
    QUEUE_NAMES.DEFAULT,
    async (job: Job) => {
      console.log(`Processing default job: ${job.name}`);
    },
    { connection: redisConnection }
  );
}

/**
 * Setup repeatable jobs
 */
export async function setupScheduledJobs() {
  console.log('⏰ Setting up scheduled jobs...');

  const jobs = [
    { name: SCHEDULED_JOB_NAMES.CHECK_REMINDERS, pattern: '*/15 * * * *' },
    { name: SCHEDULED_JOB_NAMES.CHECK_ALL_DAY_EVENTS, pattern: '0 20 * * *' },
    { name: SCHEDULED_JOB_NAMES.CLEANUP_NOTIFICATIONS, pattern: '0 0 * * *' },
    { name: SCHEDULED_JOB_NAMES.FETCH_C411_STATS, pattern: '0 * * * *' },
    { name: SCHEDULED_JOB_NAMES.FETCH_TORR9_STATS, pattern: '5 * * * *' }, // Staggered
    { name: SCHEDULED_JOB_NAMES.FETCH_LA_CALE_STATS, pattern: '10 * * * *' }, // Staggered
    { name: SCHEDULED_JOB_NAMES.CHECK_HABIT_REMINDERS, pattern: '* * * * *' },
    { name: SCHEDULED_JOB_NAMES.REFRESH_UPCOMING, pattern: '30 */12 * * *' },
    { name: SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAKS, pattern: '*/15 * * * *' },
    { name: SCHEDULED_JOB_NAMES.CHECK_CLOCKIFY_HOURS, pattern: '0 18 * * 5' }, // Friday 6 PM UTC
  ];

  const repeatableJobs = await scheduledTasksQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await scheduledTasksQueue.removeRepeatableByKey(job.key);
  }

  for (const job of jobs) {
    await scheduledTasksQueue.add(job.name, {}, {
      repeat: { pattern: job.pattern }
    });
    console.log(`   - Scheduled ${job.name} with pattern ${job.pattern}`);
  }
}
