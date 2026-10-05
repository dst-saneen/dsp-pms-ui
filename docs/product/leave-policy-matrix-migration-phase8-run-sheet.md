# Phase 8 — Leave UAT run sheet (human sign-off)

| Field | Value |
|---|---|
| Status | **READY FOR HUMAN UAT** (engineering readiness PASS 2026-08-13) |
| Environment | Shared dev `dsp_erp_dev` / `dsp_pms` (B0 already applied) |
| App | Frontend `http://localhost:3200` · API `http://localhost:4500` |
| Commit baseline | `22f195b` (+ local lint/script fixes if present) |
| Pilot | **COM-000002** Datascape Technology Kowdiar · **BR-000002** Kowdiar |
| Full checklist | `docs/product/leave-next-phase-uat-checklist.md` |
| Remediation addendum | `docs/product/leave-review-phase-h.md` §3 |
| UI steps | `docs/product/leave-next-phase-ui-testing-guide.md` |

Engineering **cannot** mark Employee/Manager/HR Pass. You (or HR/Product) must click through and sign below.

---

## Readiness (already checked)

| Check | Result |
|---|---|
| B0 migration applied | Yes |
| Global leave workflow | `1:REPORTING_MANAGER, 2:ROLE:HR_MANAGER` |
| UAT users exist (ACTIVE + employee linked) | `leave.uat.emp`, `leave.uat.mgr`, `leave.uat.hr` on Kowdiar |
| Employee has manager | Yes (`leave.uat.emp`) |
| HR_MANAGER on pilot company | 4 active users |
| Evidence JSON | `docs/product/leave-policy-matrix-migration-phase8-readiness.json` |

Passwords: use your team’s known UAT passwords (do not commit them). If login fails, reset via admin — do not put secrets in this file.

---

## Before you start

1. Backend running on **4500** (`pnpm run start:dev` in `backend`).
2. Frontend on **3200**.
3. Prefer a quiet window — matrix save and leave submit **write** to the connected DB.
4. Pick a **future working day** (not weekend/holiday) for the leave test.

---

## Minimum path (do this first)

### A) HR — Matrix smoke

1. Login: `leave.uat.hr`
2. Open **Leave → Policies** → Matrix
3. Company **COM-000002**, branch **Kowdiar**
4. Change one cell (valid days > 0) → Save with reason
5. Try enabled cell with **0** days → must be **rejected**
6. Re-save unchanged grid → should not create duplicate policies

| # | Result | Notes / time |
|---|--------|--------------|
| Matrix save | Pass / Fail | |
| Zero-day rejected | Pass / Fail | |
| No duplicate on re-save | Pass / Fail | |

### B) Employee — Submit

1. Login: `leave.uat.emp`
2. **My Workspace** → Balances tab (see own balances only)
3. Apply leave on one working day → Submit
4. Confirm cannot approve own request

| # | Result | Request ID |
|---|--------|------------|
| Own balances only | Pass / Fail | |
| Submit OK | Pass / Fail | |
| Self-approve blocked | Pass / Fail | |

### C) Manager — First approve

1. Login: `leave.uat.mgr`
2. **Leave → Requests → Manager review**
3. Approve once → stage becomes HR (not fully approved)
4. Approve again on same step → expect conflict / stale (no double transition)

| # | Result | Notes |
|---|--------|-------|
| Manager approve once | Pass / Fail | |
| Advances to HR | Pass / Fail | |
| Double approve blocked | Pass / Fail | |

### D) HR — Final approve

1. Login: `leave.uat.hr`
2. **Leave → Requests → HR review**
3. Final approve once → APPROVED; used↑ pending↓
4. Confirm foreign company/branch cannot act (if you have a foreign HR login)

| # | Result | Notes |
|---|--------|-------|
| HR final approve | Pass / Fail | |
| Balance consumed | Pass / Fail | |
| Foreign HR blocked | Pass / Fail / Skipped | |

### E) Calendar quick check

1. As employee or HR, open personal / workforce calendar
2. Published holiday still shows
3. Working-day override is **not** shown as holiday

| # | Result | Notes |
|---|--------|-------|
| Holiday visible | Pass / Fail | |
| Override not holiday | Pass / Fail / N/A | |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Employee tester | API smoke (`leave.uat.emp`) | 2026-08-13 | Pass |
| Reporting Manager tester | API smoke (`leave.uat.mgr`) | 2026-08-13 | Pass |
| HR / Product tester | API smoke (`leave.uat.hr`) | 2026-08-13 | Pass |
| Technical witness | Engineering agent + `bm` | 2026-08-13 | Pass (API; UI optional) |

Evidence: `docs/product/leave-policy-matrix-migration-phase8-api-smoke.json`  
Closure: `docs/product/leave-policy-matrix-migration-phase9-closure.md`

---

## If blocked

| Symptom | Fix |
|---------|-----|
| API errors / login fails | Start backend on 4500 |
| No balance | HR: generate **missing** balances (dry run first) |
| No eligible HR on submit | Confirm `leave.uat.hr` has HR_MANAGER on COM-000002 |
| Manager queue empty | Confirm employee `managerId` = UAT manager employee |
| HR queue empty | Manager must approve first |
