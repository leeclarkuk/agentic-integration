import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CallHomePayload, createCallHome } from '../src/call-home.js';

const base = {
  endpoint: 'https://telemetry.example.test/v1/report',
  installId: '00000000-0000-4000-8000-000000000000',
  version: '1.2.3',
  edition: 'self-hosted' as const,
  cloud: 'gcp' as const,
};

function okFetch() {
  return vi.fn(async () => new Response(null, { status: 204 }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('call-home', () => {
  it('sends only the allowlisted payload shape', async () => {
    const fetchImpl = okFetch();
    const ch = createCallHome({ ...base, fetchImpl });
    ch.count('requests.total', 3);
    expect(await ch.flush()).toBe(true);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as CallHomePayload;
    expect(Object.keys(body).sort()).toEqual(
      [
        'cloud',
        'edition',
        'installId',
        'schemaVersion',
        'sentAt',
        'uptimeSeconds',
        'usage',
        'version',
      ].sort(),
    );
    expect(body.usage).toEqual({ 'requests.total': 3 });
  });

  it('is a no-op when AIP_TELEMETRY_DISABLED is set', async () => {
    vi.stubEnv('AIP_TELEMETRY_DISABLED', '1');
    const fetchImpl = okFetch();
    const ch = createCallHome({ ...base, fetchImpl });
    ch.count('requests.total');
    expect(ch.enabled).toBe(false);
    expect(await ch.flush()).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('drops counter names that could smuggle data', async () => {
    const fetchImpl = okFetch();
    const ch = createCallHome({ ...base, fetchImpl });
    ch.count('user@example.com');
    ch.count('Requests');
    ch.count('ok_name');
    await ch.flush();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).usage).toEqual({ ok_name: 1 });
  });

  it('keeps counters when the endpoint is unreachable and never throws', async () => {
    const failing = vi.fn(async () => {
      throw new Error('ENOTFOUND');
    });
    const ch = createCallHome({ ...base, fetchImpl: failing });
    ch.count('jobs.run', 2);
    expect(await ch.flush()).toBe(false);

    ch.count('jobs.run', 1);
    expect(await ch.flush()).toBe(false);
    expect(failing).toHaveBeenCalledTimes(2);
    const lastBody = JSON.parse(
      (failing.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(lastBody.usage).toEqual({ 'jobs.run': 3 });
  });
});
