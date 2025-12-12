<div align="center">
  <img src="https://raw.githubusercontent.com/entrolytics/.github/main/media/entrov2.png" alt="Entrolytics" width="64" height="64">

  [![npm](https://img.shields.io/npm/v/@entrolytics/redis-client.svg?logo=npm)](https://www.npmjs.com/package/@entrolytics/redis-client)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Overview

**@entrolytics/redis-client** is the official Redis client for Entrolytics - first-party growth analytics for the edge. Provides caching, rate limiting, and key management with automatic prefixing and statistics tracking.

**Why use this client?**
- Cache-through pattern for automatic query caching
- Built-in rate limiting with configurable windows
- Cache statistics for monitoring hit/miss rates
- Pattern-based bulk cache invalidation

## Key Features

<table>
<tr>
<td width="50%">

### Caching
- Cache-through pattern
- Automatic key prefixing
- Soft delete support
- Pattern invalidation

</td>
<td width="50%">

### Rate Limiting
- Configurable windows
- Remaining count tracking
- Per-key rate limits
- Health monitoring

</td>
</tr>
</table>

## Quick Start

<table>
<tr>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:download.svg?color=%236366f1" width="48"><br>
<strong>1. Install</strong><br>
<code>pnpm add</code>
</td>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:settings.svg?color=%236366f1" width="48"><br>
<strong>2. Configure</strong><br>
Redis URL
</td>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:server.svg?color=%236366f1" width="48"><br>
<strong>3. Initialize</strong><br>
Create client
</td>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:zap.svg?color=%236366f1" width="48"><br>
<strong>4. Cache</strong><br>
Start caching
</td>
</tr>
</table>

## Installation

```bash
pnpm add @entrolytics/redis-client
```

## Features

- **Cache-through Pattern**: Automatically cache query results
- **Rate Limiting**: Built-in rate limiting with configurable windows
- **Key Prefixing**: Automatic key prefixing to avoid collisions
- **Cache Statistics**: Track hit/miss rates
- **Health Checks**: Built-in Redis health monitoring
- **Soft Deletes**: Mark items as deleted without removing from cache
- **Pattern Invalidation**: Bulk invalidate keys by pattern
- **Debug Logging**: Optional logging via `debug` package

## Usage

### Basic Setup

```typescript
import { EntrolyticsRedisClient } from '@entrolytics/redis-client';

const redis = new EntrolyticsRedisClient({
  url: process.env.REDIS_URL,
  prefix: 'myapp:',
  defaultTTL: 3600, // 1 hour
});
```

### Cache-through Pattern

```typescript
// Fetch from cache or execute query
const user = await redis.fetch(
  `user:${userId}`,
  () => db.query.users.findFirst({ where: eq(users.id, userId) }),
  86400 // Cache for 24 hours
);
```

### Rate Limiting

```typescript
// Returns true if rate limit exceeded
const isLimited = await redis.rateLimit(
  `api:${ip}`,
  100,  // 100 requests
  60    // per 60 seconds
);

if (isLimited) {
  return new Response('Too Many Requests', { status: 429 });
}

// Get remaining requests
const remaining = await redis.getRateLimitRemaining(`api:${ip}`, 100);
```

### Basic Operations

```typescript
// Set with TTL
await redis.set('key', { foo: 'bar' }, 3600);

// Get
const value = await redis.get<{ foo: string }>('key');

// Delete
await redis.del('key');

// Check existence
const exists = await redis.exists('key');

// Increment/Decrement
await redis.incr('counter');
await redis.decr('counter');
```

### Cache Invalidation

```typescript
// Invalidate single key
await redis.remove('user:123');

// Soft delete (marks as deleted but keeps in cache)
await redis.remove('user:123', true);

// Invalidate by pattern
await redis.invalidatePattern('user:*');

// Flush all keys with prefix
await redis.flushPrefix();
```

### Statistics & Health

```typescript
// Get cache statistics
const stats = redis.getStats();
// { hits: 1234, misses: 56, hitRate: 0.956 }

// Reset statistics
redis.resetStats();

// Health check
const health = await redis.healthCheck();
// { ok: true, latency: 5 }
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | required | Redis connection URL |
| `prefix` | `string` | `'entrolytics:'` | Key prefix for all operations |
| `defaultTTL` | `number` | `3600` | Default TTL in seconds |

## License

MIT - Entrolytics
