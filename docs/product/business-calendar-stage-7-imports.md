# Stage 7 — Imports and Geographic Support

**Work order:** `business-calendar-development-work-order.md` §18  
**Date:** 2026-08-07  
**Status:** COMPLETE (API + parsers + India/ME fixtures; full Imports UI polish is Stage 8)

> Stage 7 delivers reviewed holiday ingestion: CSV / Excel / ICS upload, government  
> fixture packs (India state-wise + Middle East), and apply-to-**Draft** only.  
> Imports never touch Runtime without human review + Version publish.

---

## 1. What Stage 7 means (simple)

1. Download a CSV template with the required columns.  
2. Upload CSV / Excel / ICS into an import **batch** on a **Draft** version.  
3. Validate → review (select rows) → apply to draft (creates/updates events).  
4. Or pull India / UAE fixture packs via the government provider adapter.  
5. Rejected / failed batches stay resumable; provider failure creates `FAILED` batch.

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-7-imports.md` |
| Import service | `business-calendar-import.service.ts` |
| Parsers | `business-calendar-import.parsers.ts` |
| Controller | `POST/GET /business-calendar-imports…` |
| Geographic model | `geographic/jurisdictions.ts` |
| Gov provider interface | `providers/government-holiday-provider.ts` |
| India / UAE fixtures | `providers/holiday-fixtures.ts` |
| Frontend API client | `frontend/features/business-calendar/service.ts` |

---

## 3. API surface (work order §8.5)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/business-calendar-imports/template.csv` | Template download |
| GET | `/business-calendar-imports/jurisdictions` | India + ME list |
| POST | `/business-calendar-imports` | Multipart file upload |
| POST | `/business-calendar-imports/government` | Fixture pack fetch |
| GET | `/business-calendar-imports` | List batches |
| GET | `/business-calendar-imports/:batchId` | Batch + rows |
| POST | `…/:batchId/validate` | Duplicate / changed detection |
| POST | `…/:batchId/review` | Select rows + approve |
| POST | `…/:batchId/apply-to-draft` | Write Draft events only |
| POST | `…/:batchId/reject` | Reject batch |

Permissions: `calendar.business.import` / `review` / `read`.

---

## 4. Template columns (§18.1)

`eventName`, `eventCode`, `startDate`, `endDate`, `countryCode`, `subdivisionCode`, `eventType`, `category`, `dayPortion`, `paidHoliday`, `businessDayEffect`, `externalReference`

Validation: MIME / extension / 5 MB size + SHA-256 checksum.

---

## 5. ICS rules (§18.2)

- All-day `VALUE=DATE` kept as calendar dates (no UTC day shift).  
- Timed events store UTC ISO + timezone evidence.  
- `RRULE` rejected with a clear message.  
- UID stored as `externalReference` (`ics:…`).

---

## 6. Government provider (§18.3–18.4)

- Interface `GovernmentHolidayProvider` is replaceable.  
- Default: `FixtureGovernmentHolidayProvider` (no live credentials / no response logging).  
- India 2026: national + Kerala (`IN-KL`) state fixtures.  
- Middle East: UAE 2026 national (+ Dubai half-day sample).  
- Year `1900` simulates provider failure → `FAILED` resumable batch.

Geographic codes: ISO 3166-1 alpha-2 + ISO 3166-2 (India states/UTs, UAE emirates, other ME countries).

---

## 7. Safety

| Rule | Status |
|------|--------|
| Apply only to Draft / editable version | ✅ |
| No Runtime / publish from import | ✅ |
| Selected rows only | ✅ |
| Idempotent externalReference / payload hash | ✅ |
| Provider failure leaves FAILED batch | ✅ |

---

## 8. Tests run

```bash
cd backend
npx jest src/modules/business-calendar
```

Includes geographic jurisdictions + India/ME fixture + CSV/ICS parser cases.  
**Result:** business-calendar suites passing (2026-08-07).

---

## 9. Exit gate

| Gate | Status |
|------|--------|
| Imports cannot affect Runtime without review + publish | ✅ |
| India state-wise fixture tests pass | ✅ (`IN-KL`) |
| Representative Middle East fixture passes | ✅ (`AE`) |
| Provider failure leaves resumable batch | ✅ (`FAILED` + year 1900) |
| Full Imports admin UI | ⏳ Stage 8 |

---

*Next:* say **Start Stage 8** for complete frontend rollout (including `/administration/business-calendar/imports`).
