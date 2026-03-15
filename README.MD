# Cloud Compute Competition

Cloud-native event feedback platform with:

- two Next.js applications
- three Node.js backend services
- a shared reusable package
- Supabase as the persistence/auth layer
- Docker Compose for local integration
- Kubernetes as the deployment baseline

## What This Project Does

Attendees interact with the public `feedback-form` app during or after an event. Organisers and superadmins use the `dashboard` app to manage events, questions, quests, social content, analytics, and admin assignments.

Both apps proxy server-side requests to backend services. Those services own business logic and interact with Supabase directly.

## System Architecture

### Runtime Topology

```text
Browser
  |
  v
nginx
  |-- / ----------> dashboard (Next.js)
  |-- /feedback --> feedback-form (Next.js)
                       |
                       v
                Next.js API route handlers
                       |
                       v
        +--------------+---------------+
        |              |               |
        v              v               v
 event-service   feedback-service   analytics-service
        \              |               /
         \             |              /
          +------------+-------------+
                       |
                       v
                    Supabase
```

### Architectural Intent

This repo intentionally separates responsibilities into layers:

1. Browser UI in the two Next.js apps.
2. Thin app-level proxy routes in `app/api/**/route.js`.
3. Backend business logic in the three services.
4. Shared utilities and UI inside `@psd/shared`.
5. Persistence, auth, and RLS in Supabase.

That means the dominant request path is:

```text
React component -> Next.js route handler -> owning backend service -> Supabase
```

The app-level route handlers still matter even after the service split. They:

- validate incoming request shape close to the browser
- forward auth and request IDs
- hide internal service URLs from the browser
- normalize upstream responses
- fail closed with `503` instead of doing direct fallback queries

## Service Ownership

| Component | Responsibility |
| --- | --- |
| `dashboard` | Admin UI and Next.js proxy routes |
| `feedback-form` | Public event/feedback UI and Next.js proxy routes |
| `event-service` | Event access, event metadata, quests, social data, admin assignment |
| `feedback-service` | Feedback questions, options, submission, response export |
| `analytics-service` | Device entry, booth completion, booth metrics, aggregate analytics |
| `shared` | Shared UI, auth helpers, Supabase clients, logger, i18n, monitoring helpers |

### Final Domain Map

| Service | Owns |
| --- | --- |
| `event-service (4000)` | Event access validation, event metadata, social data |
| `feedback-service (4001)` | Questions CRUD, submit, response export, question management |
| `analytics-service (4002)` | Device-entry, booth-complete, booth-metrics, aggregate analytics |

## Frontend Architecture

### `dashboard`

The dashboard is the organiser-facing app. It contains the management UIs for:

- events
- quests
- social content
- feedback questions
- analytics
- response export
- superadmin-only admin assignment

It does not persist directly to Supabase for those domains. Its route handlers proxy to the owning backend service.

### `feedback-form`

The feedback form is the attendee-facing app. It contains:

- event access checks
- intro/story flow
- quest list flow
- public social content
- feedback question display
- feedback submission
- device-entry and booth-completion tracking

Its API routes are also proxies, but they are shaped for anonymous or semi-public traffic instead of admin workflows.

## Backend Architecture

### `event-service`

Owns:

- event access validation
- event listing and event CRUD
- quest CRUD
- social section CRUD
- social item CRUD
- superadmin admin-assignment flows

This is the source of truth for event metadata and social content.

### `feedback-service`

Owns:

- public question retrieval
- feedback submission
- response export
- question management
- question import
- question option retrieval
- question activation toggles

This is the source of truth for the feedback/question domain.

### `analytics-service`

Owns:

- device-entry writes
- booth-completion writes
- booth-level metrics
- aggregate analytics

This is the source of truth for event/booth analytics.

## Shared Package Architecture

`@psd/shared` is the canonical reusable package for both apps.

It contains:

- shared React components
- locale/i18n support
- browser and server Supabase helpers
- auth utilities
- logger
- error-monitoring helpers

The apps are expected to import shared code from `@psd/shared/...`, not from local duplicated copies.

## Persistence, Auth, and Security Model

### Supabase Usage

All three backend services query Supabase directly. The architecture does not currently require service-to-service calls between backend services.

### Public vs Server-Only Environment Variables

- `NEXT_PUBLIC_DB_URL` and `NEXT_PUBLIC_DB_ANON_KEY` are browser-exposed by design.
- `SUPABASE_URL` is the preferred backend/server-only Supabase URL name.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.

Backend services still support a fallback to `NEXT_PUBLIC_DB_URL` for backward compatibility, but `SUPABASE_URL` is the preferred naming going forward.

