/**
 * Call-home: periodic version + usage reporting from self-hosted installs.
 *
 * Contract (keep in sync with docs/release/call-home.md — customers read it):
 *  - Payload is an explicit allowlisted schema. No request bodies, prompts,
 *    hostnames, IPs, user identifiers, or secrets are ever sent.
 *  - Disabled entirely with AIP_TELEMETRY_DISABLED=1 (or `enabled: false`).
 *  - Fire-and-forget: failures are logged at debug and never affect serving.
 *  - The installation ID is a random UUID generated at install time, not derived
 *    from any customer data.
 */
import type { Logger } from './logger.js';

export const CALL_HOME_SCHEMA_VERSION = 1;

export interface UsageCounters {
  /** Counter name -> value since last successful report. Names must match /^[a-z0-9_.]+$/. */
  [name: string]: number;
}

export interface CallHomePayload {
  schemaVersion: typeof CALL_HOME_SCHEMA_VERSION;
  installId: string;
  version: string;
  edition: 'saas' | 'self-hosted';
  cloud: 'gcp' | 'aws' | 'azure' | 'other';
  uptimeSeconds: number;
  sentAt: string;
  usage: UsageCounters;
}

export interface CallHomeOptions {
  endpoint: string;
  installId: string;
  version: string;
  edition: CallHomePayload['edition'];
  cloud: CallHomePayload['cloud'];
  intervalMs?: number;
  timeoutMs?: number;
  enabled?: boolean;
  logger?: Logger;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface CallHome {
  /** Increment a usage counter. Invalid names are dropped, not thrown. */
  count(name: string, by?: number): void;
  /** Send one report now. Resolves true on 2xx. Never throws. */
  flush(): Promise<boolean>;
  start(): void;
  stop(): void;
  readonly enabled: boolean;
}

const COUNTER_NAME = /^[a-z0-9_.]{1,64}$/;
const MAX_COUNTERS = 100;

export function isTelemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.AIP_TELEMETRY_DISABLED?.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function createCallHome(opts: CallHomeOptions): CallHome {
  const enabled = (opts.enabled ?? true) && !isTelemetryDisabled();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => new Date());
  const startedAt = now().getTime();
  let counters: UsageCounters = {};
  let timer: NodeJS.Timeout | undefined;

  const count = (name: string, by = 1) => {
    if (!enabled || !COUNTER_NAME.test(name) || !Number.isFinite(by)) return;
    if (!(name in counters) && Object.keys(counters).length >= MAX_COUNTERS) return;
    counters[name] = (counters[name] ?? 0) + by;
  };

  const flush = async (): Promise<boolean> => {
    if (!enabled) return false;
    const snapshot = counters;
    counters = {};
    const payload: CallHomePayload = {
      schemaVersion: CALL_HOME_SCHEMA_VERSION,
      installId: opts.installId,
      version: opts.version,
      edition: opts.edition,
      cloud: opts.cloud,
      uptimeSeconds: Math.floor((now().getTime() - startedAt) / 1000),
      sentAt: now().toISOString(),
      usage: snapshot,
    };
    try {
      const res = await fetchImpl(opts.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000),
      });
      if (!res.ok) throw new Error(`call-home HTTP ${res.status}`);
      return true;
    } catch (err) {
      // Re-merge so usage isn't lost when the endpoint is unreachable (air-gapped, egress-blocked).
      for (const [k, v] of Object.entries(snapshot)) counters[k] = (counters[k] ?? 0) + v;
      opts.logger?.debug('call-home failed', { err });
      return false;
    }
  };

  return {
    enabled,
    count,
    flush,
    start() {
      if (!enabled || timer) return;
      timer = setInterval(() => void flush(), opts.intervalMs ?? 6 * 60 * 60 * 1000);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
