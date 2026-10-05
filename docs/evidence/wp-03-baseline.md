# WP-03 Evidence — Shift Roster

**Status:** Complete  
**Date:** 2026-08-05  
**Branch:** `feat/workforce-time-management-wp`

---

## 1. Acceptance checklist

| Criterion | Result |
| --- | --- |
| Roster repository/service/controller | Pass — `ShiftRosterModule` |
| 62-day validation | Pass — `shift-roster-period.util` + unit tests |
| Generation resolver (calendar, shifts, lifecycle) | Pass — `ShiftRosterGenerationService` |
| Dry-run reconciliation (no writes) | Pass — `generate` defaults `dryRun=true` |
| Manual overrides preserved on regeneration | Pass — `MANUAL_OVERRIDE` entries action `retain` |
| Publish / override / lock / archive transitions | Pass — service + controller |
| Branch advisory lock + optimistic version | Pass — `pg_advisory_xact_lock`, `expectedVersion` |
| Transactional audits + outbox | Pass — `AuditService` + `ShiftRosterOutboxService` |

---

## 2. API routes

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/shift-rosters` | `hr.schedule.read` |
| POST | `/shift-rosters` | `hr.schedule.manage` |
| POST | `/shift-rosters/generate` | `hr.schedule.manage` |
| GET | `/shift-rosters/:id` | `hr.schedule.read` |
| PATCH | `/shift-rosters/:id` | `hr.schedule.manage` |
| POST | `/shift-rosters/:id/publish` | `hr.schedule.publish` |
| POST | `/shift-rosters/:id/lock` | `hr.schedule.publish` |
| POST | `/shift-rosters/:id/archive` | `hr.schedule.publish` |
| POST | `/shift-rosters/:id/overrides` | `hr.schedule.manage` |

---

## 3. Key files

- `backend/src/modules/shift-roster/shift-roster.service.ts`
- `backend/src/modules/shift-roster/shift-roster-generation.service.ts`
- `backend/src/modules/shift-roster/shift-roster.controller.ts`
- `backend/src/modules/shift-roster/shift-roster-period.util.ts`
- `backend/src/modules/shift-roster/shift-roster-lock.util.ts`

---

## 4. Generation inputs

- Branch working days + `workingCalendarReviewedAt` warning
- Branch timezone (IANA)
- Company/branch holidays (branch overrides company)
- Effective employee shift assignments
- Employee `joiningDate` and separation `lastWorkingDate`
- Existing `MANUAL_OVERRIDE` entries retained on regenerate

---

## 5. How to re-verify

```bash
cd backend
npx jest src/modules/shift-roster
npx tsc --noEmit -p tsconfig.build.json
```

---

## 6. Next

**WP-04** — Roster-aware Attendance (snapshot at check-in, exceptions, finalizer, regularization).
