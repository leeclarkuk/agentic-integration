import { describe, expect, it } from 'vitest';

const WORKER = process.env.WORKER_URL ?? 'http://localhost:8081';

describe('worker (deployed container)', () => {
  it('is healthy', async () => {
    expect((await fetch(`${WORKER}/healthz`)).status).toBe(200);
  });
});
