# ERP backend

NestJS API and Prisma data layer for the ERP application. Run commands from `backend` with project dependencies installed.

## Structure and configuration

- `src/modules/` contains implemented domain APIs and services.
- `prisma/` contains the schema and ordered migrations.
- `scripts/` contains guarded migration, QA, and operational utilities.
- `test/` contains foundation, integration, and end-to-end suites.

Copy `.env.example` for application configuration. `.env.qa.example` is an operator/CI profile and must not be loaded as the normal application runtime.

## Run

```bash
pnpm start:dev
```

The development API listens on `http://localhost:4500` and watches for changes. For a production-style start, build first and then run:

```bash
pnpm build
pnpm start:prod
```

## Prisma

Validate the configured schema and check or apply pending migrations:

```bash
pnpm prisma:validate
pnpm prisma:migrate:status
pnpm prisma:migrate:deploy
```

## Quality checks

```bash
pnpm typecheck
pnpm typecheck:test
pnpm lint:check
pnpm test
pnpm test:e2e
```

Configure local settings from `.env.example` before starting the service. The frontend development server is expected at `http://localhost:3200`.

QA scripts write reproducible local evidence to `.qa-runs/`; builds, coverage, uploads, certificates, generated clients, and operational reports are ignored. Commit only reviewed final evidence under [`docs/evidence`](../docs/evidence/).

## Configuration ownership

- `.env.example` contains application infrastructure, provider credentials, cryptographic key references, and worker controls only.
- `.env.qa.example` is an operator/CI profile for staging guards and test personas. Do not load it into the application runtime.
- Company module availability is stored in `CompanyModuleEntitlement`; do not add Company IDs or Branch IDs to environment files.
- Country, currency, timezone, reporting period, and workforce policies belong to Company/Branch records in PostgreSQL.
- `STORAGE_S3_PREFIX` is deployment-owned and must be explicit in production so staging and production objects cannot share a namespace accidentally.

Never run a mutating Prisma or QA command against `dsp_pms` merely to validate a code change. Use schema validation, the guarded staging workflow, and the current [operations](../docs/operations/README.md) and [testing](../docs/testing/) guidance.
