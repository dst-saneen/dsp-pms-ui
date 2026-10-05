# WP-10 Baseline — Integration, UAT and release

Date: 2026-08-05  
Branch: `feat/workforce-time-management-wp`  
Working tree: workforce WPs implemented (commit pending)

## Scope completed in this package

1. Automated quality gates executed and recorded.
2. Tenant-scope unit evidence + disposable-DB concurrency status recorded.
3. Manual UAT checklist published for human execution.
4. Migration checksums + migrate status captured.
5. Release runbook with jobs-disabled default published.
6. Security route matrix published.
7. Residual gate fixes (self-service tests, eslint) applied so gates pass.

## Quality gates

| Gate | Command | Result |
| --- | --- | --- |
| Prisma validate | `npx prisma validate` | Pass |
| Prisma generate | `npx prisma generate` | Pass |
| Backend typecheck/build | `npx tsc --noEmit -p tsconfig.build.json` + `npm run build` | Pass |
| Backend lint | `npx eslint "{src,apps,libs,test}/**/*.ts"` | Pass |
| Backend Jest (all) | `npm test` | Pass — **47** suites, **252** tests |
| Frontend typecheck | `npx tsc --noEmit` | Pass |
| Frontend lint | `npm run lint` | Pass |
| Frontend build | `npm run build` | Pass (includes new HR routes) |
| `git diff --check` | whitespace | Pass (CRLF warnings only on Windows) |

### Frontend routes verified in production build

`/hr/work-schedule`, `/hr/attendance`, `/hr/attendance/exceptions`, `/hr/attendance/periods`, `/hr/overtime`, `/hr/leave/calendar`, `/hr/leave/holidays`, `/hr/leave/comp-off`, `/my-workspace`

## Migration evidence

| Migration | SHA-256 | Lines |
| --- | --- | ---: |
| `20260805120000_workforce_time_management_foundation` | `0F8D25753756CB88B5AF1406A6B1F89ADD8618E06415D366C5832CEC60B6D336` | 932 |
| `20260805140000_workforce_permissions_and_approval_resolution` | `5C02F11D350A210B37146A9A955C7ED090FF50F8D40DCE4C73E0B5B9BAE35007` | 113 |

`prisma migrate status` (read-only): **93 migrations found; database schema is up to date** for configured `dsp_pms`.

Prior empty/production-shaped verification: `docs/evidence/wp-01-migration-verify.json`.

**Backup:** production/pilot backup evidence must be attached by ops before any further `migrate deploy` on a non-disposable target (see release runbook).

## Disposable-DB tenant / concurrency integration

| Item | Status |
| --- | --- |
| Unit tenant filters (`workforce-tenant-scope`, domain-scope foundation) | Pass (in foundation suite) |
| Reporting-team / calendar privacy unit tests | Pass |
| Optimistic concurrency patterns in unit specs (roster publish, leave/OT approve via `updateMany`) | Covered in module unit tests |
| Full disposable multi-tenant + multi-connection concurrency suite | **Not executed here** — requires a confirmed disposable PostgreSQL; shared AWS RDS must not host destructive concurrent fixtures (WP-00 rule) |

Action for release owners: provision disposable Postgres, run work-order § Integration tests, attach results to this folder before production jobs enable.

## Jobs / config

- Default: `WORKFORCE_JOBS_ENABLED=false` (env validation + `.env.example`).
- Scheduler unit test proves jobs short-circuit when disabled.
- Enable only after pilot smoke per `wp-10-release-runbook.md`.

## Manual UAT / sign-off

| Item | Path | Status |
| --- | --- | --- |
| UAT checklist | `docs/evidence/wp-10-uat-checklist.md` | Ready for execution |
| Release runbook | `docs/evidence/wp-10-release-runbook.md` | Ready |
| Security route matrix | `docs/evidence/wp-10-security-route-matrix.md` | Published |
| Technical sign-off | — | Pending pilot smoke |
| Business UAT sign-off | — | Pending checklist completion |

## Closure checklist (work order)

- [x] Work Plan schema/behavior unchanged (roster is separate; work plan still from WorkScheduleItem)
- [x] Shift Roster implemented separately
- [x] Objects under `dsp_pms` (migration evidence)
- [x] Historical attendance not recalculated by policy changes (design + WP-04)
- [x] Leave ledger unit coverage + reconcile path
- [x] Approval workflow scope resolution unit tests
- [x] Tenant isolation unit filters
- [~] Full concurrency integration on disposable DB — deferred (blocked on disposable target)
- [x] Workers idempotent when enabled; disabled by default
- [x] Sensitive content sanitization on outbox/notifications (unit)
- [x] Backend quality gates pass
- [x] Frontend quality gates pass
- [ ] Manual UAT passes — **pending human run**
- [ ] Production deploy + jobs enable — **pending ops following runbook**

## Related evidence

- WP-00 … WP-09 baselines under `docs/evidence/`
- This package closes engineering delivery for WP-10 **except** human UAT, backup attachment, disposable concurrency suite, and production sign-off.
