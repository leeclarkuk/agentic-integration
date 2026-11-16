/**
 * Golden-path scaffolding. A new service generated here is, on day one:
 * buildable + testable by Nx, picked up by affected CI, containerised as
 * non-root, health-checked, structured-logged, and wired into an e2e suite.
 * Templates live in /templates; tokens are `__name__` and `__module__`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Lang = 'ts' | 'py';

export interface ScaffoldOptions {
  name: string;
  lang: Lang;
  repoRoot: string;
}

const NAME = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED = new Set(['api', 'worker', 'e2e', 'telemetry', 'platform-cli']);

export function validateName(name: string): void {
  if (!NAME.test(name)) {
    throw new Error(`Service name "${name}" must be 3-40 chars, lowercase kebab-case, start with a letter.`);
  }
  if (RESERVED.has(name)) throw new Error(`Service name "${name}" is reserved.`);
}

export function tokens(name: string): { __name__: string; __module__: string } {
  return { __name__: name, __module__: name.replaceAll('-', '_') };
}

function render(text: string, t: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(t)) out = out.replaceAll(k, v);
  return out;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Adds a member to the root uv workspace (`[tool.uv.workspace] members = [...]`). */
export function registerUvMember(repoRoot: string, member: string): string[] {
  const path = join(repoRoot, 'pyproject.toml');
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const re = /(\[tool\.uv\.workspace\][^[]*?members\s*=\s*\[)([^\]]*)(\])/s;
  const m = re.exec(text);
  if (!m) throw new Error('pyproject.toml has no [tool.uv.workspace] members list');
  const existing = [...(m[2] ?? '').matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (existing.includes(member)) return [];
  const list = [...existing, member].map((x) => `"${x}"`).join(', ');
  writeFileSync(path, text.replace(re, `$1${list}$3`));
  return ['pyproject.toml'];
}

/** Returns repo-relative paths of written files. Refuses to overwrite anything. */
export function scaffoldService({ name, lang, repoRoot }: ScaffoldOptions): string[] {
  validateName(name);
  const templateDir = join(repoRoot, 'templates', lang === 'ts' ? 'service-ts' : 'service-py');
  const targetDir = join(repoRoot, 'apps', name);
  if (!existsSync(templateDir)) throw new Error(`Template not found: ${templateDir}`);
  if (existsSync(targetDir)) throw new Error(`apps/${name} already exists.`);

  const t = tokens(name);
  const written: string[] = [];
  for (const src of walk(templateDir)) {
    const rel = render(relative(templateDir, src), t).replace(/\.tmpl$/, '');
    const dest = join(targetDir, rel);
    mkdirSync(join(dest, '..'), { recursive: true });
    writeFileSync(dest, render(readFileSync(src, 'utf8'), t));
    written.push(relative(repoRoot, dest));
  }

  if (lang === 'py') written.push(...registerUvMember(repoRoot, `apps/${name}`));

  // Give the new service an e2e suite so it is covered by incremental e2e from day one.
  const suiteDir = join(repoRoot, 'e2e', 'suites', name);
  mkdirSync(suiteDir, { recursive: true });
  const suite = join(suiteDir, 'health.e2e.ts');
  writeFileSync(
    suite,
    `import { describe, expect, it } from 'vitest';\n\n` +
      `const URL = process.env.${t.__module__.toUpperCase()}_URL ?? 'http://localhost:8080';\n\n` +
      `describe('${name}', () => {\n  it('is healthy', async () => {\n` +
      `    expect((await fetch(\`\${URL}/healthz\`)).status).toBe(200);\n  });\n});\n`,
  );
  written.push(relative(repoRoot, suite));
  return written;
}
