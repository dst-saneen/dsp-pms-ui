# Stage 5 — Legacy Backfill and Shadow Comparison

**Work order:** `business-calendar-development-work-order.md` §16  
**Date:** 2026-08-07  
**Status:** COMPLETE (tooling ready; office activation is HR-reviewed)

> Stage 5 maps legacy Holidays / Branch Working Days into Business Calendar **drafts**,  
> and provides shadow parity compare. **No consumer cutover** (that is Stage 6).  
> Backfill never publishes and never deletes legacy rows.

---

## 1. What Stage 5 means (simple)

1. **Backfill (dry-run by default)** creates LEGACY Company/Branch calendars + migration **draft** versions.  
2. Holidays become events with `legacyHolidayId` preserved.  
3. Branch working days become Branch **OVERRIDE** rules (company week is **not** inferred).  
4. Company calendars are flagged as needing HR working-week setup.  
5. **Shadow compare** diffs legacy vs new for ~12 months back + 18 months ahead.  
6. Optional `--activate-shadow` only when unexplained mismatches are zero.

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-5-backfill-shadow.md` |
| Backfill runner | `backend/src/modules/business-calendar/business-calendar-backfill.runner.ts` |
| Shadow runner | `backend/src/modules/business-calendar/business-calendar-shadow.runner.ts` |
| Migration mappers | `business-calendar-migration.util.ts` |
| CLI backfill | `pnpm run migration:calendar:backfill -- …` |
| CLI shadow | `pnpm run migration:calendar:shadow -- …` |
| HTTP | `POST /business-calendar/migration/backfill` · `POST /business-calendar/migration/shadow-compare` |
| Tests | `npx jest src/modules/business-calendar` |

---

## 3. Safety rules (work order)

- Dry-run unless `--apply` / `apply: true`  
- Requires expected Company / Branch / Working Day / Holiday counts  
- Verifies DB name + schema; refuses prod-like names without `--allow-production`  
- Idempotent (`scopeKey`, `legacyHolidayId`, existing backfill drafts)  
- Audit evidence on apply / shadow activate  
- Never deletes legacy Holidays / BranchWorkingDays  
- Never guesses missing timezone / subdivision (skips + flags)

---

## 4. CLI usage (pilot: Kowdiar)

Replace IDs with your actor user + COM-000002 / BR-000002 Kowdiar UUIDs.  
Expected counts must match the **scoped** company filter when `--company-id` is set.

### Dry-run backfill

```bash
cd backend
pnpm run migration:calendar:backfill -- \
  --expect-companies=1 \
  --expect-branches=1 \
  --expect-working-days=7 \
  --expect-holidays=1 \
  --company-id=<COM-000002-uuid> \
  --actor-user-id=<your-user-uuid>
```

Report written to `docs/product/business-calendar-stage-5-backfill-report-dry-run.json`.

### Apply backfill

Same command + `--apply`.

### Shadow parity (drafts allowed)

```bash
pnpm run migration:calendar:shadow -- \
  --company-id=<COM-000002-uuid> \
  --branch-id=<Kowdiar-branch-uuid> \
  --actor-user-id=<your-user-uuid> \
  --allow-draft-versions
```

Report: `docs/product/business-calendar-stage-5-shadow-parity.json`.

### Activate SHADOW (only if unexplained = 0)

```bash
…same… --activate-shadow
```

Before shadow activation for cutover offices, HR should:

1. Configure Company Working Week on the company draft (Stage 3 UI).  
2. Submit / publish reviewed versions (Stage 4).  
3. Re-run shadow until `unexplainedCount === 0`.  
4. Sign off location/timezone.

---

## 5. Difference categories

| Category | Meaning |
|----------|---------|
| `MISSING_TIMEZONE` | Branch TZ invalid / missing |
| `MISSING_COMPANY_WORKING_WEEK` | Company week incomplete |
| `HALF_DAY_HANDLING` | Portion mismatch on holidays |
| `INVALID_LEGACY_DATE` | Missing BranchWorkingDay |
| `LEGITIMATE_BRANCH_OVERRIDE` | Branch week intentionally differs |
| `STATUS_MISMATCH` / `UNEXPLAINED` | Must be cleared before SHADOW activate |

---

## 6. Tests

```text
npx jest src/modules/business-calendar --no-coverage
→ 9 suites, 39 tests passed
```

Includes holiday portion mapping, legacy day resolve, category mapping, shadow range window.

---

## 7. Exit gate

| Gate | Result |
|------|--------|
| Intended cutover office can reach zero unexplained diffs | Tooling ready; HR must configure company week + review |
| HR signs off calendar/location | Manual (pilot: Kowdiar) |
| No consumer switched automatically | ✅ Leave/Attendance/Roster still legacy |

---

## 8. Suggested verification order (with Stages 2–4)

1. Restart backend.  
2. Dry-run Stage 5 backfill for Kowdiar company.  
3. Apply backfill.  
4. UI: open calendars → Versions → set company working week → publish when ready.  
5. Shadow compare with `--allow-draft-versions` (or after publish without it).  
6. Confirm Leave/Attendance still use old Holiday tables.

---

*Next:* say **Start Stage 6** when you want Leave / Roster / Attendance to consume Runtime under `ACTIVE` (with office rollback).
