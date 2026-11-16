import { createLogger } from '@aip/telemetry';
import { buildServer } from './server.js';

const version = process.env.AIP_VERSION ?? '0.0.0-dev';
const port = Number(process.env.PORT ?? 8080);
const logger = createLogger({ service: '__name__', version });
const app = buildServer();

const shutdown = async (signal: string) => {
  logger.info('shutting down', { signal });
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port, host: '0.0.0.0' });
logger.info('listening', { port });
