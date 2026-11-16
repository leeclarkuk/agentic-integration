#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { type Lang, scaffoldService } from './scaffold.js';

const USAGE = `platform — paved-road tooling

Usage:
  platform new service <name> --lang ts|py

After scaffolding: add the e2e project's implicitDependencies entry, add the
service to deploy/compose/docker-compose.yml, then run \`pnpm install\`.`;

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}

function main(argv: string[]): number {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { lang: { type: 'string', default: 'ts' }, help: { type: 'boolean', short: 'h' } },
  });
  const [cmd, kind, name] = positionals;
  if (values.help || cmd !== 'new' || kind !== 'service' || !name) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }
  if (values.lang !== 'ts' && values.lang !== 'py') {
    console.error(`--lang must be ts or py (got ${values.lang})`);
    return 1;
  }
  try {
    const files = scaffoldService({ name, lang: values.lang as Lang, repoRoot: repoRoot() });
    console.log(`Created ${files.length} files:\n${files.map((f) => `  ${f}`).join('\n')}`);
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
