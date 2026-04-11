import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, RedisClientType } from "redis";

/**
 * Redis-backed sliding-window rate limiter.
 *
 * Falls back to an in-process Map when Redis is not configured or
 * unavailable, so development environments don't need Redis running.
 *
 * In production REDIS_URL must be set — the startup assertion in main.ts
 * enforces this (or you can add assertEnv("REDIS_URL") there).
 */
@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private redis: RedisClientType | null = null;
  private readonly fallback = new Map<string, number[]>();
  private redisReady = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>("REDIS_URL");
    if (!redisUrl) {
      this.logger.warn(
        "REDIS_URL not configured — rate limiter will use in-process Map (not suitable for production clusters)"
      );
      return;
    }

    try {
      this.redis = createClient({ url: redisUrl }) as RedisClientType;
      this.redis.on("error", (err: Error) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.redisReady = false;
      });
      this.redis.on("ready", () => {
        this.redisReady = true;
        this.logger.log("Redis rate limiter connected");
      });
      await this.redis.connect();
    } catch (err) {
      this.logger.error(`Redis connection failed: ${err instanceof Error ? err.message : err}`);
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis && this.redisReady) {
      await this.redis.quit();
    }
  }

  /**
   * Sliding-window counter using Redis sorted sets.
   * Returns true when the limit is exceeded.
   *
   * @param key    Unique rate-limit key (e.g. "login:user@example.com")
   * @param limit  Max hits allowed in the window
   * @param windowMs Window size in milliseconds
   */
  async isLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (this.redis && this.redisReady) {
      return this.isLimitedRedis(key, limit, windowMs);
    }
    return this.isLimitedLocal(key, limit, windowMs);
  }

  // ── Redis implementation ──────────────────────────────────────────────────

  private async isLimitedRedis(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rl:${key}`;

    try {
      // Use a pipeline for atomicity + performance
      const pipeline = this.redis!.multi();
      // Remove expired entries
      pipeline.zRemRangeByScore(redisKey, "-inf", String(windowStart));
      // Add current request
      pipeline.zAdd(redisKey, { score: now, value: `${now}-${Math.random()}` });
      // Count entries in current window
      pipeline.zCard(redisKey);
      // Set TTL so keys expire automatically
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000) + 10);

      const results = await pipeline.exec();
      // zCard result is the 3rd command (index 2)
      const count = results?.[2] as number ?? 0;
      return count > limit;
    } catch (err) {
      this.logger.error(`Redis rate-limit error: ${err instanceof Error ? err.message : err}`);
      // Fall through to in-process on Redis error
      return this.isLimitedLocal(key, limit, windowMs);
    }
  }

  // ── In-process fallback ───────────────────────────────────────────────────

  private isLimitedLocal(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const history = (this.fallback.get(key) ?? []).filter((ts) => now - ts < windowMs);
    history.push(now);
    this.fallback.set(key, history);
    return history.length > limit;
  }
}
