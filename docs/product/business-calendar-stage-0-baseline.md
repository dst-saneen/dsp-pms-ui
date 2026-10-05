# Stage 0 — Baseline and Compatibility Audit

**Work order:** `business-calendar-development-work-order.md` §11  
**Date:** 2026-08-07  
**Git commit:** `af0a571`  
**Environment audited:** `dsp_erp_dev` / schema `dsp_pms` (dev RDS)  
**Status:** COMPLETE (documentation + data-quality baseline)

> Stage 0 does **not** change product behaviour. No new Business Calendar tables were created.

---

## 1. What Stage 0 means (simple)

Before building the new Business Calendar, we checked:

1. What data already exists (companies, branches, holidays, working weeks).  
2. Which screens/APIs already use that data.  
3. Data quality problems (bad timezones, missing country/state).  
4. Migration health (Prisma status clean).  

**Result:** We know what to reuse, what is broken in demo data, and where Leave / Attendance / Roster get “is this a working day?” today.

---

## 2. Where to check (for you)

| What | Where |
|------|--------|
| This Stage 0 report | `docs/product/business-calendar-stage-0-baseline.md` (this file) |
| Manager build plan | `business-calendar-development-work-order.md` |
| Client rules | `business-calendar-client-proposal 1.md` §20 |
| Holidays UI | App → **HR → Leave → Holidays** (`/hr/leave/holidays`) |
| Working week UI | App → **Administration → Branches** → open branch → working days sheet |
| Workforce calendar UI | **HR → Leave → Calendar** (`/hr/leave/calendar`) |
| Work schedule / roster | **HR → Work Schedule** (`/hr/work-schedule`) |
| My Workspace calendar | **My Workspace** (self calendar) |
| Prisma migrate status | Backend folder: `npx prisma migrate status` |

---

## 3. Data counts (dev DB snapshot)

| Metric | Count |
|--------|------:|
| Active companies | 4 |
| Active branches | 7 |
| Companies with **no** active branch | 0 |
| Active holidays | 1 |
| Company-scoped holidays (`branchId` null) | 0 |
| Branch-scoped holidays | 1 |
| Branch working-day rows | 49 (7 days × 7 branches) |
| Branches missing timezone (null/empty) | 3 |
| Published or locked shift rosters | 1 |
| Distinct holiday types in use | `PUBLIC` only (1 row) |

### Branch quality (all active)

| Company | Branch | Timezone | Country | State | Working days | Reviewed |
|---------|--------|----------|---------|-------|--------------|----------|
| ATLASE-HQ-58248D | BR-000002 Kochi | *(null)* | IN | kerala | 7 | Yes |
| COM-000001 | BR-000001 TVM | Asia/Kolkata | IN | Kerala | 7 | No |
| ATLASE-HQ-58248D | BR-000001 | *(null)* | IN | *(null)* | 7 | No |
| COM-000003 | BR-000001 | *(null)* | *(null)* | *(null)* | 7 | No |
| COM-000003 | BR-000002 | **invalid** `fdgfdg` | GF | fdgfd | 7 | No |
| ATLASE-HQ-58248D | BR-000003 | **invalid** `gghfgh` | IN | kerala | 7 | No |
| COM-000002 | BR-000002 Kowdiar | Asia/Kolkata | IN | Kerala | 7 | Yes |

**Pilot branch for later demos:** `COM-000002` / `BR-000002` Kowdiar (valid timezone + reviewed working week).

### Holiday sample

- Name: **onam**  
- Date: 2026-08-07  
- Type: PUBLIC  
- Scope: branch-level  
- Portion: FULL_DAY  

No duplicate active holidays detected in current set (only one row).

---

## 4. Migration status

| Check | Result |
|-------|--------|
| Prisma schema validate | Pass |
| Applied migrations | Baseline clean after Stage 0 cleanup |
| Issue found | Empty orphan folder `20260807120000_business_calendar_foundation` was listed as pending but had **no** `migration.sql` and **no** matching Prisma models (leftover from an aborted earlier attempt) |
| Action taken | **Deleted** the empty orphan migration folder so `prisma migrate status` is clean before Stage 1 |

**Rule:** Stage 1 must create the real foundation migration from the **manager work order** schema (§6), not the old aborted attempt.

---

## 5. Consumer map (who uses holidays / working days today)

```
BranchWorkingDay + Holiday (legacy tables)
        │
        ├─► Leave day calculation (leave-policy-resolver)
        │      subtract non-working days + holidays from leave request
        │
        ├─► Shift Roster generation
        │      builds WORKING / WEEK_OFF / HOLIDAY day types
        │
        ├─► Workforce Calendar
        │      shows holidays on calendar views (does not read working-week table)
        │
        └─► Attendance (indirect only)
               uses roster snapshot day type; does NOT query Holiday table directly
```

