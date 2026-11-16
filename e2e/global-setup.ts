/**
 * Waits for the stack (deploy/compose/docker-compose.yml) to be healthy before
 * suites run. The stack itself is started by CI / `pnpm e2e:up` so a developer can
 * keep it running between iterations.
 */
const targets = {
  api: process.env.API_URL ?? 'http://localhost:8080',
  worker: process.env.WORKER_URL ?? 'http://localhost:8081',
};

async function waitFor(url: string, deadlineMs: number): Promise<void> {
  let lastErr: unknown;
  while (Date.now() < deadlineMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastErr)}`);
}

export default async function setup(): Promise<void> {
  const deadline = Date.now() + 90_000;
  await Promise.all(Object.values(targets).map((base) => waitFor(`${base}/readyz`, deadline)));
}
