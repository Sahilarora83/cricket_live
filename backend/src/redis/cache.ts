import { Redis } from "ioredis";
import { env } from "../config/env.js";

type CacheValue = string;

class CacheClient {
  private redis?: Redis;
  private memory = new Map<string, CacheValue>();
  private redisReady = false;

  constructor() {
    if (!env.REDIS_URL) return;

    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });

    this.redis.on("ready", () => {
      this.redisReady = true;
      console.log("Redis connected.");
    });

    this.redis.on("error", (error: Error) => {
      this.redisReady = false;
      console.warn(`Redis unavailable, using memory cache: ${error.message}`);
    });
  }

  async connect() {
    if (!this.redis) return;
    try {
      await this.redis.connect();
    } catch {
      this.redisReady = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = this.redisReady && this.redis ? await this.redis.get(key) : this.memory.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const serialized = JSON.stringify(value);

    if (this.redisReady && this.redis) {
      if (ttlSeconds) {
        await this.redis.set(key, serialized, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
      return;
    }

    this.memory.set(key, serialized);
    if (ttlSeconds) {
      setTimeout(() => this.memory.delete(key), ttlSeconds * 1000).unref();
    }
  }
}

export const cache = new CacheClient();
