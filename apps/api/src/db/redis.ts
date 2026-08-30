import Redis from "ioredis";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: false,
});

redis.on("error", (err) => console.warn("[redis] error:", err.message));
redis.on("connect", () => console.log("[redis] ✅ connected"));

export const setSession = (token: string, payload: object, ttlSeconds = 86400) =>
  redis.setex(`session:${token}`, ttlSeconds, JSON.stringify(payload));

export const getSession = async (token: string) => {
  const data = await redis.get(`session:${token}`);
  return data ? JSON.parse(data) : null;
};

export const deleteSession = (token: string) =>
  redis.del(`session:${token}`);

export const setCooldown = (key: string, ttlSeconds: number) =>
  redis.setex(`cooldown:${key}`, ttlSeconds, "1");

export const hasCooldown = async (key: string) =>
  !!(await redis.get(`cooldown:${key}`));

export const setCache = (key: string, value: object, ttlSeconds = 300) =>
  redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));

export const getCache = async (key: string) => {
  const data = await redis.get(`cache:${key}`);
  return data ? JSON.parse(data) : null;
};

export const invalidateCache = async (pattern: string) => {
  const keys = await redis.keys(`cache:${pattern}*`);
  return keys.length ? redis.del(...keys) : 0;
};

export default redis;
