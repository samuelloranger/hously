import { RedisClient } from "bun";
import { getRedisUrl } from "../config";

let redisClient: RedisClient | null = null;
let redisDisabled = false;

const getRedisClient = (): RedisClient | null => {
  if (redisDisabled) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = new RedisClient(getRedisUrl());
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    console.error("Failed to initialize Redis client:", error);
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

export const setJsonCache = async <T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value));
    await client.expire(key, ttlSeconds);
  } catch (error) {
    console.warn(`Redis set failed for key ${key}:`, error);
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.send('DEL', [key]);
  } catch (error) {
    console.warn(`Redis delete failed for key ${key}:`, error);
  }
};
