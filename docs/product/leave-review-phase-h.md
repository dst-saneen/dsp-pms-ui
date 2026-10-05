# Phase H — Release gates (remediation closure)

Recorded: 2026-08-12  
Scope: proof pack after remediation phases **A–G**.  
**Not** a live-database cutover. Do **not** run B0 apply against shared `dsp_erp_dev` / AWS RDS unless ops explicitly records backup + target name.

---

## 0. Remediation code status (A–G)

| Phase | Fix | Status |
|-------|-----|--------|
| A | Eligible manager (login + `hr.team.approve`) | ✅ |
| B | Scoped HR pool only | ✅ |
| C | Working-day override ≠ holiday | ✅ |
| D | LEGACY branch keeps company holidays | ✅ |
| E | Submit calculation inside transaction | ✅ |
| F | Matrix enabled cells > 0 + unchanged count | ✅ |
| G | Approver notifications (manager → HR) | ✅ |

---

## 1. Automated gates (run locally / CI)

From `backend/`:

```powershell
pnpm run lint:check
pnpm exec jest --config ./test/jest-all.json --runInBand
pnpm run test
pnpm run test:e2e
node scripts/leave-b0-disposable-validate.mjs preflight
```

| Gate | Expected |
|------|----------|
| `lint:check` | 0 errors |
| `test` (all) | Green |
| `test` | Green (includes leave + calendar + approval specs) |
| `test:e2e` | Green — uses `test/jest-e2e.json` (`*.e2e-spec.ts` only) |
| B0 preflight | Migration file present; idempotent SQL checks pass |

**Fixed in Phase H:** `backend/test/jest-e2e.json` now exists (previously `test:e2e` failed).

**Still open:** Playwright / browser CI — none in this repo. Use manual UAT checklist below.

---

## 2. B0 migration — disposable apply (ops only)

Migration: `backend/prisma/migrations/20260811120000_leave_policy_matrix_and_manager_hr_approval/migration.sql`

Review notes: `docs/product/leave-next-phase-block-b0-dry-run.md`  
Rollout pack: `docs/product/leave-next-phase-phase-r.md`

### Preflight (no DB connection)

```powershell
cd backend
node scripts/leave-b0-disposable-validate.mjs preflight
```

Prints duplicate-policy SQL that must return **zero rows** on a snapshot target before production apply.

### Disposable apply (isolated schema)

Requires an explicit URL — script does **not** read `.env`.

```powershell
cd backend
$env:B0_VALIDATE_DATABASE_URL = "postgresql://USER:PASS@HOST:5432/DISPOSABLE_DB_NAME"
# optional: $env:DATABASE_SSL_CA = "certs/global-bundle.pem"
node scripts/leave-b0-disposable-validate.mjs apply
```

What it does:

1. Refuses `dsp_erp_dev` unless `B0_ALLOW_SHARED_DEV=1` (ops override only)
2. Creates schema `leave_b0_disposable_*`
3. Runs `prisma migrate deploy` **twice** (from-zero + idempotent re-run)
4. Verifies B0 indexes + `GLOBAL:LEAVE_APPROVAL` step 2
5. Drops the schema (unless `KEEP_DISPOSABLE_SCHEMA=1`)

**Not done in this workspace session:** apply to named UAT/pilot target — requires ops backup ID + signed target DB.

---

## 3. Remediation UAT addendum

Run after B0 on the pilot environment. Base checklist: `leave-next-phase-uat-checklist.md`.

| # | Remediation check | Pass | Notes |
|---|-------------------|------|-------|
| R-A | Manager without login/`hr.team.approve` is never current approver | | |
| R-B | Random user with only `hr.leave.manage` cannot HR-approve; scoped HR can | | |
| R-C | Working-day override does not show as holiday in workforce/personal calendar | | |
| R-D | LEGACY branch employee sees company-wide legacy holidays in mixed company | | |
| R-E | Concurrent submit uses consistent day count vs balance reserve | | stress optional |
| R-F | Matrix: enabled + 0 days/month blocked; unchanged count on no-op save | | |
| R-G | Submit notifies manager; manager approve notifies HR; final approve notifies employee | | |

Suggested pilot: COM-000002 / Kowdiar (same as Phase R), test trio `leave.uat.emp@example.test`, `leave.uat.mgr@example.test`, `leave.uat.hr@example.test`.

---

## 4. Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Technical (automated gates) | | | Pending / Pass |
| Technical (B0 disposable apply) | | | Pending / Pass |
| HR / Product (UAT) | | | Pending / Pass |

Production-like leave release requires **B0 on target + remediation UAT + Phase R smoke (§6)**.
