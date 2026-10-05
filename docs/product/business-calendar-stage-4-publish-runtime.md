# Stage 4 — Publication, Amendments and Runtime

**Work order:** `business-calendar-development-work-order.md` §15  
**Date:** 2026-08-07  
**Status:** COMPLETE

> Stage 4 adds **publish**, **edit-via-amendment**, and **deterministic Runtime preview / materialization**.  
> Leave / Attendance / Shift consumers are **not** switched yet (Stage 6). Calendar `runtimeMode` can stay LEGACY until Stage 5 shadow.

---

## 1. What Stage 4 means (simple)

After Stages 2–3, HR/Admin can now:

1. **Preview** a business day (resolution trace).  
2. **Publish** a ready Draft / In Review version (advisory lock + optimistic concurrency).  
3. Materialize **revisioned** runtime days (history kept; never overwrite).  
4. **Edit published** calendars only by starting an **amendment** draft (reason + effective date).  
5. **Preview impact** before publishing an amendment (mandatory acknowledge).

You can verify Stages **0–4** together now.

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-4-publish-runtime.md` |
| Runtime resolver (pure) | `business-calendar-runtime.util.ts` |
| Runtime service | `business-calendar-runtime.service.ts` |
| Publish / amendment | `business-calendar-publish.service.ts` |
| UI | Administration → Business Calendar → Versions |
| Tests | `npx jest src/modules/business-calendar` |

---

## 3. APIs added

| Method | Path | Permission |
|--------|------|------------|
| POST | `/business-calendar-versions/:id/publish` | `calendar.business.publish` |
| POST | `/business-calendar-versions/:id/start-amendment` | `calendar.business.amend` |
| POST | `/business-calendar-versions/:id/preview-impact` | `calendar.business.publish` |
| GET | `/business-calendar/runtime/day` | `calendar.business.runtime.preview` |
| GET | `/business-calendar/runtime/range` | `calendar.business.runtime.preview` |
| POST | `/business-calendar/runtime/preview` | `calendar.business.runtime.preview` |
| POST | `/business-calendar/runtime/rebuild` | `calendar.business.publish` |

### Publish rules

- Ready validation (company week complete / branch overrides valid).  
- PostgreSQL `pg_advisory_xact_lock` per calendar.  
- Stale `optimisticVersion` → `409`.  
- Non-overlapping published effective ranges.  
- Amendment publish requires `impactPreviewAcknowledged=true`.  
- Prior published version superseded; runtime rows get new revision (`isCurrent` flipped, old kept).  
- Audit + outbox in same transaction.

### Resolution order (§7.2)

Company Working Week → Company event → Branch Working Week → Branch event.

---

## 4. Frontend

- **Publish** on Draft / In Review.  
- Amendment publish opens **impact preview** sheet (counts + acknowledge).  
- **Edit published (amend)** FormSheet (effective date + reason).  
- **Business day preview** panel with full resolution trace.

---

## 5. Tests

```text
npx jest src/modules/business-calendar --no-coverage
→ 8 suites, 34 tests passed

npx tsc --noEmit -p tsconfig.build.json
→ pass
```

Includes: resolution precedence, amendment/publish guards, stale optimistic version.

---

## 6. Exit gate

| Gate | Result |
|------|--------|
| Published edits via amendments | ✅ start-amendment clone |
| Publish never overwrites history | ✅ runtime revisions + superseded versions |
| Runtime deterministic + revisioned | ✅ util + materialize |
| Impact preview mandatory for amendment | ✅ `impactPreviewAcknowledged` |

---

## 7. Suggested end-to-end check (Stages 2–4)

1. Restart backend.  
2. Administration → Business Calendar → select company.  
3. Ensure company + Kowdiar branch calendars.  
4. Company → Versions → draft → save 7-day week → add Holiday → Submit → **Publish**.  
5. Preview a date; confirm trace.  
6. **Edit published (amend)** → change event → Submit → Publish (ack impact).  
7. Confirm old runtime revision still exists (`isCurrent=false`).

Leave/Attendance behaviour should still be unchanged.

---

*Next (when ready):* **Start Stage 5** — legacy backfill + shadow comparison.
