# Verifying a release

Every image and release bundle is signed in CI with [Sigstore cosign](https://docs.sigstore.dev) keyless signing. The signing identity is our GitHub Actions release workflow, so there is no long-lived key to leak or rotate.

Replace `<org>`, `<repo>` and `<version>` below. `<version>` has no leading `v`: the release tagged `v1.5.0` publishes images and a chart versioned `1.5.0`. Release candidates (`1.5.0-rc.1`) are signed and verified in exactly the same way.

## Container images

```sh
cosign verify ghcr.io/<org>/aip-api:<version> \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

Each image carries SLSA build provenance and an SPDX SBOM, attached to the image index at build time. The signature verified above covers the index, so it covers both. To read them (use `linux/arm64` for Arm):

```sh
# Build provenance (SLSA)
docker buildx imagetools inspect ghcr.io/<org>/aip-api:<version> \
  --format '{{ json (index .Provenance "linux/amd64").SLSA }}'

# SBOM (SPDX)
docker buildx imagetools inspect ghcr.io/<org>/aip-api:<version> \
  --format '{{ json (index .SBOM "linux/amd64").SPDX }}'
```

## Helm chart

```sh
cosign verify ghcr.io/<org>/charts/aip:<version> \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

The chart `.tgz` is also attached to the GitHub Release and listed in `SHA256SUMS`.

## Terraform bundle

The bundle is published to GHCR next to the chart. Verify it, then pull it with [ORAS](https://oras.land) (1.2 or later):

```sh
cosign verify ghcr.io/<org>/terraform/aip:<version> \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

oras pull ghcr.io/<org>/terraform/aip:<version>   # writes aip-terraform-v<version>.tar.gz
```

The bundle and the chart `.tgz` are also attached to the GitHub Release with a signed `SHA256SUMS`. If you downloaded them from there, verify them with:

```sh
cosign verify-blob SHA256SUMS --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
sha256sum -c SHA256SUMS
```

## Enforcing in-cluster

The BYOC GKE module enables Binary Authorization by default. Configure the project's policy to require our attestation so unsigned images are never admitted. If you mirror images into your own registry, re-sign them and update the policy.
