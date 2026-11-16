import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldService, validateName } from '../src/scaffold.js';

const REPO = resolve(import.meta.dirname, '../../..');

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'scaffold-'));
  cpSync(join(REPO, 'templates'), join(root, 'templates'), { recursive: true });
  cpSync(join(REPO, 'pyproject.toml'), join(root, 'pyproject.toml'));
  return root;
}

describe('scaffoldService', () => {
  it('generates a TS service with tokens replaced and an e2e suite', () => {
    const root = sandbox();
    const files = scaffoldService({ name: 'billing-sync', lang: 'ts', repoRoot: root });
    expect(files).toContain('apps/billing-sync/package.json');
    expect(files).toContain('apps/billing-sync/Dockerfile');
    expect(files).toContain('e2e/suites/billing-sync/health.e2e.ts');
    const pkg = JSON.parse(readFileSync(join(root, 'apps/billing-sync/package.json'), 'utf8'));
    expect(pkg.name).toBe('@aip/billing-sync');
    for (const f of files) expect(readFileSync(join(root, f), 'utf8')).not.toMatch(/__(name|module)__/);
  });

  it('generates a Python service with a snake_case module dir', () => {
    const root = sandbox();
    scaffoldService({ name: 'doc-indexer', lang: 'py', repoRoot: root });
    expect(existsSync(join(root, 'apps/doc-indexer/src/doc_indexer/main.py'))).toBe(true);
    const project = JSON.parse(readFileSync(join(root, 'apps/doc-indexer/project.json'), 'utf8'));
    expect(project.name).toBe('doc-indexer');
    expect(readFileSync(join(root, 'pyproject.toml'), 'utf8')).toContain(
      'members = ["apps/worker", "apps/doc-indexer"]',
    );
  });

  it('refuses to overwrite an existing service', () => {
    const root = sandbox();
    scaffoldService({ name: 'thing', lang: 'ts', repoRoot: root });
    expect(() => scaffoldService({ name: 'thing', lang: 'ts', repoRoot: root })).toThrow(/already exists/);
  });

  it('rejects unsafe or reserved names', () => {
    for (const bad of ['../etc', 'Upper', 'a', 'api', 'has_underscore', 'trailing-']) {
      expect(() => validateName(bad)).toThrow();
    }
  });
});
