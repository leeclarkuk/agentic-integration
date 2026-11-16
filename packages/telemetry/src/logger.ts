/**
 * Minimal structured JSON logger. One line per event on stdout so the Datadog
 * agent (or any log shipper in a customer cluster) can parse it without config.
 * Field names follow Datadog's reserved attributes (status, service, version,
 * dd.trace_id) so logs correlate with APM traces out of the box.
 */
export type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  service: string;
  version: string;
  level?: Level;
  write?: (line: string) => void;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(opts: LoggerOptions, bound: Record<string, unknown> = {}): Logger {
  const min = ORDER[opts.level ?? (process.env.LOG_LEVEL as Level | undefined) ?? 'info'] ?? ORDER.info;
  const write = opts.write ?? ((line: string) => process.stdout.write(`${line}\n`));

  const emit = (status: Level, message: string, fields?: Record<string, unknown>) => {
    if (ORDER[status] < min) return;
    const record = {
      timestamp: new Date().toISOString(),
      status,
      service: opts.service,
      version: opts.version,
      message,
      ...bound,
      ...fields,
    };
    write(JSON.stringify(record, errorReplacer));
  };

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (fields) => createLogger(opts, { ...bound, ...fields }),
  };
}

function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { kind: value.name, message: value.message, stack: value.stack };
  }
  return value;
}
