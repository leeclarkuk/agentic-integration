import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CHART } from './chart.js';

// The chart's default image tag is .Chart.AppVersion, which the release workflow
// stamps from the git tag without its leading "v". Images must be tagged the same
// way, or every default install pulls a tag that doesn't exist.

type Step = { id?: string; name?: string; run?: string; with?: { tags?: string; labels?: string } };
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

  it('marks release candidates as GitHub pre-releases', () => {
    const create = workflow.jobs.bundle.steps.find((s) => s.name === 'Create GitHub Release');
    expect(create?.run).toMatch(/\*-rc\.\*.*--prerelease/s);
  });
});
