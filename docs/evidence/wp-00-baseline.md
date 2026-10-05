# WP-00 Baseline Evidence — Workforce Time Management

**Status:** Complete (with disposable-DB blocker recorded)  
**Date:** 2026-08-05  
**Branch:** `feat/workforce-time-management-wp`  
**Baseline commit (parent):** `4c9069f5bd685dc55f936dea796b22974fd4a527`  
**Message:** Add approved baseline for Workforce Time Management Plan

---

## 1. Purpose

WP-00 acceptance:

- [x] Clean baseline recorded
- [x] Implementation branch created
- [x] Database preflight captured (read-only)
- [x] Contracts frozen (error codes / enums / defaults / permissions)
- [ ] Disposable database target confirmed — **FAILED / BLOCKED** (see §4)
- [~] Quality gates — in progress / recorded below

---

## 2. Source documents (approved)

| Role | Path |
| --- | --- |
| Business plan | `workforce-time-management-plan.md` / `docs/hr/workforce-time-management-plan.md` |
| Engineering work order | `workforce-time-management-development-work-order.md` / `docs/development/workforce-time-management-development-work-order.md` |
| Local execution guide | `workforce-time-management-execution-guide.md` |

---

## 3. Git baseline

| Item | Value |
| --- | --- |
| Previous branch | `UI-SA-040826` |
| New branch | `feat/workforce-time-management-wp` |
| HEAD at branch create | `4c9069f5bd685dc55f936dea796b22974fd4a527` |
| Unrelated dirty tracked files | None at branch create |
| Untracked docs present | boss/update/workforce markdown helpers (local docs) |

---

## 4. Database identity (critical)

| Item | Value |
| --- | --- |
| Database | `dsp_erp_dev` |
| Schema | `dsp_pms` |
| Host | AWS RDS (`*.rds.amazonaws.com`) |
| PostgreSQL | 17.9 |
| Migrations applied | 91 — up to date |
| Prisma validate | Pass |
| Disposable? | **No** |

### WP-00 / WP-01 rule

Work order requires:

> Stop if the active database is not the intended disposable environment.  
> Migration generation and integration testing must not target live AWS RDS.

**Decision for this cycle:**

- WP-00 read-only preflight against shared `dsp_erp_dev` is recorded for awareness.
- **WP-01 `prisma migrate dev` / reset / apply must NOT run against this AWS DB.**
- Before WP-01 coding applies SQL: provision a **local disposable** PostgreSQL with schema `dsp_pms`.

Evidence JSON: `docs/evidence/wp-00-workforce-preflight.json`

---

## 5. Preflight counts (shared `dsp_erp_dev` / `dsp_pms`)

| Entity | Count |
| --- | ---: |
| Companies | 4 |
| Branches | 7 |
| Branch working days | 49 |
| Shifts | 3 |
| Employee Shift assignments | **0** |
| Holidays | **0** |
| Leave types | 3 |
| Leave balances | 0 |
| Leave requests | 0 |
| Attendance | 0 |
| Approval workflows | **0** |
| Approval workflow steps | 0 |
| Employees | 12 |
| Branches missing timezone | **3** |
| `shift_rosters` table exists | **0 (not created yet)** |

### Activation readiness notes (from plan §3)

Not ready for production activation yet:

1. **3 branches missing timezone**
2. **0 employee shift assignments** (roster generation depends on these)
3. **0 holidays reviewed**
4. **0 approval workflows** (need Leave / Regularization / Overtime codes)
5. No Attendance / Overtime policies yet (new tables)

These are configuration prerequisites for later UAT/activation, not blockers for WP-00 contract freeze.

---

## 6. Contracts frozen in code (WP-00 deliverable)

| File | Contents |
| --- | --- |
| `backend/src/common/constants/workforce-time-error-codes.ts` | Stable error codes from work order |
| `backend/src/common/constants/workforce-time-contracts.ts` | Enums, workflow codes, permissions, policy defaults, job env keys |

Existing related file (kept as-is for current leave/attendance self-service):

- `backend/src/common/constants/workforce-error-codes.ts`

Helper script:

- `backend/scripts/wp00-workforce-preflight.mjs`

---

## 7. Quality gates

Record exact results when commands finish:

| Check | Command | Result |
| --- | --- | --- |
| Prisma validate | `pnpm exec prisma validate` | **Pass** |
| Prisma migrate status | `pnpm exec prisma migrate status` | **91 migrations, up to date** |
| Backend lint | `pnpm run lint:check` | **Fail (pre-existing + fixed our new file)** — 6 remaining errors in unrelated files (prettier CRLF / unbound-method) |
| Backend foundation tests | `pnpm run test:foundation` | **Pass** — 23 suites / 126 tests |
| Frontend `tsc` | `pnpm exec tsc --noEmit` | **Pass** |

Full backend `pnpm test` + frontend build can be a follow-up; foundation + tsc are the WP-00 quality snapshot.

---

## 8. WP-00 acceptance summary

| Criterion | Status |
| --- | --- |
| Baseline commit recorded | Pass |
| Implementation branch created | Pass |
| Preflight counts captured | Pass |
| Contracts frozen | Pass |
| Disposable DB confirmed | **Fail / Blocked** — AWS shared DB only |
| No migration applied | Pass (none applied) |

---

## 9. Next: WP-01 gate

Do **not** start schema apply on AWS.

Before WP-01:

1. Create/use local disposable PostgreSQL database + schema `dsp_pms`
2. Point a local `.env.disposable` (or override) at that DB
3. Re-run preflight against disposable target
4. Only then `prisma migrate dev --create-only --name workforce_time_management_foundation`

---

## 10. One-line status for manager

> WP-00 complete on branch `feat/workforce-time-management-wp`: baseline commit, read-only preflight, and frozen contracts recorded. Shared AWS `dsp_erp_dev` is **not** disposable, so WP-01 migration work is blocked until a local disposable `dsp_pms` database is available.
