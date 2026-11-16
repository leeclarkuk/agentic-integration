import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse, parseAllDocuments } from 'yaml';

export const CHART = resolve(import.meta.dirname, '../aip');
export const HELM = process.env.HELM_BIN ?? 'helm';

export type Values = Record<string, unknown>;
export type Manifest = { kind: string; metadata: { name: string }; spec?: Record<string, unknown> } & Values;

export function defaultValues(): Values {
  return parse(readFileSync(join(CHART, 'values.yaml'), 'utf8')) as Values;
}

export function ciValueFiles(): string[] {
  return readdirSync(join(CHART, 'ci'))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => join(CHART, 'ci', f));
}

/** Helm's coalescing: maps merge recursively, arrays/scalars replace, null deletes the key. */
export function mergeValues(base: Values, override: Values): Values {
  const out: Values = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === null) {
      delete out[k];
      continue;
    }
    const b = out[k];
    out[k] = isMap(b) && isMap(v) ? mergeValues(b, v) : v;
  }
  return out;
}

function isMap(v: unknown): v is Values {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function helmAvailable(): boolean {
  return spawnSync(HELM, ['version', '--short'], { encoding: 'utf8' }).status === 0;
}

export function template(args: string[] = []): Manifest[] {
  const res = spawnSync(HELM, ['template', 'aip', CHART, '--namespace', 'aip', ...args], {
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`helm template failed:\n${res.stderr}`);
  return parseAllDocuments(res.stdout)
    .map((d) => d.toJS() as Manifest | null)
    .filter((m): m is Manifest => m !== null);
}
