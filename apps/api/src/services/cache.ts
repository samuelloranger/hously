import { RedisClient } from 'bun';

let redisClient: RedisClient | null = null;
let redisDisabled = false;

const getRedisUrl = (): string => {
  const explicitUrl = process.env.REDIS_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const host = process.env.REDIS_HOST?.trim() || 'redis';
  const port = process.env.REDIS_PORT?.trim() || '6379';
  const password = process.env.REDIS_PASSWORD?.trim();
  const db = process.env.REDIS_DB?.trim() || '0';

  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  }

  return `redis://${host}:${port}/${db}`;
};

const getRedisClient = (): RedisClient | null => {
  if (redisDisabled) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = new RedisClient(getRedisUrl());
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
};

export const getJsonCache = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const cached = await client.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error) {
    console.warn(`Redis get failed for key ${key}:`, error);
    return null;
  }
};

export const setJsonCache = async <T>(key: string, value: T, ttlSeconds: number): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value));
    await client.expire(key, ttlSeconds);
  } catch (error) {
    console.warn(`Redis set failed for key ${key}:`, error);
  }
};
