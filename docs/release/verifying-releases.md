# Verifying a release

Every image and release bundle is signed in CI with [Sigstore cosign](https://docs.sigstore.dev) keyless signing. The signing identity is our GitHub Actions release workflow, so there is no long-lived key to leak or rotate.

Replace `<org>`, `<repo>` and `<version>` below. `<version>` has no leading `v`: the release tagged `v1.5.0` publishes images and a chart versioned `1.5.0`. Release candidates (`1.5.0-rc.1`) are signed and verified in exactly the same way.

## Container images

```sh
cosign verify ghcr.io/<org>/aip-api:<version> \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# Build provenance (SLSA)
gh attestation verify oci://ghcr.io/<org>/aip-api:<version> --owner <org>
```

## Helm chart

```sh
cosign verify ghcr.io/<org>/charts/aip:<version> \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

The chart `.tgz` is also attached to the GitHub Release and listed in `SHA256SUMS`.

## Terraform bundle

```sh
cosign verify-blob SHA256SUMS --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
sha256sum -c SHA256SUMS
```

## Enforcing in-cluster

The BYOC GKE module enables Binary Authorization by default. Configure the project's policy to require our attestation so unsigned images are never admitted. If you mirror images into your own registry, re-sign them and update the policy.
