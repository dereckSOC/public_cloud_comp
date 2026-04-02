# Cloud Compute Competition Guide

Cloud-native feedback collection platform built with two Next.js apps, three Node.js backend services, Supabase, and Kubernetes.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup and Run](#setup-and-run)
5. [Environment Variables](#environment-variables)
6. [Project Structure](#project-structure)
7. [API Surface](#api-surface)
8. [Kubernetes Deployment](#kubernetes-deployment)
   - [Overlay Layout](#overlay-layout)
   - [Kubernetes Prerequisites](#kubernetes-prerequisites)
   - [Image Configuration](#image-configuration)
   - [Secret Flow](#secret-flow)
   - [Staging Deploy](#staging-deploy)
   - [Production Deploy](#production-deploy)
   - [Validation](#validation)
   - [Rollback](#rollback)
9. [CI and Testing](#ci-and-testing)
10. [Observability](#observability)
11. [Troubleshooting](#troubleshooting)

## Project Overview

This repository contains a feedback platform for live events.

- `feedback-form` is the public experience used by attendees.
- `dashboard` is the admin experience used by event organisers and superadmins.
- `event-service` owns event metadata, event access validation, quest management, social content, and admin assignment.
- `feedback-service` owns feedback question management, feedback submission, and response export.
- `analytics-service` owns device-entry analytics, booth completion tracking, booth metrics, and aggregate analytics.
- `shared` is the canonical reusable package for shared UI, auth helpers, Supabase clients, logging, and common utilities.

The current deployment baseline is Kubernetes. Docker Compose remains the recommended local-development and integration-test path.

## Architecture

### High-Level Request Flow

```text
Browser
  |
  v
nginx (port 80)
  |-- / ----------> dashboard (Next.js, port 3000)
  |-- /feedback --> feedback-form (Next.js, port 3001)
                       |
                       v
                Next.js API route handlers
                       |
                       v
        +--------------+---------------+
        |              |               |
        v              v               v
 event-service   feedback-service   analytics-service
    (4000)            (4001)             (4002)
        \              |               /
         \             |              /
          +------------+-------------+
                       |
                       v
             Supabase (PostgreSQL + Auth + RLS)
```

### Why the Apps Still Have API Routes

The Next.js apps intentionally keep `app/api/**/route.js` handlers even after the service extraction. They are now thin proxies instead of business-logic fallbacks.

Those route handlers are responsible for:

- validating request shape close to the browser
- forwarding `Authorization` and `X-Request-ID`
- hiding internal service URLs from the browser
- normalizing upstream JSON and status codes
- returning `503 { "error": "Service unavailable" }` when a required backend is not configured

The target architecture is:

```text
React component -> Next.js route handler -> owning backend service -> Supabase
```

### Domain Ownership

| Service | Owns |
| --- | --- |
| `event-service` (`4000`) | Event access validation, event metadata, social data, quests, event-admin assignment |
| `feedback-service` (`4001`) | Question CRUD, feedback submission, question import/options/toggle, response export |
| `analytics-service` (`4002`) | Device-entry, booth-complete, booth-metrics, aggregate analytics |

### Frontend Responsibilities

#### `dashboard`

`dashboard` is the admin-facing Next.js app.

It owns:

- event management UI
- quest management UI
- social content management UI
- feedback question management UI
- analytics and export views
- superadmin assignment UI
- proxy routes for admin and reporting flows

It does not own domain persistence. Its `/api/**` handlers proxy to the backend services above.

#### `feedback-form`

`feedback-form` is the attendee-facing Next.js app.

It owns:

- event discovery and access checks
- intro/story and questlist flows
- feedback question display and submission
- public social content display
- visitor analytics entry/completion events
- proxy routes for public feedback and analytics flows

### Shared Package

`@psd/shared` is the single source of truth for reusable code across both apps.

It includes:

- shared UI components
- i18n support
- browser and server Supabase helpers
- auth helpers
- logger
- error monitoring hooks

Neither app should keep duplicated copies of shared `lib/`, `components/`, or locale files.

### Data Ownership and Security Boundaries

#### Browser-readable by design

- `NEXT_PUBLIC_DB_URL`
- `NEXT_PUBLIC_DB_ANON_KEY`
- Supabase auth session methods
- `user_roles` self-read for client-side role gating, assuming RLS only permits a user to read their own row

#### Server-only / privileged

`SUPABASE_SERVICE_ROLE_KEY` is intentionally limited to:

- `services/event-service`
- `services/feedback-service`
- `services/analytics-service`
- `shared/src/lib/supabaseAdmin.js`

Browser code should never receive or embed the service-role key.

#### Auth model

- write operations and privileged reads go through backend services
- service endpoints enforce Bearer-token access where required
- admin assignment flows are backend-only
- public attendee flows use service endpoints that validate event access without exposing privileged credentials

### Deployment Topology

#### Local

- Docker Compose starts all services plus nginx
- direct ports are exposed for debugging
- nginx provides the same entry-path split used in deployed environments

#### Kubernetes

- `k8s/base` contains the baseline manifests
- `k8s/overlays/staging` defines staging namespace/replica/HPA/ingress differences
- `k8s/overlays/production` defines production ingress and image-tag differences
- HPAs exist for all five workloads
- resource requests and limits are defined on all deployments

Operational deployment detail is documented in [DEPLOYMENT.md](/Users/wymenlim/Documents/Cloud_compute_competition/DEPLOYMENT.md).

## Prerequisites

- Node.js 20 or later
- npm
- Docker 24+ and Docker Compose 2.20+
- Git
- a Supabase project
- a Google Cloud Translate API key
- `kubectl` 1.28+ with a working cluster context if you want to validate or deploy Kubernetes manifests

Optional:

- Playwright browsers for local browser-style E2E expansion
- `k6` if you want to run the manual load scripts

## Setup and Run

### Recommended: Docker Compose

This is the easiest way to run the full stack locally and the closest path to the integration checks used throughout the project.

#### 1. Create the root env file

```sh
cp .env.example .env
```

Fill in real values for:

- `NEXT_PUBLIC_DB_URL`
- `NEXT_PUBLIC_DB_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_TRANSLATE_API_KEY`

The default service URLs in `.env.example` are correct for Docker Compose:

- `EVENT_SERVICE_URL=http://event-service:4000`
- `FEEDBACK_SERVICE_URL=http://feedback-service:4001`
- `ANALYTICS_SERVICE_URL=http://analytics-service:4002`

#### 2. Build and start the stack

```sh
docker compose up --build
```

Use detached mode if preferred:

```sh
docker compose up -d --build
```

#### 3. Open the apps

Direct app ports:

- Dashboard: `http://localhost:3000`
- Feedback form: `http://localhost:3001`

nginx entrypoint:

- Dashboard via nginx: `http://localhost/`
- Feedback form via nginx: `http://localhost/feedback`

Backend service ports:

- Event service: `http://localhost:4000`
- Feedback service: `http://localhost:4001`
- Analytics service: `http://localhost:4002`

#### 4. Stop the stack

```sh
docker compose down
```

If you need a clean rebuild:

```sh
docker compose build --no-cache
docker compose up -d
```

### Direct Host Development

Use this only if you want to run the Next.js apps and services directly on your machine instead of through Docker.

#### 1. Create the root env file

```sh
cp .env.example .env
```

#### 2. Point app env files at the root env

Run from the repo root:

```sh
ln -sf ../.env dashboard/.env.local
ln -sf ../.env feedback-form/.env.local
```

The app-level `.env.example` files are only thin pointers back to the root env file.

#### 3. Install dependencies

```sh
(cd shared && npm ci)
(cd services/event-service && npm ci)
(cd services/feedback-service && npm ci)
(cd services/analytics-service && npm ci)
(cd dashboard && npm ci)
(cd feedback-form && npm ci)
(cd tests/e2e && npm ci)
```

#### 4. Override service URLs for host-based app runs

The root `.env.example` uses Docker-internal service names. If you run the apps directly on your machine, the Next.js apps must reach the services on `localhost` instead.

You can either edit `.env` temporarily or pass shell overrides when starting the apps:

```sh
(cd dashboard && \
  EVENT_SERVICE_URL=http://localhost:4000 \
  FEEDBACK_SERVICE_URL=http://localhost:4001 \
  ANALYTICS_SERVICE_URL=http://localhost:4002 \
  npm run dev)
```

```sh
(cd feedback-form && \
  EVENT_SERVICE_URL=http://localhost:4000 \
  FEEDBACK_SERVICE_URL=http://localhost:4001 \
  ANALYTICS_SERVICE_URL=http://localhost:4002 \
  npm run dev)
```

#### 5. Start the backend services

Open separate terminals:

```sh
cd services/event-service && npm run start
```

```sh
cd services/feedback-service && npm run start
```

```sh
cd services/analytics-service && npm run start
```

#### 6. Start the apps

```sh
cd dashboard && npm run dev
```

```sh
cd feedback-form && npm run dev
```

### Verification Plan

After major phases or before release, this is the expected verification baseline:

```sh
# installs
(cd shared && npm ci)
(cd services/event-service && npm ci)
(cd services/feedback-service && npm ci)
(cd services/analytics-service && npm ci)
(cd dashboard && npm ci)
(cd feedback-form && npm ci)
(cd tests/e2e && npm ci)

# tests
(cd shared && npm test)
(cd services/event-service && npm test)
(cd services/feedback-service && npm test)
(cd services/analytics-service && npm test)
(cd dashboard && npm test && npm run lint && npm run build)
(cd feedback-form && npm test && npm run lint && npm run build)
(cd tests/e2e && npm run test:ci)

# integration
(docker compose build)
docker compose up -d
```

## Environment Variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Description | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DB_URL` | Supabase project URL exposed to browser code | Yes | Required for browser-facing Supabase clients |
| `NEXT_PUBLIC_DB_ANON_KEY` | Supabase anon key | Yes | Safe to expose only because RLS governs access |
| `SUPABASE_URL` | Preferred backend/server-only Supabase URL | Yes | Preferred for services and server-only clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key | Yes | Backend only |
| `GOOGLE_TRANSLATE_API_KEY` | Translation API key | Yes | Server-side translation proxy |
| `EVENT_SERVICE_URL` | Event-service base URL | Yes | App proxy target |
| `FEEDBACK_SERVICE_URL` | Feedback-service base URL | Yes | App proxy target |
| `ANALYTICS_SERVICE_URL` | Analytics-service base URL | Yes | App proxy target |
| `LOG_LEVEL` | Structured logger minimum severity | No | `debug`, `info`, `warn`, `error` |
| `ERROR_WEBHOOK_URL` | Optional error-reporting webhook | No | Slack, Sentry-compatible webhook, etc. |

### Public vs Server-Only

- `NEXT_PUBLIC_*` variables are compiled into browser bundles
- `SUPABASE_URL` is the preferred backend name
- services intentionally keep fallback support to `NEXT_PUBLIC_DB_URL` for backward compatibility during migration
- browser code still relies on `NEXT_PUBLIC_DB_URL`

### Key Rotation

Key rotation remains a manual operational follow-up outside code changes.

Required rotation checklist:

1. Generate replacement values for `NEXT_PUBLIC_DB_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GOOGLE_TRANSLATE_API_KEY`.
2. Update local `.env`, CI/CD secrets, Docker Compose environments, Kubernetes secret sources, and any external secret manager entries.
3. Redeploy both apps and all backend services.
4. Verify auth, translation, and health flows.
5. Revoke the old keys.

## Project Structure

```text
Cloud_compute_competition/
├── dashboard/                  Next.js admin app
│   ├── src/app/
│   │   ├── api/                Thin proxy routes
│   │   └── dashboard/          Admin UI
│   └── tests/                  Route-level integration tests
├── feedback-form/              Next.js attendee app
│   ├── src/app/
│   │   ├── api/                Thin proxy routes
│   │   └── ...                 Public event / feedback pages
│   └── tests/                  Route-level integration tests
├── shared/                     Canonical shared package
│   └── src/lib/                Auth, Supabase helpers, logger, i18n, metrics
├── services/
│   ├── event-service/          Event, quest, social, admin assignment service
│   ├── feedback-service/       Feedback question + submission service
│   └── analytics-service/      Analytics and booth metrics service
├── k8s/
│   ├── base/                   Base deployments, services, HPA, ingress, namespace
│   └── overlays/               Staging and production overlays
├── infra/nginx/                Reverse proxy configuration
├── tests/
│   ├── e2e/                    Playwright tests and CI mock stack
│   └── load/                   Manual k6 scripts
├── docs/runbooks/              Service-down and high-error-rate runbooks
├── .github/workflows/ci.yml    CI pipeline
├── docker-compose.yml          Local stack
├── docker-compose.staging.yml  Local staging-style overrides
├── README.md                   Architecture-first entry point
└── DEPLOYMENT.md               Deployment-specific operational guide
```

## API Surface

### Dashboard App Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/metrics` | Prometheus metrics |
| `POST` | `/api/translate` | Translation proxy |
| `GET`, `POST` | `/api/events` | List events, create event |
| `PUT`, `DELETE` | `/api/events/:id` | Update or delete an event |
| `GET` | `/api/events/access` | Event access lookup |
| `GET`, `POST` | `/api/quests` | List or create quests |
| `PUT`, `DELETE` | `/api/quests/:id` | Update or delete a quest |
| `GET`, `POST` | `/api/social/sections` | List or create social sections |
| `PUT`, `DELETE` | `/api/social/sections/:id` | Update or delete a social section |
| `GET`, `POST` | `/api/social/items` | List or create social items |
| `PUT`, `DELETE` | `/api/social/items/:id` | Update or delete a social item |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/feedback/questions` | Question-management proxy |
| `POST` | `/api/feedback/questions/import` | Import question |
| `GET` | `/api/feedback/questions/options` | Fetch question options |
| `GET` | `/api/feedback/responses` | Export responses |
| `GET` | `/api/analytics/aggregate` | Aggregate analytics |
| `GET` | `/api/analytics/booth-metrics` | Booth metrics |
| `POST` | `/api/analytics/device-entry` | Device-entry proxy |
| `POST` | `/api/analytics/booth-complete` | Booth-complete proxy |
| `GET` | `/api/admin/assignable-users` | Superadmin assignment helper |
| `POST` | `/api/admin/event-admins` | Assign admins to events |

### Feedback-Form App Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/metrics` | Prometheus metrics |
| `POST` | `/api/translate` | Translation proxy |
| `GET` | `/api/events/access` | Event access validation |
| `GET` | `/api/feedback/questions` | Public feedback questions |
| `POST` | `/api/feedback/submit` | Feedback submission |
| `GET` | `/api/social/sections` | Public social sections |
| `GET` | `/api/social/items` | Public social items |
| `POST` | `/api/analytics/device-entry` | Device-entry proxy |
| `POST` | `/api/analytics/booth-complete` | Booth-complete proxy |

### Event-Service

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/events/access?eventId=<n>` | Event access lookup |
| `GET`, `POST` | `/events` | List or create events |
| `PUT`, `DELETE` | `/events/:id` | Update or delete an event |
| `GET`, `POST` | `/quests` | List or create quests |
| `PUT`, `DELETE` | `/quests/:id` | Update or delete a quest |
| `GET`, `POST` | `/social-sections` | List or create sections |
| `PUT`, `DELETE` | `/social-sections/:id` | Update or delete a section |
| `GET`, `POST` | `/social-items` | List or create items |
| `PUT`, `DELETE` | `/social-items/:id` | Update or delete an item |
| `GET` | `/admin/assignable-users` | List assignable users |
| `POST` | `/admin/event-admins` | Assign admins to events |

### Feedback-Service

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/questions?eventId=<n>` | Public question list |
| `POST` | `/submit` | Persist a feedback submission |
| `GET` | `/responses/export?eventId=<n>` | Export event responses |
| `GET` | `/questions/manage?eventId=<n>` | List managed questions |
| `POST` | `/questions/manage` | Create question |
| `POST` | `/questions/manage/import` | Import question |
| `GET` | `/questions/manage/:id/options` | Fetch options |
| `PUT` | `/questions/manage/:id` | Update question |
| `PUT` | `/questions/manage/:id/toggle` | Toggle question active state |
| `DELETE` | `/questions/manage/:id?eventId=<n>` | Delete question |

### Analytics-Service

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/device-entry` | Persist a device entry |
| `POST` | `/booth-complete` | Persist a booth completion |
| `GET` | `/booth-metrics?eventId=<n>` | Booth metrics |
| `GET` | `/analytics?eventId=<n>` | Aggregate analytics |

## Kubernetes Deployment

Kubernetes is the default deployment target for this repo.

- `k8s/overlays/staging` → shared pre-production environment
- `k8s/overlays/production` → production environment

Docker Compose remains useful for local development and smoke testing, but it is not the primary deployment path.

### Overlay Layout

Base manifests live under `k8s/base/`.

- Base: [k8s/base/kustomization.yaml](k8s/base/kustomization.yaml)
- Staging overlay: [k8s/overlays/staging/kustomization.yaml](k8s/overlays/staging/kustomization.yaml)
- Production overlay: [k8s/overlays/production/kustomization.yaml](k8s/overlays/production/kustomization.yaml)

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

### Kubernetes Prerequisites

- Kubernetes cluster with a working `kubectl` context
- `kubectl` 1.28+ with Kustomize support
- ingress controller installed
- metrics-server installed if you want HPA telemetry
- External Secrets Operator installed for the default secret flow
- a configured `ClusterSecretStore` or equivalent secret-manager integration
- container images published to a registry reachable by the cluster

### Image Configuration

The overlays currently map local development image names to example GHCR paths:

- `ghcr.io/your-org/psd-dashboard`
- `ghcr.io/your-org/psd-feedback-form`
- `ghcr.io/your-org/psd-event-service`
- `ghcr.io/your-org/psd-feedback-service`
- `ghcr.io/your-org/psd-analytics-service`

Before deploying, update the `images` block in the overlay you plan to use or have CI generate the final overlay with your real registry and tag values.

### Secret Flow

Do not create deployment secrets from `.env` as the default workflow.

The supported deployment flow is:

1. Store environment values in your secret manager.
2. Sync them into Kubernetes as `app-secrets` using External Secrets.
3. Apply the relevant overlay.

Example manifests are provided here:

- staging: [k8s/overlays/staging/external-secret.example.yaml](k8s/overlays/staging/external-secret.example.yaml)
- production: [k8s/overlays/production/external-secret.example.yaml](k8s/overlays/production/external-secret.example.yaml)

Those files are templates only. Replace:

- `secretStoreRef.name`
- all `remoteRef.key` values
- any environment-specific secret keys your platform requires

The workloads expect a Kubernetes `Secret` named `app-secrets` in the target namespace.

Emergency fallback only:

- [k8s/secrets.example.yaml](k8s/secrets.example.yaml) can be used for one-off local cluster bootstrap
- it is not the default or recommended staging/production flow

### Staging Deploy

1. Update image names/tags in [k8s/overlays/staging/kustomization.yaml](k8s/overlays/staging/kustomization.yaml).
2. Update the example host in the staging ingress patch if needed.
3. Create the staging `app-secrets` secret through External Secrets.
4. Apply the overlay.

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

### Production Deploy

1. Update image names/tags in [k8s/overlays/production/kustomization.yaml](k8s/overlays/production/kustomization.yaml).
2. Update the example host in the production ingress patch if needed.
3. Create the production `app-secrets` secret through External Secrets.
4. Apply the overlay.

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

### Validation

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

### Rollback

Use standard Kubernetes rollout rollback commands:

```sh
kubectl rollout undo deployment/dashboard -n psd
kubectl rollout undo deployment/feedback-form -n psd
kubectl rollout undo deployment/event-service -n psd
kubectl rollout undo deployment/feedback-service -n psd
kubectl rollout undo deployment/analytics-service -n psd
```

For staging, replace `psd` with `psd-staging`.

## CI and Testing

### CI Jobs

The GitHub Actions workflow in [.github/workflows/ci.yml](/Users/wymenlim/Documents/Cloud_compute_competition/.github/workflows/ci.yml) currently covers:

- shared package tests
- `event-service` tests
- `feedback-service` tests
- `analytics-service` tests
- `dashboard` route tests, lint, and build
- `feedback-form` route tests, lint, and build
- minimal Playwright E2E job:
  - service health checks
  - one feedback submission

The E2E CI job uses a mock Supabase stack defined under `tests/e2e/` so it can run without production credentials.

### Local Test Commands

#### Shared

```sh
cd shared && npm test
```

#### Services

```sh
(cd services/event-service && npm test)
(cd services/feedback-service && npm test)
(cd services/analytics-service && npm test)
```

#### App Proxy Route Integration Tests

```sh
(cd dashboard && npm test)
(cd feedback-form && npm test)
```

#### Lint and Build

```sh
(cd dashboard && npm run lint && npm run build)
(cd feedback-form && npm run lint && npm run build)
```

#### Playwright E2E

Minimal CI-style subset:

```sh
cd tests/e2e
npm ci
npm run test:ci
```

Full Playwright suite:

```sh
cd tests/e2e
npm ci
npx playwright install
npm test
```

#### Load Tests

Load tests remain manual until staging is stable.

Examples:

```sh
k6 run tests/load/event-access.js
k6 run tests/load/feedback-submit.js
k6 run tests/load/feedback-questions.js
k6 run tests/load/analytics-aggregate.js
k6 run tests/load/device-entry-service.js
```

## Observability

### Structured Logging

All server-side code uses the shared logger in `shared/src/lib/logger.js`.

Each log line is JSON and includes:

- `severity`
- `message`
- `timestamp`
- bound fields such as `service`, `requestId`, `method`, `path`, and `err`

`ERROR` logs go to stderr. Other levels go to stdout.

Minimum log level is controlled with:

```text
LOG_LEVEL=debug|info|warn|error
```

### Metrics

Both Next.js apps expose Prometheus-format metrics:

```sh
curl http://localhost:3000/api/metrics
curl http://localhost:3001/api/metrics
```

### Request IDs

- nginx creates `X-Request-ID`
- the Next.js proxy layer forwards it
- backend services include it in logs and response headers

This makes cross-service request tracing possible.

### Error Reporting

If `ERROR_WEBHOOK_URL` is configured, server-side error payloads are forwarded to that webhook. If it is unset, errors stay in logs only.

## Troubleshooting

### Docker daemon not running

Symptom:

- `Cannot connect to the Docker daemon`

Typical fix:

```sh
docker ps
```

If Docker is stopped, start Docker Desktop or your system Docker daemon and retry.

### Port already in use

Symptom:

- `address already in use`

Fix:

```sh
docker compose down
docker compose up --build
```

### Build fails with module-resolution errors

Fix:

```sh
docker compose build --no-cache
```

If the failure is in the apps, also rerun:

```sh
(cd dashboard && npm ci)
(cd feedback-form && npm ci)
```

### Service unhealthy in Docker Compose

Inspect logs:

```sh
docker compose logs event-service
docker compose logs feedback-service
docker compose logs analytics-service
docker compose logs dashboard
docker compose logs feedback-form
```

### Supabase connection issues

Check:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- reachability of your Supabase project

Common symptoms:

- missing `SUPABASE_SERVICE_ROLE_KEY`
- `ECONNREFUSED`
- auth/token lookup failures

### Kubernetes `CrashLoopBackOff`

Start with:

```sh
kubectl get pods -n psd
kubectl logs <pod-name> -n psd --tail=100
kubectl logs <pod-name> -n psd --previous
```

Common causes:

- `app-secrets` missing or not populated
- upstream service URL or secret value wrong
- image not published or not pullable
- incomplete build artifact

Useful recovery commands:

```sh
kubectl rollout restart deployment/dashboard -n psd
kubectl rollout restart deployment/feedback-form -n psd
kubectl rollout restart deployment/event-service -n psd
kubectl rollout restart deployment/feedback-service -n psd
kubectl rollout restart deployment/analytics-service -n psd
```

Runbooks:

- [docs/runbooks/service-down.md](/Users/wymenlim/Documents/Cloud_compute_competition/docs/runbooks/service-down.md)
- [docs/runbooks/high-error-rate.md](/Users/wymenlim/Documents/Cloud_compute_competition/docs/runbooks/high-error-rate.md)

### HPA shows `cpu: <unknown>/70%`

That usually means:

- metrics-server is not installed, or
- metrics are not yet available for the cluster

Check with:

```sh
kubectl top pods -n psd
kubectl get hpa -n psd
```

### High API error rate

Check metrics and logs:

```sh
kubectl port-forward svc/dashboard 3000:3000 -n psd &
curl http://localhost:3000/api/metrics
kubectl logs -l app=dashboard -n psd --tail=200 | grep '"severity":"ERROR"'
```

Roll back if needed:

```sh
kubectl rollout undo deployment/dashboard -n psd
kubectl rollout undo deployment/feedback-form -n psd
kubectl rollout undo deployment/event-service -n psd
kubectl rollout undo deployment/feedback-service -n psd
kubectl rollout undo deployment/analytics-service -n psd
```
