# Release and supported-version policy (self-hosted)

Customer-facing. Changes to this document are product changes. Review with Product and Support before merging.

## Versioning

Releases follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

| Change                                                                                                                   | Bump  | Example         |
| ------------------------------------------------------------------------------------------------------------------------ | ----- | --------------- |
| Breaking change to Helm values, Terraform module variables/outputs, public API, or an upgrade that requires manual steps | MAJOR | `1.x → 2.0.0`   |
| New features, backwards-compatible                                                                                       | MINOR | `1.4 → 1.5.0`   |
| Bug and security fixes only                                                                                              | PATCH | `1.4.2 → 1.4.3` |

A release consists of container images, the Helm chart, and the Terraform module bundle, all tagged with the same version. Mixing component versions is not supported.

## Cadence

- Minor releases: monthly.
- Patch releases: as needed. Critical security fixes ship within 72 hours of a fix being available.

## Support window

- We support the **latest three minor releases**. Example: when `1.8.0` ships, `1.6.x`, `1.7.x` and `1.8.x` are supported.
- Security fixes are backported to the latest patch of every supported minor.
- A major version receives security fixes for **12 months** after the next major ships.
- Out-of-support versions keep running, but we can't fix bugs in them. Support's first step will be an upgrade.

## Upgrade path

- Upgrades are supported from any supported minor to any later minor of the same major, **one minor at a time or skipping**. Data migrations are forward-only and run automatically on startup.
- Major upgrades must start from the **latest minor** of the previous major.
- Every release's notes list required actions, if any, under **Upgrade notes**.
- Downgrades are not supported after a release's migrations have run. Take the backup described in the upgrade runbook first.

## Version reporting

Installations report their version through call-home (see [call-home.md](call-home.md)). We use it to tell customers when they are approaching end of support. Air-gapped customers can report their version through Support instead.
