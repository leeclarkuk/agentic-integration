import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUITES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'suites');

/** Map Nx project names (e.g. "@aip/api") to suite dirs (e.g. "api"). */
export function suiteDirFor(project: string): string {
  return project.replace(/^@aip\//, '');
}

export function selectSuites(projectsEnv: string | undefined, suitesDir = SUITES_DIR): string[] {
  if (!projectsEnv || projectsEnv.trim() === 'all') return ['suites/**/*.e2e.ts'];
  const available = existsSync(suitesDir) ? new Set(readdirSync(suitesDir)) : new Set<string>();
  const dirs = projectsEnv
    .split(',')
    .map((p) => suiteDirFor(p.trim()))
    .filter((d) => available.has(d));
  // Shared suites always run when anything is affected: they cover cross-service flows.
  if (available.has('_shared')) dirs.push('_shared');
  return dirs.length ? dirs.map((d) => `suites/${d}/**/*.e2e.ts`) : ['__no_affected_suites__'];
}
