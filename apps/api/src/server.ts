import type { CallHome, Logger } from '@aip/telemetry';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';

export interface Deps {
  config: Config;
  logger: Logger;
  callHome?: CallHome;
  /** Readiness checks for downstream dependencies (Postgres, Redis, Kafka...). */
  readinessChecks?: Record<string, () => Promise<void>>;
}

export function buildServer({ config, logger, callHome, readinessChecks = {} }: Deps): FastifyInstance {
  const app = Fastify({ logger: false, disableRequestLogging: true });

  app.addHook('onResponse', async (req, reply) => {
    callHome?.count('api.requests');
    if (req.url === '/healthz' || req.url === '/readyz') return;
    logger.info('request', {
      http: {
        method: req.method,
        url_details: { path: req.routeOptions.url },
        status_code: reply.statusCode,
      },
      duration_ms: Math.round(reply.elapsedTime),
    });
  });

  // Liveness: process is up. Never checks dependencies; a DB blip must not restart every pod.
  app.get('/healthz', async () => ({ status: 'ok' }));

  // Readiness: can this pod serve traffic right now.
  app.get('/readyz', async (_req, reply) => {
    const results = await Promise.allSettled(
      Object.entries(readinessChecks).map(async ([name, check]) => {
        await check();
        return name;
      }),
    );
    const failed = Object.keys(readinessChecks).filter((_, i) => results[i]?.status === 'rejected');
    if (failed.length) return reply.code(503).send({ status: 'unavailable', failed });
    return { status: 'ok' };
  });

  app.get('/version', async () => ({ version: config.version, edition: config.edition }));

  return app;
}
