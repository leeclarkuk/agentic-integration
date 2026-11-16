/**
 * All runtime configuration comes from environment variables so the same image
 * runs in our GCP estate and in a customer's cloud. Fail fast on bad config:
 * a crash-looping pod with a clear message beats a silently misconfigured one.
 */
export interface Config {
  port: number;
  host: string;
  version: string;
  edition: 'saas' | 'self-hosted';
  cloud: 'gcp' | 'aws' | 'azure' | 'other';
  installId: string | undefined;
  callHomeEndpoint: string;
}

const CLOUDS = ['gcp', 'aws', 'azure', 'other'] as const;
const EDITIONS = ['saas', 'self-hosted'] as const;

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${name}=${value}; expected one of ${allowed.join(', ')}`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid PORT=${env.PORT}`);
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    version: env.AIP_VERSION ?? '0.0.0-dev',
    edition: oneOf('AIP_EDITION', env.AIP_EDITION ?? 'saas', EDITIONS),
    cloud: oneOf('AIP_CLOUD', env.AIP_CLOUD ?? 'gcp', CLOUDS),
    installId: env.AIP_INSTALL_ID,
    callHomeEndpoint: env.AIP_CALL_HOME_ENDPOINT ?? 'https://telemetry.invalid/v1/report',
  };
}
