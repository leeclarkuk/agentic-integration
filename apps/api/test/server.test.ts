import { createLogger } from '@aip/telemetry';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildServer } from '../src/server.js';

const logger = createLogger({ service: 'api', version: 'test', write: () => {} });

describe('api server', () => {
  it('serves liveness and version', async () => {
    const app = buildServer({ config: loadConfig({ AIP_VERSION: '9.9.9' }), logger });
    expect((await app.inject('/healthz')).json()).toEqual({ status: 'ok' });
    expect((await app.inject('/version')).json()).toEqual({ version: '9.9.9', edition: 'saas' });
  });

  it('reports unready with the failing dependency named', async () => {
    const app = buildServer({
      config: loadConfig({}),
      logger,
      readinessChecks: {
        postgres: async () => {},
        redis: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
    });
    const res = await app.inject('/readyz');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable', failed: ['redis'] });
  });

  it('rejects invalid config at startup', () => {
    expect(() => loadConfig({ AIP_CLOUD: 'oracle' })).toThrow(/AIP_CLOUD/);
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
