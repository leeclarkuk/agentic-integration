# Verifying a release

Every image and release bundle is signed in CI with [Sigstore cosign](https://docs.sigstore.dev) keyless signing. The signing identity is our GitHub Actions release workflow, so there is no long-lived key to leak or rotate.

Replace `<org>`, `<repo>` and `<version>` below.

## Container images

```sh
cosign verify ghcr.io/<org>/aip-api:<version> \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# Build provenance (SLSA)
gh attestation verify oci://ghcr.io/<org>/aip-api:<version> --owner <org>
```

## Terraform bundle

```sh
cosign verify-blob SHA256SUMS --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github.com/<org>/<repo>/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
sha256sum -c SHA256SUMS
```

## Enforcing in-cluster

The BYOC GKE module enables Binary Authorization by default. Configure the project's policy to require our attestation so unsigned images are never admitted. If you mirror images into your own registry, re-sign them and update the policy.
