# DSP PMS / Group ERP

This repository contains:

- `frontend`: Next.js application running on port `3200`
- `backend`: NestJS API running on port `4500`
- `docs`: canonical product, engineering, operations, testing, and reference documentation
- `scripts`: repository and QA automation
- PostgreSQL access through Prisma
- AWS RDS SSL verification using the AWS CA bundle
- Database objects stored under the PostgreSQL schema `dsp_pms`

Start with the [documentation index](docs/README.md). Package-specific commands and generated-output policies are documented in the [frontend](frontend/README.md) and [backend](backend/README.md) guides. Raw QA runs, browser traces, generated previews, local caches, and compressed source snapshots are intentionally excluded from Git.

## Prerequisites

Install or obtain:

- Node.js 24.20.0 (see `.node-version`)
- pnpm 11.24.0 through Corepack
- Access to the configured PostgreSQL/AWS RDS database
- Redis 7.2.x (local Docker uses pinned `redis:7.2.16-alpine`, BSD-3-Clause) or a compatible managed Redis service
- The official AWS RDS CA bundle when connecting to RDS

For local development, start Redis with Docker from the repository root:

```powershell
cd C:\DataScape\HRMS\ERP
docker compose up -d redis
```

Point `REDIS_HOST=localhost` and `REDIS_PORT=6379` in `backend\.env`. For shared
environments, use your managed Redis host and set `REDIS_ENABLED=true` with the
matching password and port.

When the backend is running, `GET /health/ready` reports `redis: up` when
`REDIS_ENABLED=true` and the server responds to PING.

Verify Node.js and pnpm:

```powershell
node --version
corepack pnpm --version
```

## Environment configuration

Real environment files are intentionally excluded from Git. Create them from
the sanitized templates:

```powershell
cd C:\DataScape\HRMS\ERP

Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.local.example frontend\.env.local
```

Update `backend\.env` with the real database, Redis and email credentials. Set
`frontend\.env.local` `BACKEND_INTERNAL_URL` only when the backend differs from
`http://localhost:4500`. Browsers call the same-origin `/api` proxy.

The backend validates required settings and fails startup with a safe
configuration error when a required value is missing or invalid. New pool,
timeout, retry and logging variables have safe defaults, so existing local
environment files remain compatible.

Invitation and password-recovery links use these optional defaults:

```text
AUTH_ACTION_TOKEN_SECRET_PATH=certs/auth-action-secret
AUTH_INVITATION_TTL_SECONDS=86400
AUTH_PASSWORD_RESET_TTL_SECONDS=1800
AUTH_ACTION_RESEND_COOLDOWN_SECONDS=60
```

Raw invitation and reset tokens are never stored. They are HMAC-hashed using
the dedicated `AUTH_ACTION_TOKEN_SECRET_PATH` secret with separate token
domains. Development falls back to the authentication hash secret for existing
local environments, but production requires a distinct action-token secret.

For AWS RDS, place the official CA bundle here:

```text
backend\certs\global-bundle.pem
```

Generate local authentication keys once. These files are ignored by Git:

```powershell
cd C:\DataScape\HRMS\ERP\backend
node -e "const {generateKeyPairSync,randomBytes}=require('crypto');const {writeFileSync}=require('fs');const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});writeFileSync('certs/jwt-private.pem',privateKey);writeFileSync('certs/jwt-public.pem',publicKey);writeFileSync('certs/auth-hash-secret',randomBytes(32));writeFileSync('certs/auth-action-secret',randomBytes(32));"
```

The backend resolves `DATABASE_SSL_CA` from its current working directory.
Always start backend commands from the `backend` directory.

Do not commit:

- `backend\.env`
- `frontend\.env.local`
- database passwords or connection strings
- private certificates or application logs
- JWT private keys or authentication hash secrets

Only the sanitized example files should be committed.

## Install dependencies

### Backend

```powershell
cd C:\DataScape\HRMS\ERP\backend
corepack pnpm install --frozen-lockfile
corepack pnpm run prisma:validate
corepack pnpm run prisma:generate
corepack pnpm run prisma:migrate:status
```

`prisma:migrate:status` checks whether the configured database schema is
current.

Run the following only when approved migrations need to be applied:

```powershell
corepack pnpm run prisma:migrate:deploy
```

Do not run `prisma migrate reset` or `prisma migrate dev` against the shared
AWS database.

## Email and SaaS registration

For a local end-to-end registration test without sending email, use:

```powershell
SAAS_SELF_REGISTRATION_ENABLED=true
EMAIL_ENABLED=true
EMAIL_DEV_BYPASS=true
```

The verification page displays the six-digit development code returned by the
backend. The OTP is still hashed, expires and enforces attempt/cooldown rules.
`EMAIL_DEV_BYPASS=true` is rejected when `NODE_ENV=production`.

Configure the deployment's SMTP account:

```text
EMAIL_ENABLED=true
EMAIL_DEV_BYPASS=false
SMTP_HOST=<SMTP host>
SMTP_PORT=587
SMTP_USERNAME=<SMTP username>
SMTP_PASSWORD=<SMTP password or token>
SMTP_FROM_ADDRESS=noreply@your-verified-domain.example
SMTP_FROM_NAME=Group ERP
SMTP_REPLY_TO=
```

Port 587 uses STARTTLS (`secure=false`, `requireTLS=true`) with TLS 1.2 or
later. Before production registration is enabled, verify the sender domain
and the DNS records required by the SMTP provider.

