import { describe, expect, it } from 'vite-plus/test';

import { rateLimit, rateLimitSimple } from './rate-limit';

describe('in-memory rate limiting', () => {
  it('enforces the configured sliding-window limit', async () => {
    const identifier = crypto.randomUUID();
    const config = { bucket: 'test', limit: 2, window: 60 };

    expect((await rateLimit(null, identifier, config)).success).toBe(true);
    expect((await rateLimit(null, identifier, config)).remaining).toBe(0);
    expect((await rateLimit(null, identifier, config)).success).toBe(false);
  });

  it('enforces the simple fallback limit', async () => {
    const identifier = crypto.randomUUID();
    expect(await rateLimitSimple(null, identifier, 1, 60)).toBe(false);
    expect(await rateLimitSimple(null, identifier, 1, 60)).toBe(true);
  });
});
