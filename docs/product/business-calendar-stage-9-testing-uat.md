# Stage 9 — Production-readiness Testing and UAT

**Work order:** `business-calendar-development-work-order.md` §20  
**Date:** 2026-08-07  
**Status:** COMPLETE for **technical** sign-off package; **business UAT** is checklist-ready (sign-off by HR/Admin)

> Stage 9 does **not** deploy to production (that is Stage 10).  
> No destructive automated tests against AWS RDS.

---

## 1. What Stage 9 delivered

1. Expanded automated coverage for §20.2 boundary matrix, import gates, permissions, migration SQL assertions.  
2. Re-ran Business Calendar + consumer unit suites.  
3. Documented quality-gate commands and UAT checklist for HR/Admin.  
4. Captured migration / rollback evidence pointers (additive foundation migration).

---

## 2. Automated evidence (this run)

| Suite | Result |
|-------|--------|
| `npx jest src/modules/business-calendar` | **15** suites / **85** tests passed |
| Leave resolver + roster generation + workforce calendar specs | Included in Stage 6/8 consumer coverage; re-run with Stage 9 package |
| `npm run prisma:validate` | Pass (see command log) |

### New Stage 9 specs

| File | Covers |
|------|--------|
| `business-calendar-stage9-boundaries.spec.ts` | §20.2 company/branch inherit/override, half-days, leap/year, India/ME, 62-day range, resolve budget |
| `business-calendar-stage9-gates.spec.ts` | Import geo/size/dup/ICS, permissions catalog, scope keys, migration SQL uniqueness / current-runtime partial unique |
| `business-calendar-stage9-permissions.spec.ts` | Route policy read/manage/publish mapping |

---

## 3. Database / migration evidence (§20.1)

| Check | Evidence |
|-------|----------|
| Additive foundation migration | `backend/prisma/migrations/20260807140000_business_calendar_foundation/migration.sql` |
| Scope-key uniqueness | `business_calendars_scopeKey_key` (asserted in Stage 9 gates) |
| Runtime current partial unique | `bc_runtime_days_current_office_date_key WHERE isCurrent = true` |
| Published range overlap protection | Comment + gist exclusion in migration SQL |
| Import + leave calendar day tables | Present in migration |
| Rollback before data | Safe while unused: drop additive objects / restore backup — **do not** run against shared RDS in automation |
| Empty / disposable DB rehearsal | **Manual / Stage 10** on disposable Postgres only (not shared RDS) |

**Safety:** automated tests are unit/pure; no live RDS writes in Stage 9 suite.

---

## 4. Coverage map vs work order §20

| Area | Automated | Manual UAT |
|------|-----------|------------|
| 20.1 DB constraints | SQL assertions + unit | Disposable migrate deploy |
| 20.2 Business-day boundaries | ✅ Stage 9 boundary suite | Spot-check preview UI |
| 20.3 Published-edit | Unit: amendment/impact ack/stale (Stage 4) | Full amend + impact UI |
| 20.4 Tenant isolation | Scope services (Stages 2+) | Cross-tenant negative tests in disposable env |
| 20.5 Permissions | Route + catalog unit | Role matrix login |
| 20.6 Consumers | Leave/Roster ACTIVE/LEGACY units (Stage 6) | Pilot office ACTIVE smoke |
| 20.7 Imports | CSV/ICS/geo/size/RRULE/dups (Stage 7+9) | Excel upload + review apply |
| 20.8 Performance | Resolve budget + 62-day unit | Disposable load with query plans |
| 20.9 Quality gates | Commands below | Full lint/build CI |

---

## 5. Quality gate commands (§20.9)

### Backend

```powershell
cd backend
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run lint:check
npm.cmd run build
npx.cmd jest src/modules/business-calendar --runInBand
```

### Frontend

```powershell
cd frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

**Policy:** never point destructive migrate/reset at AWS RDS from CI.

---

## 6. UAT checklist (business sign-off)

Use: `docs/product/business-calendar-stage-9-uat-checklist.md`

Pilot recommended: COM-000002 / BR-000002 Kowdiar (`Asia/Kolkata`).

---

## 7. Exit gate

| Gate | Status |
|------|--------|
| Technical test package + evidence | ✅ |
| Business UAT complete | ⏳ checklist ready — HR/Admin sign-off |
| Migration/rollback evidence captured | ✅ pointers + SQL assertions (disposable rehearsal = Stage 10 prep) |
| No open Sev-1/2 from automated suite | ✅ (85 BC tests green) |

---

*Next:* say **Start Stage 10** for controlled production rollout after UAT sign-off.