### Privileged Access Boundary

`SUPABASE_SERVICE_ROLE_KEY` is intentionally limited to:

- `services/event-service`
- `services/feedback-service`
- `services/analytics-service`
- `shared/src/lib/supabaseAdmin.js`

### Browser-Readable Data

Acceptable browser-side reads are intentionally narrow:

- Supabase auth/session methods
- `user_roles` self-read for client-side role gating, assuming RLS only permits a user to read their own row

Public social content, event metadata management, questions CRUD, and analytics writes now flow through backend services instead of direct browser CRUD.

## Repository Layout

```text
.
├── dashboard/                  Next.js admin app
├── feedback-form/              Next.js attendee app
├── shared/                     Canonical shared package
├── services/
│   ├── event-service/
│   ├── feedback-service/
│   └── analytics-service/
├── tests/
│   ├── e2e/
│   └── load/
├── k8s/
│   ├── base/
│   └── overlays/
├── infra/nginx/
├── docs/runbooks/
├── README.md
├── GUIDE.md
├── DEPLOYMENT.md
├── docker-compose.yml
└── docker-compose.staging.yml
```

## Local Setup and Run

### Recommended: Docker Compose

1. Create `.env` from the template:

```sh
cp .env.example .env
```

2. Fill in real credentials for Supabase and Google Translate.

3. Start the stack:

```sh
docker compose up -d --build
```

4. Open:

- Dashboard: `http://localhost:3000`
- Feedback form: `http://localhost:3001`
- nginx entrypoint: `http://localhost`

5. Stop the stack:

```sh
docker compose down
```

## Third-Party Audio

The prototype uses short clipped segments from four third-party tracks.
The team verified the original source pages as CC0 at the time of use.

- Suspect cells: <https://www.youtube.com/watch?v=xu7cFtkwz1g&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=9>
- Guardian cell: <https://www.youtube.com/watch?v=sG_ovPJwLd0&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=21>
- Feedback theme: <https://www.youtube.com/watch?v=5Kz6BdkCx9c&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=35>
- Background theme: <https://www.youtube.com/watch?v=ZfTxmwhrMfY&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=36>

### Direct Host Development

If you want to run the apps and services outside Docker:

1. Copy `.env.example` to `.env`.
2. Symlink each app’s `.env.local` to the root `.env`:

```sh
ln -sf ../.env dashboard/.env.local
ln -sf ../.env feedback-form/.env.local
```

3. Install dependencies in `shared`, all three services, both apps, and `tests/e2e`.
4. Run services on `localhost:4000-4002`.
5. Run the Next apps on `localhost:3000-3001`.
6. If you keep the compose-style service URLs in `.env`, override them to `http://localhost:4000`, `:4001`, and `:4002` when running the apps directly.

The more complete step-by-step version is in [GUIDE.md](/Users/wymenlim/Documents/Cloud_compute_competition/GUIDE.md).

## Verification Baseline

Phase verification now includes app route tests and the minimal E2E suite:

```sh
(cd shared && npm ci && npm test)
(cd services/event-service && npm ci && npm test)
(cd services/feedback-service && npm ci && npm test)
(cd services/analytics-service && npm ci && npm test)
(cd dashboard && npm ci && npm test && npm run lint && npm run build)
(cd feedback-form && npm ci && npm test && npm run lint && npm run build)
(cd tests/e2e && npm ci && npm run test:ci)
docker compose build && docker compose up -d
```

## Deployment Baseline

The default deployment target is Kubernetes.

- staging overlay: [k8s/overlays/staging/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/staging/kustomization.yaml)
- production overlay: [k8s/overlays/production/kustomization.yaml](/Users/wymenlim/Documents/Cloud_compute_competition/k8s/overlays/production/kustomization.yaml)
- deployment guide: [DEPLOYMENT.md](/Users/wymenlim/Documents/Cloud_compute_competition/DEPLOYMENT.md)

Docker Compose is for local development, smoke testing, and CI-style integration checks, not the default shared-environment deployment path.

## Key Documentation

- Full project guide: [GUIDE.md](/Users/wymenlim/Documents/Cloud_compute_competition/GUIDE.md)
- Deployment and secret flow: [DEPLOYMENT.md](/Users/wymenlim/Documents/Cloud_compute_competition/DEPLOYMENT.md)
- Service-down runbook: [docs/runbooks/service-down.md](/Users/wymenlim/Documents/Cloud_compute_competition/docs/runbooks/service-down.md)
- High-error-rate runbook: [docs/runbooks/high-error-rate.md](/Users/wymenlim/Documents/Cloud_compute_competition/docs/runbooks/high-error-rate.md)
