import { createCallHome, createLogger } from '@aip/telemetry';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

const config = loadConfig();
const logger = createLogger({ service: 'api', version: config.version });

const callHome =
  config.edition === 'self-hosted' && config.installId
    ? createCallHome({
        endpoint: config.callHomeEndpoint,
        installId: config.installId,
        version: config.version,
        edition: config.edition,
        cloud: config.cloud,
        logger,
      })
    : undefined;

const app = buildServer({ config, logger, ...(callHome ? { callHome } : {}) });

const shutdown = async (signal: string) => {
  logger.info('shutting down', { signal });
  callHome?.stop();
  await callHome?.flush();
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.port, host: config.host });
callHome?.start();
logger.info('listening', {
  port: config.port,
  edition: config.edition,
  telemetry: callHome?.enabled ?? false,
});
