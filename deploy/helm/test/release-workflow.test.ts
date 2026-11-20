import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CHART } from './chart.js';

// The chart's default image tag is .Chart.AppVersion, which the release workflow
// stamps from the git tag without its leading "v". Images must be tagged the same
// way, or every default install pulls a tag that doesn't exist.

type Step = {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: { tags?: string; labels?: string };
};
type Workflow = {
  on: { push: { tags: string[] } };
  jobs: { images: { steps: Step[] }; bundle: { steps: Step[] } };
};

const workflow = parse(
  readFileSync(join(CHART, '..', '..', '..', '.github', 'workflows', 'release.yml'), 'utf8'),
) as Workflow;

const helpers = readFileSync(join(CHART, 'templates', '_helpers.tpl'), 'utf8');

describe('release workflow', () => {
  it('defaults the chart image tag to appVersion', () => {
    expect(helpers).toContain('.image.tag | default .root.Chart.AppVersion');
  });

  it('stamps appVersion from the tag without its leading v', () => {
    const run = workflow.jobs.bundle.steps.map((s) => s.run ?? '').join('\n');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell / Actions expression, not a JS template
    expect(run).toContain('version="${GITHUB_REF_NAME#v}"');
    expect(run).toMatch(/helm package .*--app-version "\$version"/);
  });

  it('tags images with the same unprefixed version as appVersion', () => {
    const steps = workflow.jobs.images.steps;
    const version = steps.find((s) => s.id === 'version');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell / Actions expression, not a JS template
    expect(version?.run).toContain('${GITHUB_REF_NAME#v}');

    const build = steps.find((s) => s.id === 'build');
    const tags = build?.with?.tags ?? '';
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell / Actions expression, not a JS template
    expect(tags).toContain('${{ steps.version.outputs.version }}');
    expect(tags).not.toContain('github.ref_name');
  });

  it('accepts release and release-candidate tags only', () => {
    expect(workflow.on.push.tags).toEqual(['v[0-9]+.[0-9]+.[0-9]+', 'v[0-9]+.[0-9]+.[0-9]+-rc.[0-9]+']);
  });

  it('only stores GitHub attestations when the repository is public', () => {
    // GitHub rejects attestations for private user-owned repos, which fails the release.
    const attest = workflow.jobs.images.steps.find((s) =>
      s.uses?.startsWith('actions/attest-build-provenance@'),
    );
    expect(attest?.if).toMatch(/!github\.event\.repository\.private/);
  });

  it.each(['images', 'bundle'] as const)('logs %s into GHCR where cosign can read it', (job) => {
    // cosign reads the Docker config; `helm registry login` alone leaves it unauthenticated.
    const steps = workflow.jobs[job].steps;
    expect(steps.some((s) => /cosign sign --yes/.test(s.run ?? ''))).toBe(true);
    expect(steps.some((s) => s.uses?.startsWith('docker/login-action@'))).toBe(true);
  });

  it('marks release candidates as GitHub pre-releases', () => {
    const create = workflow.jobs.bundle.steps.find((s) => s.name === 'Create GitHub Release');
    expect(create?.run).toMatch(/\*-rc\.\*.*--prerelease/s);
  });
});

type VerifyWorkflow = {
  on: { workflow_run: { workflows: string[]; types: string[] }; workflow_dispatch: unknown };
  jobs: { install: { steps: Step[] }; signatures: { steps: Step[] } };
};

const workflowsDir = join(CHART, '..', '..', '..', '.github', 'workflows');
const releaseName = (parse(readFileSync(join(workflowsDir, 'release.yml'), 'utf8')) as { name: string }).name;
const verify = parse(readFileSync(join(workflowsDir, 'release-verify.yml'), 'utf8')) as VerifyWorkflow;

describe('release-verify workflow', () => {
  it('runs after the release workflow, matched by its name', () => {
    // workflow_run matches on `name:`, so renaming release.yml's workflow would silently stop verification.
    expect(verify.on.workflow_run.workflows).toEqual([releaseName]);
    expect(verify.on.workflow_run.types).toEqual(['completed']);
    expect(verify.on.workflow_dispatch).toBeDefined();
  });

  it('installs the published chart with default values, never logging in to the registry', () => {
    const all = [...verify.jobs.install.steps, ...verify.jobs.signatures.steps];
    expect(all.some((s) => s.uses?.startsWith('docker/login-action@'))).toBe(false);
    expect(all.some((s) => /registry login|docker login/.test(s.run ?? ''))).toBe(false);

    const install = verify.jobs.install.steps.find((s) => s.name === 'Install published chart')?.run ?? '';
    expect(install).toMatch(/helm install aip "\$CHART" --version "\$VERSION"/);
    // Only telemetry may be overridden; registry and image tags must come from the chart defaults.
    expect(install.match(/--set [^\s]+/g)).toEqual(['--set telemetry.enabled=false']);
  });
});

describe('Terraform bundle in the registry', () => {
  // Release assets need a GitHub login while the repo is private, so customers get the bundle from GHCR.
  it('is pushed to GHCR with oras and signed with cosign', () => {
    const push =
      workflow.jobs.bundle.steps.find((s) => s.name === 'Push and sign Terraform bundle')?.run ?? '';
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell / Actions expression, not a JS template
    expect(push).toContain('ref="ghcr.io/${owner_lc}/terraform/aip"');
    expect(push).toMatch(/oras push "\$\{ref\}:\$\{version\}"/);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell / Actions expression, not a JS template
    expect(push).toContain('aip-terraform-${GITHUB_REF_NAME}.tar.gz');
    expect(push).toMatch(/cosign sign --yes "\$\{ref\}@\$\{digest\}"/);
  });

  it('is verified and pulled anonymously by release-verify, and matches SHA256SUMS', () => {
    const check =
      verify.jobs.signatures.steps.find((s) => s.name === 'Terraform bundle from the registry')?.run ?? '';
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell / Actions expression, not a JS template
    expect(check).toContain('ref="${REG}/terraform/aip:${VERSION}"');
    expect(check).toMatch(/cosign verify "\$ref"/);
    expect(check).toMatch(/oras pull "\$ref"/);
    expect(check).toContain('../dist/SHA256SUMS');
  });
});
