import { describe, expect, it } from 'vitest';

const API = process.env.API_URL ?? 'http://localhost:8080';

describe('api (deployed container)', () => {
  it('is ready and reports its version', async () => {
    expect((await fetch(`${API}/readyz`)).status).toBe(200);
    const body = (await (await fetch(`${API}/version`)).json()) as { version: string };
    expect(body.version).toMatch(/\S+/);
  });
});
