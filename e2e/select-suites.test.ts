import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectSuites } from './select-suites.js';

function fixture(dirs: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'suites-'));
  for (const d of dirs) mkdirSync(join(root, d));
  return root;
}

describe('selectSuites', () => {
  it('runs everything when unset or "all"', () => {
    expect(selectSuites(undefined)).toEqual(['suites/**/*.e2e.ts']);
    expect(selectSuites('all')).toEqual(['suites/**/*.e2e.ts']);
  });

  it('maps affected Nx projects to suite dirs and ignores projects without suites', () => {
    const dir = fixture(['api', 'worker']);
    expect(selectSuites('@aip/api,@aip/telemetry', dir)).toEqual(['suites/api/**/*.e2e.ts']);
  });

  it('always includes _shared when anything with suites is affected', () => {
    const dir = fixture(['api', '_shared']);
    expect(selectSuites('@aip/api', dir)).toEqual(['suites/api/**/*.e2e.ts', 'suites/_shared/**/*.e2e.ts']);
  });

  it('matches nothing when no affected project has suites', () => {
    const dir = fixture(['api']);
    expect(selectSuites('@aip/telemetry', dir)).toEqual(['__no_affected_suites__']);
  });
});
