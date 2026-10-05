# Stage 6 — Workforce Consumer Integration

**Work order:** `business-calendar-development-work-order.md` §17  
**Date:** 2026-08-07  
**Status:** COMPLETE (code ready; office ACTIVE cutover is HR-reviewed, verify after Stages 0–10)

> Stage 6 wires Leave / Shift Roster / Attendance / Workforce Calendar to Business Calendar  
> **Runtime** when office `runtimeMode === ACTIVE`. `LEGACY` and `SHADOW` keep legacy Holiday +  
> BranchWorkingDay paths. No silent rewrite of published rosters, locked attendance, or leave history.

---

## 1. What Stage 6 means (simple)

1. **Office gate** — branch calendar mode wins when a branch calendar exists; else company.  
2. **Leave (ACTIVE)** — day charges from Runtime; writes `LeaveRequestCalendarDay` snapshots.  
3. **Shift Roster (ACTIVE)** — generation uses Runtime day map; stores `businessCalendarRuntimeDayId`.  
4. **Attendance** — prefers published/locked roster snapshot (incl. runtime day id); unscheduled ACTIVE path attaches Runtime id.  
5. **Workforce Calendar (ACTIVE)** — holiday projection from Runtime instead of legacy Holiday rows.  
6. **Cutover** — `POST /business-calendar/runtime/mode` enforces `LEGACY → SHADOW → ACTIVE`.

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-6-consumers.md` |
| Consumer adapter | `backend/src/modules/business-calendar/business-calendar-consumer.service.ts` |
| Leave resolver | `leave-policy-resolver.service.ts` (`calculateWorkingDaysFromRuntime`) |
| Leave snapshots | `leave-request.service.ts` → `syncLeaveCalendarDays` |
| Roster generation | `shift-roster-generation.service.ts` + `shift-roster.service.ts` |
| Attendance snapshot | `attendance.service.ts` → `snapshotFromRoster` / `attachRuntimeDayIfActive` |
| Workforce Calendar | `workforce-calendar.service.ts` → `loadHolidayProjections` |
| Mode API | `POST /business-calendar/runtime/mode` |
| Tests | `npx jest` on BC + leave resolver + roster generation + workforce calendar |

---

## 3. Cutover rule (pilot office)

```text
LEGACY → SHADOW → ACTIVE
```

```http
POST /business-calendar/runtime/mode
{
  "companyId": "<uuid>",
  "branchId": "<Kowdiar-branch-uuid>",
  "mode": "ACTIVE"
}
```

- Rejects direct `LEGACY → ACTIVE` (must shadow first via Stage 5).  
- Rollback to `LEGACY` only before new transactions depend on Runtime ids.  
- Activate **one office at a time** (pilot: COM-000002 / BR-000002 Kowdiar).

---

## 4. Consumer behaviour matrix

| Consumer | LEGACY / SHADOW | ACTIVE |
|----------|-----------------|--------|
| Leave charge | Holiday + BranchWorkingDay | Runtime via consumer; calendar day snapshots |
| Draft roster generate | Holiday + working week | Runtime day map + runtime day FK |
| Published/Locked roster | Unchanged | Unchanged (no auto-regen on amend) |
| Attendance check-in | Roster snapshot | Same + copy runtime day id; unscheduled resolves Runtime |
| Workforce holidays | `holiday.findMany` | Runtime `HOLIDAY` kind projection |

---

## 5. Explicitly out of scope / deferred

| Item | Note |
|------|------|
| Amendment → impact queue UI | Model exists (`BusinessCalendarImpact`); HR impact workflow polish = Stage 8+ |
| Payroll / Projects calc | Read-only interfaces only (work order §17.6) — not implemented |
| Overtime / Comp-off recalc | Continue via roster/attendance snapshots; no history rewrite |
| Full admin UI for mode switch | API ready; Stage 8 finishes screens |
| End-to-end UAT on pilot | Deferred per product owner — verify after all stages |

---

## 6. Tests run

```bash
cd backend
npx jest src/modules/business-calendar \
  src/modules/leave-policy/leave-policy-resolver.service.spec.ts \
  src/modules/shift-roster/shift-roster-generation.service.spec.ts \
  src/modules/workforce-calendar/workforce-calendar.service.spec.ts
```

**Result (2026-08-07):** 13 suites / 58 tests passed (includes new consumer + ACTIVE leave/roster cases).

---

## 7. Exit gate

| Gate | Status |
|------|--------|
| Leave uses Runtime when ACTIVE; legacy otherwise | ✅ |
| LeaveRequestCalendarDay written on create/update when snapshots exist | ✅ |
| Draft roster uses Runtime + stores runtime day id | ✅ |
| Manual roster overrides retained | ✅ (existing + covered) |
| Attendance copies runtime day from roster / unscheduled ACTIVE | ✅ |
| Workforce Calendar ACTIVE holiday projection | ✅ |
| Office mode API with LEGACY→SHADOW→ACTIVE guard | ✅ |
| No silent history rewrite of published/locked data | ✅ (by design) |
| Full product UAT | ⏳ after Stages 7–10 (per owner) |

---

*Next:* say **Start Stage 7** for imports / geographic packs when ready.
