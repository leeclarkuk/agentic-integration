import { defineConfig } from 'vitest/config';
import { selectSuites } from './select-suites.js';

/**
 * Incremental e2e: suites live in e2e/suites/<nx-project-name>/. CI passes the
 * affected Nx projects in E2E_PROJECTS (comma-separated) and only those suites run.
 * Unset or "all" runs everything (nightly + release branches).
 */
export default defineConfig({
  test: {
    include: selectSuites(process.env.E2E_PROJECTS),
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globalSetup: ['./global-setup.ts'],
  },
});
