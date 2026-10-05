# Stage 3 — Versions, Working Week and Business Events

**Work order:** `business-calendar-development-work-order.md` §14  
**Date:** 2026-08-07  
**Status:** COMPLETE

> Stage 3 delivers **Draft editing** only. Runtime stays **LEGACY**.  
> Draft / In Review versions do **not** affect Leave, Attendance, or Shift Roster.

---

## 1. What Stage 3 means (simple)

HR/Admin can:

1. Open a Company or Branch calendar → **Versions**.  
2. Create a **Draft** version with effective dates.  
3. Edit the **working week** (company: all 7 DEFINE days; branch: sparse OVERRIDE + reason).  
4. Add / delete **Business Events** (FormSheet) with holiday metadata when type is HOLIDAY.  
5. See validation summary and **Submit for review** / **Return to draft**.  
6. Use seeded global event types / categories / sources (metadata APIs).

Publish, amendments, and runtime preview remain **Stage 4**.

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-3-versions.md` |
| Version service | `backend/src/modules/business-calendar/business-calendar-version.service.ts` |
| Event service | `backend/src/modules/business-calendar/business-calendar-event.service.ts` |
| Metadata service | `backend/src/modules/business-calendar/business-calendar-metadata.service.ts` |
| Checksum helper | `backend/src/modules/business-calendar/business-calendar-checksum.util.ts` |
| UI | Administration → Business Calendar → **Versions** |
| Version workspace | `frontend/features/business-calendar/version-workspace.tsx` |
| Tests | `npx jest src/modules/business-calendar` |

---

## 3. APIs (Stage 3)

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/business-calendars/:id/versions` | read / manage |
| GET/PATCH | `/business-calendar-versions/:versionId` | read / manage |
| PUT | `/business-calendar-versions/:versionId/working-week` | manage |
| POST | `/business-calendar-versions/:versionId/submit-review` | manage |
| POST | `/business-calendar-versions/:versionId/return-draft` | manage |
| GET/POST | `/business-calendar-versions/:versionId/events` | read / manage |
| GET/PATCH/DELETE | `/business-calendar-events/:eventId` | read / manage |
| GET/POST/PATCH | `/business-calendar-metadata/event-types\|categories\|sources` | read / manage |

Not implemented (Stage 4): publish, start-amendment, preview-impact, runtime.

### Rules enforced

- Only **DRAFT** can be edited; **PUBLISHED** requires amendment (Stage 4).  
- Company working week: DEFINE; incomplete weeks blocked at submit-review.  
- Branch working week: OVERRIDE + required reason; missing days inherit later.  
- Deterministic `contentChecksum` (SHA-256) refreshed on week/event/version mutations.  
- Business-day effects only for COMPANY/BRANCH targets; dept/employee/project = informational.  
- `paidHoliday` only for HOLIDAY + non-working effect.  
- Timed events require startsAt/endsAt/IANA timezone.  
- Audit + outbox in the same transaction for version/event mutations.  
- Tenant scope via `EmployeeDomainScopeService`.

---

## 4. Frontend

- Calendar card → **Versions** opens version workspace.  
- Version list + lifecycle badges + validation summary.  
- Seven-day working week editor (inherited vs override labels for branch).  
- Event list + right-side FormSheet create (holiday paid flag when HOLIDAY).  
- Submit for review / return to draft actions.

---

## 5. Tests run

```text
npx jest src/modules/business-calendar --no-coverage
→ 6 suites, 26 tests passed

npx tsc --noEmit -p tsconfig.build.json
→ pass
```

Covered highlights:

- Deterministic checksum  
- Complete / incomplete company working week  
- Sparse branch override + reason  
- Submit-review blocked when incomplete / stale optimistic version  
- Informational target cannot set business-day effect  
- paidHoliday / timed-event / cross-company target rejection  

---

## 6. Exit gate (work order §14)

| Gate | Result |
|------|--------|
| HR/Admin can prepare a valid Draft Version | ✅ week + events + validation |
| Draft can enter review | ✅ submit-review / return-draft |
| No Draft affects live Leave/Attendance/Shift | ✅ runtime mode unchanged; no consumer wiring |

---

## 7. How to try it

1. Restart backend.  
2. Administration → Business Calendar → select company → ensure calendars exist.  
3. Click **Versions** on company (or branch) calendar.  
4. New draft version → save Mon–Fri working week (company: all 7 days) → add a Holiday event → Submit for review.

---

*Next:* say **Start Stage 4** for publish, amendments, and Runtime preview.