### Holiday consumers (known — none left unknown)

| Area | Path / surface |
|------|----------------|
| CRUD API/UI | `/holidays`, `/hr/leave/holidays` |
| Leave | `leave-policy-resolver.service.ts` |
| Roster | `shift-roster.service.ts` + `shift-roster-generation.service.ts` |
| Workforce calendar | `workforce-calendar.service.ts` |
| Scope helper | `employee-domain-scope.service.ts` → `holidayWhere()` |
| OT / attendance finalizer | Use roster `HOLIDAY` day type (indirect) |

### Working-day consumers (known)

| Area | Path / surface |
|------|----------------|
| CRUD | `GET/PUT /branches/:id/working-days` via Branches admin UI |
| Leave | `leave-policy-resolver` (+ Mon–Fri default if empty) |
| Roster | generation service |

**Exit gate note:** No unknown Holiday or Working Day consumer found in Stage 0 search.

---

## 6. Data-quality report (gaps to fix before/during rollout)

| Gap | Impact | When to fix |
|-----|--------|-------------|
| 3 branches with null timezone | Leave/roster/calendar preview will fail for those branches | Before assigning Business Calendar / Stage 2 readiness |
| 2 branches with invalid IANA (`fdgfdg`, `gghfgh`) | Same | Before Stage 2/4 for those offices |
| Missing country/state on some branches | Blocks India state-wise holiday packs later | Before Stage 7 geographic packs |
| Most branches not “working calendar reviewed” | Roster generation already warns | Ops cleanup; not blocking Stage 1 tables |
| Holiday UI/API does not set `dayPortion` | Always FULL_DAY default | Stage 3+ event editor |
| Leave resolver ignores holiday half-day portion | Full-day exclude only | Stage 6 consumer upgrade |
| Only 1 holiday in dev | Thin test data | Add fixtures in Stage 5/9 |

Location gaps are **quantified** above (exit gate satisfied).

---

## 7. Legacy API / UI field notes

### Holidays API
- `POST/GET/PATCH/DELETE /holidays`
- Permissions: `hr.holidays.read` / `hr.holidays.manage`
- Fields: companyId, branchId?, name, date, type, code?, description?; `dayPortion` exists in DB but create UI does not send it

### Branch working days API
- `GET/PUT /branches/:id/working-days`
- Permissions: `organization.branches.read` / `manage`
- 7 weekdays; `dayPortion` in DB but replace API/UI does not expose it

### Workforce calendar
- `GET /workforce-calendar`, `/team/workforce-calendar`, `/me/workforce-calendar`
- Permission: `hr.calendar.read` / `hr.team.read` / `hr.self.read`

---

## 8. Prisma / design pointer (for Stage 1 review)

Stage 0 does not invent a different schema.  
**Approved logical design to implement in Stage 1:** work order **§6 Exact database design**.

Key ideas you should know:

- Company Calendar + Branch Calendar (inheritance).  
- Versions (Draft → … → Published) + **amendments** for editable publish.  
- Runtime service: `resolveBusinessDay({ companyId, branchId, businessDate })`.  
- Start calendars in `LEGACY` mode (shadow later).  
- Do **not** delete `holidays` / `branch_working_days` in first rollout.

Wireframe list (UI to design/build in later stages — Stage 0 capture only):

1. Calendar list (by company)  
2. Company → Branch inheritance view  
3. Calendar Version workspace  
4. Event editor drawer  
5. Published amendment flow  
6. Business Day Preview  
7. Import review  

*(Detailed screens land in Stages 2–8 per work order.)*

---

## 9. Compatibility commitments (carry into Stage 1+)

- Additive migrations only.  
- No delete of legacy holiday/working-day tables at start.  
- No auto-recalc of locked attendance/leave/payroll.  
- No automatic AWS RDS migrate without review/backup.  
- Existing public holiday/branch APIs stay until cutover.

---

## 10. Stage 0 exit gate checklist

| Gate | Status |
|------|--------|
| No unknown Holiday / Working Day consumer | ✅ Mapped |
| Location gaps quantified | ✅ Timezone/country/state listed |
| Migration baseline clean | ✅ Orphan empty migration removed; status clean |
| DB design for Stage 1 identified | ✅ Work order §6 (engineering review at Stage 1 PR) |

---

## 11. Next step

**Start Stage 1** — Database and permission foundation (additive tables + permissions from work order §12), still **no** change to Leave/Attendance behaviour.

---

*End of Stage 0 baseline.*
