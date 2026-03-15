# Deployment Guide

## Default Target

The default deployment target for this repo is Kubernetes with Kustomize overlays.

- `k8s/overlays/staging` -> shared pre-production environment
- `k8s/overlays/production` -> production environment

Docker Compose remains useful for local development and smoke testing, but it is not the primary deployment path.

## Overlay Layout

Base manifests live under `k8s/base/`.

- Base: [k8s/base/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/base/kustomization.yaml)
- Staging overlay: [k8s/overlays/staging/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/staging/kustomization.yaml)
- Production overlay: [k8s/overlays/production/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/production/kustomization.yaml)

Environment differences:

- `staging`
  - namespace: `psd-staging`
  - example host: `staging.psd.example.com`
  - 1 replica per deployment
  - HPA range: 1-3
  - example image tags: `:staging`
- `production`
  - namespace: `psd`
  - example host: `psd.example.com`
  - base replica and HPA settings
  - example image tags: `:prod`

Replace the example image registry names and ingress hosts before your first real deploy.

## Prerequisites

- Kubernetes cluster with a working `kubectl` context
- `kubectl` 1.28+ with Kustomize support
- ingress controller installed
- metrics-server installed if you want HPA telemetry
- External Secrets Operator installed for the default secret flow
- a configured `ClusterSecretStore` or equivalent secret-manager integration
- container images published to a registry reachable by the cluster

## Image Configuration

The overlays currently map local development image names to example GHCR paths:

- `ghcr.io/your-org/psd-dashboard`
- `ghcr.io/your-org/psd-feedback-form`
- `ghcr.io/your-org/psd-event-service`
- `ghcr.io/your-org/psd-feedback-service`
- `ghcr.io/your-org/psd-analytics-service`

Before deploying, update the `images` block in the overlay you plan to use or have CI generate the final overlay with your real registry and tag values.

## Secret Flow

Do not create deployment secrets from `.env` as the default workflow.

The supported deployment flow is:

1. Store environment values in your secret manager.
2. Sync them into Kubernetes as `app-secrets` using External Secrets.
3. Apply the relevant overlay.

Example manifests are provided here:

- staging: [k8s/overlays/staging/external-secret.example.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/staging/external-secret.example.yaml)
- production: [k8s/overlays/production/external-secret.example.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/production/external-secret.example.yaml)

Those files are templates only. Replace:

- `secretStoreRef.name`
- all `remoteRef.key` values
- any environment-specific secret keys your platform requires

The workloads expect a Kubernetes `Secret` named `app-secrets` in the target namespace.

Emergency fallback only:

- [k8s/secrets.example.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/secrets.example.yaml) can be used for one-off local cluster bootstrap
- it is not the default or recommended staging/production flow

## Staging Deploy

1. Update image names/tags in [k8s/overlays/staging/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/staging/kustomization.yaml).
2. Update the example host in the staging ingress patch if needed.
3. Create the staging `app-secrets` secret through External Secrets.
4. Apply the overlay.

Commands:

```sh
kubectl apply -f k8s/overlays/staging/external-secret.example.yaml
kubectl get externalsecret,secret -n psd-staging
kubectl apply -k k8s/overlays/staging
kubectl rollout status deployment/dashboard -n psd-staging
kubectl rollout status deployment/feedback-form -n psd-staging
kubectl rollout status deployment/event-service -n psd-staging
kubectl rollout status deployment/feedback-service -n psd-staging
kubectl rollout status deployment/analytics-service -n psd-staging
```

## Production Deploy

1. Update image names/tags in [k8s/overlays/production/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/production/kustomization.yaml).
2. Update the example host in the production ingress patch if needed.
3. Create the production `app-secrets` secret through External Secrets.
4. Apply the overlay.

Commands:

```sh
kubectl apply -f k8s/overlays/production/external-secret.example.yaml
kubectl get externalsecret,secret -n psd
kubectl apply -k k8s/overlays/production
kubectl rollout status deployment/dashboard -n psd
kubectl rollout status deployment/feedback-form -n psd
kubectl rollout status deployment/event-service -n psd
kubectl rollout status deployment/feedback-service -n psd
kubectl rollout status deployment/analytics-service -n psd
```

## Validation

Render manifests locally:

```sh
kubectl kustomize k8s/overlays/staging > /dev/null
kubectl kustomize k8s/overlays/production > /dev/null
```

Validate against the API server:

```sh
kubectl apply --dry-run=server -k k8s/overlays/staging
kubectl apply --dry-run=server -k k8s/overlays/production
```

Post-deploy checks:

```sh
kubectl get deploy,hpa,ingress -n psd-staging
kubectl get deploy,hpa,ingress -n psd
kubectl get pods -n psd-staging
kubectl get pods -n psd
```

## Rollback

Use standard Kubernetes rollout rollback commands:

```sh
kubectl rollout undo deployment/dashboard -n psd
kubectl rollout undo deployment/feedback-form -n psd
kubectl rollout undo deployment/event-service -n psd
kubectl rollout undo deployment/feedback-service -n psd
kubectl rollout undo deployment/analytics-service -n psd
```

For staging, replace `psd` with `psd-staging`.

## Operations Docs

Operational detail lives in:

- [docs/runbooks/service-down.md](/Users/wymenlim/Documents/Cloud_compute_competition/docs/runbooks/service-down.md)
- [docs/runbooks/high-error-rate.md](/Users/wymenlim/Documents/Cloud_compute_competition/docs/runbooks/high-error-rate.md)

Architecture and ownership notes live in:

- [GUIDE.md](/Users/wymenlim/Documents/Cloud_compute_competition/GUIDE.md)

## Local-Only Note

For local development, use:

```sh
docker compose up --build
```

That path is intentionally separate from the documented shared-environment deployment flow above.
