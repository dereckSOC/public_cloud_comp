# Gamified Feedback Application

Cloud-native event feedback platform with two Next.js applications, three Node.js backend services, a shared reusable package, Supabase as the persistence/auth layer, Docker Compose for local integration, and Kubernetes as the deployment baseline.

Attendees interact with the public `feedback-form` app during or after an event. Organisers and superadmins use the `dashboard` app to manage events, questions, quests, social content, analytics, and admin assignments.

## System Architecture

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

## Service Ownership

| Component | Responsibility |
| --- | --- |
| `dashboard` | Admin UI and Next.js proxy routes |
| `feedback-form` | Public event/feedback UI and Next.js proxy routes |
| `event-service` (4000) | Event access, event metadata, quests, social data, admin assignment |
| `feedback-service` (4001) | Feedback questions, options, submission, response export |
| `analytics-service` (4002) | Device entry, booth completion, booth metrics, aggregate analytics |
| `shared` | Shared UI, auth helpers, Supabase clients, logger, i18n, monitoring helpers |

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
├── docker-compose.yml
└── docker-compose.staging.yml
```

## Third-Party Audio

The prototype uses short clipped segments from four third-party tracks.
The team verified the original source pages as CC0 at the time of use.

- Suspect cells: <https://www.youtube.com/watch?v=xu7cFtkwz1g&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=9>
- Guardian cell: <https://www.youtube.com/watch?v=sG_ovPJwLd0&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=21>
- Feedback theme: <https://www.youtube.com/watch?v=5Kz6BdkCx9c&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=35>
- Background theme: <https://www.youtube.com/watch?v=ZfTxmwhrMfY&list=PLdsGes2mFh92eHpOZVJQgoubb6rF0CcvU&index=36>

## Supabase Folder

The `supabase/` folder is included for database handover.

- `supabase/migrations/` contains the database structure needed to recreate the system in another Supabase project if required.
- `supabase/config.toml` is the local Supabase CLI configuration file used for project setup.

## Key Documentation

- Full project guide (setup, APIs, deployment, observability): [GUIDE.md](GUIDE.md)
- Service-down runbook: [docs/runbooks/service-down.md](docs/runbooks/service-down.md)
- High-error-rate runbook: [docs/runbooks/high-error-rate.md](docs/runbooks/high-error-rate.md)