The same mail configuration delivers user invitations and password-reset
links. With the development bypass enabled, the UI provides a local-only
continuation link; production rejects the bypass setting.

Platform Super Administrator access is not created through a public page.
Initial platform administration is a controlled deployment action; existing
Platform Super Administrators manage later administrative access from the
authenticated Security area.

Customer self-registration is available at
[http://localhost:3200/register](http://localhost:3200/register) only when
`SAAS_SELF_REGISTRATION_ENABLED=true` and email verification is available.
After verification, the Organization Owner completes the guided setup at
[http://localhost:3200/onboarding](http://localhost:3200/onboarding).
Keep it disabled in production until SMTP delivery and DNS verification are
complete. See [SaaS registration and SMTP](docs/getting-started/saas-registration.md).
The non-technical customer flow is documented in
[SaaS organization onboarding](docs/getting-started/organization-onboarding.md).

### Frontend

```powershell
cd C:\DataScape\HRMS\ERP\frontend
corepack pnpm install --frozen-lockfile
```

## Run in development

Keep two PowerShell terminals open.

### Terminal 1: backend

```powershell
cd C:\DataScape\HRMS\ERP\backend
corepack pnpm run start:dev
```

Wait for:

```text
event: application.ready
port: 4500
```

### Terminal 2: frontend

```powershell
cd C:\DataScape\HRMS\ERP\frontend
corepack pnpm run dev
```

Wait for Next.js to report that it is ready.

## Application URLs

- Main application UI: [http://localhost:3200/dashboard](http://localhost:3200/dashboard)
- Sign in: [http://localhost:3200/login](http://localhost:3200/login)
- Customer registration: [http://localhost:3200/register](http://localhost:3200/register)
- Organization onboarding: [http://localhost:3200/onboarding](http://localhost:3200/onboarding)
- Frontend root: [http://localhost:3200](http://localhost:3200)
- Backend API: [http://localhost:4500](http://localhost:4500)
- Swagger documentation: [http://localhost:4500/api](http://localhost:4500/api)
- Liveness: [http://localhost:4500/health/live](http://localhost:4500/health/live)
- Database readiness: [http://localhost:4500/health/ready](http://localhost:4500/health/ready)

Swagger is available only outside production. All application routes except
health and the explicit authentication/registration endpoints require an
active session.

## Reliability and logging

The backend uses bounded PostgreSQL pool, query, statement, lock and idle
transaction timeouts. It attempts the initial database connection three times
with exponential backoff and closes Prisma and the external PostgreSQL pool
during application shutdown.

Every HTTP request receives an `X-Request-ID`. Clients may send a valid request
ID; otherwise, the backend generates one. The same ID is returned in response
headers, error bodies and application logs.

Development logging is readable. Production logging is structured JSON written
to stdout so the hosting platform can collect and rotate it. Request bodies,
authentication values, database connection strings, SQL parameters, document
contents and sensitive HR/payroll data must never be logged.

The main optional reliability settings are:

| Variable | Default |
| --- | ---: |
| `DATABASE_POOL_SIZE` | `20` |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `10000` |
| `DATABASE_IDLE_TIMEOUT_MS` | `30000` |
| `DATABASE_QUERY_TIMEOUT_MS` | `30000` |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` |
| `DATABASE_LOCK_TIMEOUT_MS` | `5000` |
| `DATABASE_IDLE_TRANSACTION_TIMEOUT_MS` | `30000` |
| `DATABASE_MAX_LIFETIME_SECONDS` | `1800` |
| `DATABASE_CONNECT_RETRIES` | `3` |
| `DATABASE_CONNECT_RETRY_DELAY_MS` | `1000` |
| `DATABASE_HEALTH_TIMEOUT_MS` | `3000` |

These limits prevent requests from waiting indefinitely, but query/index
tuning is still required when monitoring identifies a slow operation.

## Authentication and authorization

The browser keeps short-lived access tokens only in memory. The rotating
refresh token is held in an HTTP-only cookie. Redis caches session validation;
PostgreSQL remains the durable session and RBAC source and is used as a bounded
fallback when Redis is unavailable.

The starter roles are Super Administrator, Organization Owner, Company
Administrator, HR Manager, Project Manager, Asset Manager and Employee.
Organization Owner access is limited to one Company Group. Concurrent sessions
support per-session revocation and sign-out-all.

See [the security route matrix](docs/architecture/security-route-matrix.md) for permission
and organization-scope rules.

## Production build

### Backend

```powershell
cd C:\DataScape\HRMS\ERP\backend
corepack pnpm install --frozen-lockfile
corepack pnpm run prisma:generate
corepack pnpm run build
corepack pnpm run start:prod
```

### Frontend

```powershell
cd C:\DataScape\HRMS\ERP\frontend
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm run start
```

Use a process manager or container platform for actual production hosting.
Do not keep production secrets in source-controlled files.

## Common startup problems

### Database connection timeout

Check:

- the AWS RDS instance is reachable
- the current machine or server IP is allowed by the RDS security group
- `DATABASE_URL` contains the correct host, port, database and credentials
- the database user can access the `dsp_pms` schema

### SSL certificate error

Check:

- `backend\certs\global-bundle.pem` exists
- `DATABASE_SSL_CA=certs/global-bundle.pem`
- the backend command was started inside the `backend` directory

### Port already in use

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3200,4500
```

Stop the existing application process or change the configured port before
starting another instance.
