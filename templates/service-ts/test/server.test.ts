import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

describe('__name__', () => {
  it('is healthy', async () => {
    const res = await buildServer().inject('/healthz');
    expect(res.statusCode).toBe(200);
  });
});
