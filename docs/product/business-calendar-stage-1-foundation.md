# Stage 1 — Database and Permission Foundation

**Work order:** `business-calendar-development-work-order.md` §12  
**Date:** 2026-08-07  
**Status:** COMPLETE (code + migration ready; **not** applied to shared RDS yet)

> Stage 1 adds tables and helpers only. Leave / Attendance / Holidays UI behaviour is **unchanged**.  
> No Nest CRUD APIs yet (that is Stage 2).

---

## 1. What Stage 1 means (simple)

We built the **empty shelves** for Business Calendar:

1. New database tables + enums (additive migration).  
2. Permissions for HR/Admin calendar work.  
3. Small helper code (scope keys, timezone/country checks).  
4. **Did not** wire Leave/Attendance to the new tables yet.  
5. **Did not** auto-run the migration on AWS RDS (needs reviewed deploy).

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-1-foundation.md` |
| Prisma models | `backend/prisma/schema.prisma` (search `BusinessCalendar`) |
| Migration SQL | `backend/prisma/migrations/20260807140000_business_calendar_foundation/migration.sql` |
| Helpers | `backend/src/modules/business-calendar/` |
| Permissions constants | `WorkforcePermission` in `workforce-time-contracts.ts` + `business-calendar.permissions.ts` |
| Route policy (for future APIs) | `route-policy.ts` → `business-calendars` |
| Unit tests | `npx jest src/modules/business-calendar` |

**App UI:** nothing new to click yet (Stage 2+).

---

## 3. What was added

### Database (migration file)

- Enums: scope, runtime mode, version status, rule mode, day effect, etc.  
- Tables: calendars, versions, working-week rules, event types/categories/sources, events, targets, amendments, runtime days, impacts, import batches/rows, leave request calendar days.  
- Branch field: `countrySubdivisionCode` (for India state-wise later).  
- Optional links on attendance + shift roster entries to runtime day.  
- Seeds: global HOLIDAY/MEETING/… types, categories, sources.  
- Permissions: `calendar.business.*` mapped to Owner / Admin / HR Manager.

### Backend code

- `BusinessCalendarModule` registered (empty of controllers — Stage 2).  
- Scope key helper: `COMPANY:<id>` / `BRANCH:<id>`.  
- Validators: IANA timezone, ISO country, subdivision, office readiness.  
- Error codes + permission constants.  
- Route-policy entry prepared for `/business-calendars`.

### Tests run

- `npx prisma validate` → pass  
- `npx prisma generate` → pass  
- `npx jest src/modules/business-calendar` → **8 tests passed**

---

## 4. Migration status (important)

| Check | Result |
|-------|--------|
| Migration file exists | ✅ `20260807140000_business_calendar_foundation` |
| Applied to shared RDS `dsp_erp_dev` | ❌ **Not applied** (by design — work order forbids automatic RDS deploy) |
| `prisma migrate status` | Shows this migration as **pending** |

**To apply later (reviewed deploy only):**

```bash
cd backend
npx prisma migrate deploy
```

Prefer a **disposable** DB first, then approved env with backup evidence.

---

## 5. Exit gate

| Gate | Status |
|------|--------|
| Prisma validation passes | ✅ |
| Helper unit tests pass | ✅ |
| No operational query reads new tables | ✅ (no Stage 2 services yet) |
| No AWS RDS destructive test | ✅ |
| Empty/upgrade disposable migrate proof | ⏳ Pending reviewed disposable apply (ops) |

---

## 6. What you should understand now

- New calendar system lives in **new tables**, old `holidays` / `branch_working_days` still run the app.  
- Calendars will start in **LEGACY** mode when created in Stage 2.  
- Editing published calendars later = **amendments** (Stage 4), not silent overwrite.  
- Permissions are `calendar.business.read/manage/publish/...` (not `hr.leave.*`).

---

## 7. Next step

**Start Stage 2** — Calendar administration APIs + create Company/Branch calendars (still no Leave cutover).

Before Stage 2 demos on shared DB, apply the Stage 1 migration under a reviewed deploy.

---

*End of Stage 1 foundation report.*
