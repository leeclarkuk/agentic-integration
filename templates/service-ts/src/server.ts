import Fastify, { type FastifyInstance } from 'fastify';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async () => ({ status: 'ok' }));
  app.get('/version', async () => ({ version: process.env.AIP_VERSION ?? '0.0.0-dev' }));
  return app;
}
