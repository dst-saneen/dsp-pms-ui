# Phase 4 — Collaborative Manual Test Sheet (Employee Documents)

**Execution ID:** `UAT-E2E-20260903-01`  
**Tenant:** `E2E Atlas Group UAT-E2E-20260903-01`  
**Company:** `E2E Atlas Services UAT-E2E-20260903-01`  
**Branch:** `E2E Kochi HQ UAT-E2E-20260903-01`  
**Completed:** 4 September 2026  
**Phase 4 overall:** **Pass**  
**How we work:** Agent = health/config/API/fixes · User = browser clicks · No mocks

**Website:** http://localhost:3200  
**Backend:** http://localhost:4500  
**Guide:** §17 Employee Documents (DOC-001 → DOC-004)

**Primary subject:** Arun Manager UAT-E2E-20260903-01 (`EMP-000032`) — **ACTIVE**

---

## Phase 4 result (final)

| Task | Guide ID | What | Result |
|------|----------|------|--------|
| 1 | DOC-001 | Open Categories page (sanity) | **Pass** |
| 2 | DOC-001 | Create Identity / Employment / Qualification categories | **Pass** |
| 3 | DOC-001 | Create Passport + Degree Certificate types | **Pass** |
| 4 | DOC-002 | Upload Passport for Arun + clean scan | **Pass** |
| 5 | DOC-002 | Verify + download | **Pass** |
| 6 | DOC-003 | Reject + reset Degree document | **Pass** |
| 7 | DOC-004 | Recruitment → employee document mapping | **Pass** |

---

## DOC-004 evidence (from screenshots)

**Recruitment → Application Documents (Hired):**
1. Signed Offer - Arun Manager UAT-E2E-20260903-01 (`OFFER_PDF`)
2. offer-1.pdf (`OFFER_PDF`)
3. offer.pdf (`CV`)

**Employee Documents (Arun):**
1. Degree Arun UAT-E2E reject-test (Phase 4 reject/reset test)
2. Passport Arun UAT-E2E (Phase 4 upload + verify)
3. Signed Offer - Arun Manager UAT-E2E-20260903-01 (`Signed Offer` — mapped from recruitment)

KPI at close: Total 3 · Verified 2 · Pending 1 · Expired 0

**Verdict:** Signed offer mapped into Employee Documents; Phase 4 HR docs present; no quarantined/other-candidate leak observed.

---

## Modules covered in Phase 4

1. Employee Document Categories  
2. Employee Document Types  
3. Employee Documents (upload, verify, download, reject, reset)  
4. Secure file upload (S3 + scan path)  
5. Recruitment → Employee document mapping (signed offer)

---

## Bugs found and fixed in Phase 4

1. S3 presigned PUT checksum header not signed (`HeadersNotSigned: x-amz-checksum-sha256`)  
2. S3 bucket CORS not enabled for localhost → browser PUT failed → authenticated upload proxy  
3. Verify looked broken (401 + stale dialog, no toast)  
4. Download missing from Edit Document sheet  

---

## Next

See [Collaborative UAT summary through Phase 4](./collaborative-uat-summary-through-phase-4.md).  
**Next collaborative phase:** Phase 5 — Day-to-day HR (calendar / attendance / leave / OT).
