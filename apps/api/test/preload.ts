import { mock } from 'bun:test';

// Mock ioredis Redis singleton so it doesn't try to connect
mock.module('../src/db/redis', () => {
  const mockRedis = {
    on: function(this: any) { return this; },
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    expire: async () => 0,
    send: async () => null,
    quit: async () => {},
  };
  return {
    redis: mockRedis,
    redisConnection: { host: 'localhost', port: 6379, db: 0, maxRetriesPerRequest: null },
  };
});

// Mock queueService so BullMQ never tries to connect to Redis
const mockQueue = { add: async () => null, close: async () => {} };
mock.module('../src/services/queueService', () => ({
  QUEUE_NAMES: {
    DEFAULT: 'default',
    NOTIFICATIONS: 'notifications',
    MEDIA_CONVERSIONS: 'media-conversions',
    SCHEDULED_TASKS: 'scheduled-tasks',
    ACTIVITY_LOGS: 'activity-logs',
    C411_PREPARE: 'c411-prepare',
  },
  SCHEDULED_JOB_NAMES: {
    CHECK_REMINDERS: 'check-reminders',
    CHECK_ALL_DAY_EVENTS: 'check-all-day-events',
    CLEANUP_NOTIFICATIONS: 'cleanup-notifications',
  },
  defaultQueue: mockQueue,
  notificationsQueue: mockQueue,
  mediaConversionsQueue: mockQueue,
  scheduledTasksQueue: mockQueue,
  activityLogsQueue: mockQueue,
  c411PrepareQueue: mockQueue,
  addJob: async () => null,
  initWorkers: () => {},
  setupScheduledJobs: async () => {},
}));

// Mock Bun's RedisClient so tests don't try to connect to a real Redis instance
mock.module('../src/services/cache', () => ({
  getJsonCache: async (_key: string) => null,
  setJsonCache: async (_key: string, _value: unknown, _ttl: number) => {},
  deleteCache: async (_key: string) => {},
}));

// Suppress Prisma connection errors when DATABASE_URL is not set
mock.module('../src/db', () => ({
  prisma: new Proxy({}, {
    get(_target, prop) {
      return new Proxy(() => {}, {
        get(_t, p) {
          return () => Promise.resolve(null);
        },
        apply() {
          return Promise.resolve(null);
        },
      });
    },
  }),
}));
