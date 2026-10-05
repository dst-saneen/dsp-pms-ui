# WP-07 Baseline

Date: 2026-08-05

## Scope

Implemented persistent notifications, transactional outbox processing, and gated workforce scheduled jobs.

Delivered:

- `UserNotificationService` with idempotent create (`dedupeKey`), list, mark-read, mark-all-read.
- Safe notification event catalog (no reasons/remarks/private content in titles or messages).
- Shared `OutboxWriterService` with payload sanitization and dedupe-safe writes.
- `OutboxProcessorService` with claim/lock, abandoned-lock recovery, backoff, and notification fan-out.
- Shift roster outbox delegated to the shared writer.
- `WorkforceJobsScheduler` for outbox, attendance finalizer, and Comp-off expiry; gated by `WORKFORCE_JOBS_ENABLED=false` by default.
- Job health metrics endpoint (`GET /workforce-jobs/health`).
- Environment validation for workforce job settings.
- Employee Workspace notification stub replaced with scoped persisted reads.

## Routes

- `GET /notifications`
- `POST /notifications/read-all`
- `POST /notifications/:id/read`
- `GET /workforce-jobs/health`

## Config (defaults)

```env
WORKFORCE_JOBS_ENABLED=false
WORKFORCE_JOB_BATCH_SIZE=100
ATTENDANCE_FINALIZER_INTERVAL_MINUTES=15
WORKFORCE_OUTBOX_INTERVAL_SECONDS=60
COMP_OFF_EXPIRY_INTERVAL_MINUTES=60
WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS=300
```

## Verification

```text
npx prisma generate
npx tsc --noEmit -p tsconfig.build.json
npx jest src/modules/outbox src/modules/notification src/modules/workforce-jobs --passWithNoTests
npx jest --config ./test/jest-foundation.json --runInBand --testPathPatterns=environment.spec
```

Result:

- TypeScript build check passed.
- Focused Jest suites passed: outbox/notification/jobs (`3` suites, `7` tests) + environment foundation (`9` tests).

## Acceptance mapping

- Retried jobs do not duplicate notifications: unique `dedupeKey` on outbox and notifications; processor retries reuse the same keys.
- Sensitive fields absent from logs/payloads: outbox sanitize allow-list; logs use event codes/IDs/durations only.
- Workers can be disabled safely: `WORKFORCE_JOBS_ENABLED=false` short-circuits all cron handlers.
