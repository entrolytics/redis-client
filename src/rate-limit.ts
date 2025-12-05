/**
 * Rate limiting utilities with sliding window algorithm
 * Supports Redis (distributed) and in-memory (single instance) fallback
 */
import { log } from './EntrolyticsRedisClient';
import type { EntrolyticsRedisClient } from './EntrolyticsRedisClient';

export interface RateLimitConfig {
  /**
   * Unique identifier for this rate limit bucket
   */
  bucket: string;

  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Predefined rate limit configurations for Entrolytics
 */
export const RATE_LIMITS = {
  // Strict limits for security-sensitive endpoints
  CLI_TOKEN_EXCHANGE: {
    bucket: 'cli:token',
    limit: 5,
    window: 60, // 5 requests per minute
  },

  SHARE_TOKEN_GENERATION: {
    bucket: 'share:token',
    limit: 10,
    window: 60, // 10 requests per minute
  },

  LINK_CREATION: {
    bucket: 'link:create',
    limit: 20,
    window: 60, // 20 links per minute
  },

  // Medium limits for tracking/redirect
  LINK_REDIRECT: {
    bucket: 'link:redirect',
    limit: 100,
    window: 60, // 100 redirects per minute per IP
  },

  // Event ingestion rate limits (per website)
  EVENT_INGESTION: {
    bucket: 'event:ingest',
    limit: 1000,
    window: 60, // 1000 events per minute per website
  },

  // Pixel tracking rate limits (per pixel)
  PIXEL_FIRE: {
    bucket: 'pixel:fire',
    limit: 500,
    window: 60, // 500 pixel fires per minute per pixel
  },

  // General API limits
  API_GENERAL: {
    bucket: 'api:general',
    limit: 100,
    window: 60, // 100 requests per minute
  },
} as const;

/**
 * In-memory rate limiting store (fallback when Redis is not available)
 * Note: This only works for single instance deployments
 */
const rateLimitStore = new Map<string, number[]>();

/**
 * Clean up old entries from in-memory store
 */
function cleanupRateLimitStore(threshold: number) {
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const filtered = timestamps.filter((ts) => ts > threshold);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}

/**
 * In-memory rate limiting (single instance only)
 */
function inMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number,
  windowStart: number,
): RateLimitResult {
  // Get or create bucket
  let timestamps = rateLimitStore.get(key) || [];

  // Remove old entries
  timestamps = timestamps.filter((ts) => ts > windowStart);

  // Check limit
  if (timestamps.length >= config.limit) {
    rateLimitStore.set(key, timestamps);

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: now + config.window,
    };
  }

  // Add current request
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  // Clean up old keys periodically (basic memory management)
  if (Math.random() < 0.01) {
    // 1% chance
    cleanupRateLimitStore(windowStart);
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - timestamps.length,
    reset: now + config.window,
  };
}

/**
 * Rate limiting using sliding window algorithm
 *
 * Uses Redis if client provided (distributed rate limiting), falls back to
 * in-memory Map (single instance) if client is null.
 *
 * @param client - Redis client instance or null for in-memory fallback
 * @param identifier - Unique identifier (e.g., IP address, user ID, website ID)
 * @param config - Rate limit configuration
 */
export async function rateLimit(
  client: EntrolyticsRedisClient | null,
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `ratelimit:${config.bucket}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;

  if (client?.isConnected) {
    try {
      // Use Redis for distributed rate limiting with sliding window
      const redis = client.client;
      const prefixedKey = `${client.prefix}${key}`;

      const multi = redis.multi();

      // Remove old entries outside the window
      multi.zRemRangeByScore(prefixedKey, 0, windowStart);

      // Count current requests in window
      multi.zCard(prefixedKey);

      // Add current request with unique value
      multi.zAdd(prefixedKey, { score: now, value: `${now}:${Math.random()}` });

      // Set expiry on the key
      multi.expire(prefixedKey, config.window);

      const results = await multi.exec();

      // Results: [removeResult, countResult, addResult, expireResult]
      const count = Number(results?.[1]) || 0;

      const remaining = Math.max(0, config.limit - count - 1);
      const reset = now + config.window;

      if (count >= config.limit) {
        return {
          success: false,
          limit: config.limit,
          remaining: 0,
          reset,
        };
      }

      return {
        success: true,
        limit: config.limit,
        remaining,
        reset,
      };
    } catch (err) {
      log('Redis rate limiting error, falling back to in-memory:', err);
    }
  }

  // Fallback to in-memory rate limiting (single instance only)
  return inMemoryRateLimit(key, config, now, windowStart);
}

/**
 * Simple counter-based rate limiting (less accurate but simpler)
 * Uses INCR with expiry - good for high-volume, less precise scenarios
 *
 * @param client - Redis client instance
 * @param identifier - Unique identifier
 * @param limit - Maximum requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns true if rate limit exceeded, false otherwise
 */
export async function rateLimitSimple(
  client: EntrolyticsRedisClient | null,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!client) {
    // In-memory fallback for simple rate limiting
    const key = `simple:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    let timestamps = rateLimitStore.get(key) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= limit) {
      return true; // Rate limited
    }

    timestamps.push(now);
    rateLimitStore.set(key, timestamps);
    return false;
  }

  return client.rateLimit(identifier, limit, windowSeconds);
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
    ...(result.success ? {} : { 'Retry-After': String(result.reset - Math.floor(Date.now() / 1000)) }),
  };
}

/**
 * Create a rate limiter bound to a specific Redis client
 * Useful for creating app-specific rate limiters
 */
export function createRateLimiter(client: EntrolyticsRedisClient | null) {
  return {
    /**
     * Check rate limit for an identifier
     */
    check: (identifier: string, config: RateLimitConfig) => rateLimit(client, identifier, config),

    /**
     * Simple counter-based rate limit check
     */
    checkSimple: (identifier: string, limit: number, windowSeconds: number) =>
      rateLimitSimple(client, identifier, limit, windowSeconds),

    /**
     * Get remaining requests for an identifier
     */
    getRemaining: async (identifier: string, config: RateLimitConfig): Promise<number> => {
      if (!client) {
        const key = `ratelimit:${config.bucket}:${identifier}`;
        const timestamps = rateLimitStore.get(key) || [];
        const windowStart = Math.floor(Date.now() / 1000) - config.window;
        const validTimestamps = timestamps.filter((ts) => ts > windowStart);
        return Math.max(0, config.limit - validTimestamps.length);
      }

      return client.getRateLimitRemaining(`${config.bucket}:${identifier}`, config.limit);
    },
  };
}
