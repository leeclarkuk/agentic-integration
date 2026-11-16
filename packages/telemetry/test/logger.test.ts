import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';

describe('logger', () => {
  it('writes one JSON line with Datadog reserved attributes', () => {
    const lines: string[] = [];
    const log = createLogger({ service: 'api', version: '1.0.0', write: (l) => lines.push(l) });
    log.child({ requestId: 'r1' }).info('hello', { route: '/healthz' });
    const rec = JSON.parse(lines[0] ?? '{}');
    expect(rec).toMatchObject({
      status: 'info',
      service: 'api',
      version: '1.0.0',
      message: 'hello',
      requestId: 'r1',
    });
  });

  it('respects the minimum level and serialises errors', () => {
    const lines: string[] = [];
    const log = createLogger({ service: 'api', version: '1', level: 'warn', write: (l) => lines.push(l) });
    log.info('dropped');
    log.error('boom', { err: new Error('bad') });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}').err.message).toBe('bad');
  });
});
