# Call-home: what self-hosted installations send

Customer-facing. The implementation is `packages/telemetry/src/call-home.ts`. Its tests enforce that the payload stays on this allowlist.

## What is sent

Every 6 hours, and on graceful shutdown, each self-hosted installation sends one HTTPS `POST`:

```json
{
  "schemaVersion": 1,
  "installId": "6f1c…-random-uuid",
  "version": "1.4.2",
  "edition": "self-hosted",
  "cloud": "gcp",
  "uptimeSeconds": 86400,
  "sentAt": "2026-11-16T03:00:00.000Z",
  "usage": { "api.requests": 120345 }
}
```

- `installId` is a random UUID generated at install time. It is not derived from any hostname, account, or customer data.
- `usage` holds aggregate counters only. Names match `^[a-z0-9_.]{1,64}$`, with at most 100 counters.

## What is never sent

Request or response bodies, prompts, model outputs, user identifiers, hostnames, IP addresses, credentials, or configuration values.

## Turning it off

Set `AIP_TELEMETRY_DISABLED=1`. In the Helm chart that is `telemetry.enabled: false`. The installation works the same with telemetry off. If the endpoint is unreachable (for example, egress is blocked), reporting fails silently and serving is never affected.
