/**
 * Renders the chart with `helm template` and asserts the security and
 * reliability properties customers rely on. Requires the helm binary (CI has
 * it); skipped locally when helm is not on PATH (or HELM_BIN).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ciValueFiles, helmAvailable, type Manifest, template } from './chart.js';

type Container = {
  name: string;
  image: string;
  resources: { requests?: Record<string, string>; limits?: Record<string, string> };
  securityContext: Record<string, unknown>;
  env: { name: string; value?: string }[];
  readinessProbe?: unknown;
  livenessProbe?: unknown;
};
type PodSpec = {
  securityContext: Record<string, unknown>;
  containers: Container[];
  automountServiceAccountToken?: boolean;
};

const deployments = (ms: Manifest[]) => ms.filter((m) => m.kind === 'Deployment');
const podSpec = (d: Manifest) => (d.spec as { template: { spec: PodSpec } }).template.spec;

const scenarios: [string, string[]][] = [
  ['defaults', []],
  ...ciValueFiles().map((f): [string, string[]] => [f.split('/').pop() ?? f, ['-f', f]]),
];

// In CI a missing helm binary is a failure, never a silent skip.
if (process.env.CI && !helmAvailable())
  throw new Error('helm is required in CI (set HELM_BIN or install it)');

describe.skipIf(!helmAvailable())('helm template', () => {
  describe.each(scenarios)('%s', (_name, args) => {
    let manifests: Manifest[] = [];
    beforeAll(() => {
      manifests = template(args);
    });

    it('renders a deployment per enabled component', () => {
      expect(
        deployments(manifests)
          .map((d) => d.metadata.name)
          .sort(),
      ).toEqual(['aip-api', 'aip-worker']);
    });

    it('runs every container non-root, read-only, with no capabilities', () => {
      for (const d of deployments(manifests)) {
        const spec = podSpec(d);
        expect(spec.securityContext).toMatchObject({
          runAsNonRoot: true,
          seccompProfile: { type: 'RuntimeDefault' },
        });
        expect(spec.automountServiceAccountToken).toBe(false);
        for (const c of spec.containers) {
          expect(c.securityContext).toMatchObject({
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: true,
            capabilities: { drop: ['ALL'] },
          });
        }
      }
    });

    it('sets requests, memory limits and probes on every container', () => {
      for (const d of deployments(manifests)) {
        for (const c of podSpec(d).containers) {
          expect(c.resources.requests?.cpu).toBeTruthy();
          expect(c.resources.requests?.memory).toBeTruthy();
          expect(c.resources.limits?.memory).toBeTruthy();
          expect(c.readinessProbe).toBeTruthy();
          expect(c.livenessProbe).toBeTruthy();
        }
      }
    });

    it('never uses a floating image tag', () => {
      for (const d of deployments(manifests)) {
        for (const c of podSpec(d).containers) expect(c.image).not.toMatch(/:latest$|:$/);
      }
    });

    it('protects every component with a PodDisruptionBudget and a NetworkPolicy', () => {
      const pdbs = manifests.filter((m) => m.kind === 'PodDisruptionBudget').map((m) => m.metadata.name);
      const netpols = manifests.filter((m) => m.kind === 'NetworkPolicy').map((m) => m.metadata.name);
      for (const d of deployments(manifests)) {
        expect(pdbs).toContain(d.metadata.name);
        expect(netpols).toContain(d.metadata.name);
      }
    });

    it('keeps the install-ID Secret across uninstalls', () => {
      const secret = manifests.find((m) => m.kind === 'Secret' && m.metadata.name === 'aip-install');
      expect(secret?.metadata).toMatchObject({ annotations: { 'helm.sh/resource-policy': 'keep' } });
    });
  });

  it('pins images by digest when one is given', () => {
    const [ci] = ciValueFiles();
    if (!ci) return;
    for (const d of deployments(template(['-f', ci]))) {
      for (const c of podSpec(d).containers) expect(c.image).toMatch(/@sha256:[a-f0-9]{64}$/);
    }
  });

  it('disables call-home via env when telemetry.enabled=false', () => {
    for (const d of deployments(template(['--set', 'telemetry.enabled=false']))) {
      const env = podSpec(d).containers[0]?.env ?? [];
      expect(env).toContainEqual({ name: 'AIP_TELEMETRY_DISABLED', value: '1' });
    }
  });

  it('fails fast on an ingress without a host', () => {
    expect(() => template(['--set', 'ingress.enabled=true'])).toThrow(/ingress.host is required/);
  });
});
