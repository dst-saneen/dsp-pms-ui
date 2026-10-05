# Phase 0 baseline summary

**Date:** 2026-08-03

**Branch:** `UI-SA-310726` (remediation branch deferred — will create before push)

**HEAD:** `fdee75f922c27444f7c2a86f163ca6fc3ec6e919` (matches plan starting commit)

**Migrations applied during Phase 0:** none

## Worktree

- Dirty: deleted `frontend/developer-3-*.md` (3 files)
- Untracked: `erp-release-readiness-remediation-plan.md`
- Baseline artifacts: `phase-0-baseline/` (local evidence only)

## Commands run

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` (backend + frontend) | Pass |
| `prisma generate` | Pass |
| `prisma validate` | Pass |
| `prisma migrate status` | **1 pending** — `20260731190000_security_tenant_roles_and_account_recovery` |
| Backend `build` | Pass |
| Backend `lint:check` | **Fail** — 1163 errors (964 auto-fixable prettier-heavy) |
| Backend `test:foundation` | Pass — 18 suites / 101 tests |
| Backend `test:workforce` | Pass — 9 suites / 58 tests |
| Backend full `test --runInBand` | **Fail** — 107 failed / 15 passed suites (171 tests: 107 failed / 64 passed) |
| Frontend `lint` | **Fail** — 43 errors, 20 warnings |
| Frontend `tsc --noEmit` | **Fail** — Users page `queryFn: LookupService.getManagers` |
| Frontend `build` | **Fail** — same TypeScript blocker |

## Confirmed vs manager plan

| Plan claim | Our baseline |
| --- | --- |
| Unapplied security migration | Confirmed |
| Frontend TS/build fail | Confirmed (Users employee lookup) |
| Frontend lint 43 / 20 | Confirmed (63 problems) |
| Backend lint high | Confirmed (1163; plan said 813 — environment/rules may differ) |
| Foundation/workforce can pass | Confirmed green today |

## Next (when you say start)

Phase 1 — Backend tenant security and API correctness (still **do not** apply migrations until Phase 4).
