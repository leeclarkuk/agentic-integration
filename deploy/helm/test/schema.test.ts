import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CHART, ciValueFiles, defaultValues, mergeValues, type Values } from './chart.js';

const schema = JSON.parse(readFileSync(join(CHART, 'values.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

function check(overrides: Values): boolean {
  return validate(mergeValues(defaultValues(), overrides)) as boolean;
}

describe('values.schema.json', () => {
  it('accepts the default values', () => {
    expect(validate(defaultValues()), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each(ciValueFiles())('accepts CI values file %s', (file) => {
    const ok = check(parse(readFileSync(file, 'utf8')) as Values);
    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it.each([
    ['a typo in a top-level key', { telemetery: { enabled: false } }],
    ['a typo in a component key', { components: { api: { replica: 3 } } }],
    ['an unknown cloud', { global: { cloud: 'oracle' } }],
    ['the latest tag', { components: { api: { image: { tag: 'latest' } } } }],
    ['a malformed digest', { components: { api: { image: { digest: 'sha256:abc' } } } }],
    ['a plain-http telemetry endpoint', { telemetry: { endpoint: 'http://example.test' } }],
    ['a non-UUID install ID', { telemetry: { installId: 'customer-acme' } }],
    ['a secret passed as a plain env var', { components: { api: { env: { DB_PASSWORD: 'hunter2' } } } }],
    ['a privileged container port', { components: { api: { port: 80 } } }],
    ['missing memory limits', { components: { api: { resources: { limits: { memory: null } } } } }],
  ])('rejects %s', (_label, overrides) => {
    expect(check(overrides as Values)).toBe(false);
  });
});
