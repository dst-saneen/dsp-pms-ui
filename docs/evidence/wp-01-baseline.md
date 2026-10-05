# WP-01 Evidence — Prisma migration and policy foundation

**Status:** Complete  
**Date:** 2026-08-05  
**Branch:** `feat/workforce-time-management-wp`  
**Migration:** `20260805120000_workforce_time_management_foundation`  
**Applied at:** `2026-08-05T08:42:04.734Z` (UTC)

---

## 1. Acceptance checklist

| Criterion | Result |
| --- | --- |
| Enums + model relations in Prisma schema | Pass |
| Migration SQL reviewed (checks, partial indexes, ledger trigger, backfill) | Pass |
| Migration applied to disposable/dev DB (`dsp_erp_dev` / `dsp_pms`) | Pass — per operator confirmation that DB is disposable for this cycle |
| Historical Attendance unchanged (no schedule snapshots on existing rows) | Pass — 0 attendance rows; 0 snapshotted |
| Backfill reconciles | Pass — 4/4 companies have active `COMP_OFF` leave type; 3 global workforce workflows; opening snapshots 0 (no active leave balances) |
| Attendance + Overtime policy resolvers | Pass — unit tests 5/5 |
| Verification script | Pass — `docs/evidence/wp-01-migration-verify.json` |

---

## 2. What was delivered

### Schema / migration

- New workforce enums and tables (roster, policies, exceptions, regularization, periods, leave ledger, OT, Comp-off, notifications, outbox).
- Extensions: `DayPortion` on holidays / branch working days; `LeaveType.category`; Attendance schedule snapshot columns; Shift `graceInMinutes` default 15→30 for **new** rows; `ApprovalWorkflow.scopeKey` (unique) replacing global-only `workflowCode` uniqueness.
- SQL additions: period/threshold/balance CHECK constraints; partial unique indexes; immutable leave-ledger trigger; COMP_OFF + workflow + opening-snapshot backfill.

### Application

- `WorkforcePolicyModule` with:
  - `AttendancePolicyResolverService` — Branch → Company → system default (plan §6.8)
  - `OvertimePolicyResolverService` — same precedence
- Frozen defaults from `WorkforcePolicyDefaults` (30m late grace, 90%/50%, OT 30/15, Comp-off 240/480/90d).

### Scripts / evidence

- `backend/scripts/wp01-migration-verify.mjs`
- `docs/evidence/wp-01-migration-verify.json`

---

## 3. Post-migration counts (key)

| Metric | Value |
| --- | ---: |
| Companies | 4 |
| Leave types (total) | 7 |
| Active COMP_OFF leave types | 4 |
| Companies missing active COMP_OFF | 0 |
| Global workforce workflows | 3 |
| Leave balance transactions / opening snapshots | 0 / 0 |
| Attendance rows | 0 |
| Shift rosters / attendance policies / OT policies | 0 / 0 / 0 |

---

## 4. Notes

- Shadow DB create failed on RDS (`migrate dev --create-only`); migration SQL was produced via `prisma migrate diff` then hand-extended — same approach as WP-00 risk note.
- Operator confirmed shared `dsp_erp_dev` is acceptable disposable/dev target for this WP cycle (overrides WP-00 “do not apply” caution).
- WP-02 next: permissions, scope assertions, workflow resolution.

---

## 5. How to re-verify

```bash
cd backend
node scripts/wp01-migration-verify.mjs
npx jest src/modules/workforce-policy
```
