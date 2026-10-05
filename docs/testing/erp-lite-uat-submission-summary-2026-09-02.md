# ERP Lite UAT — Submission Summary

**Date completed:** 2 September 2026  
**Commit tested:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Company / Branch:** Learn Fresh Company 01 / Learn Fresh HQ 01  
**Evidence folder:** [`uat-evidence-2026-09-02-5916d45/`](./uat-evidence-2026-09-02-5916d45/)  
**Detailed checklist:** [`erp-lite-uat-simple-phase-checklist.md`](./erp-lite-uat-simple-phase-checklist.md)  
**Full runbook:** [`2026-09-02-erp-lite-manual-uat-execution-record.md`](../archive/testing/2026-09-02-erp-lite-manual-uat-execution-record.md)

---

## One-line result

**All 7 UAT phases were executed.** Core business flows mostly work. **Production sign-off is NO-GO** until file scanning, payslip download, payroll mark-paid bug fix, and a few blocked browser checks are resolved.

---

## Scorecard (simple)

| Phase | Name | Result | In plain English |
|------:|------|--------|------------------|
| 0 | Setup | **Partial Pass** | App runs; not all infra/personas ready at start; Finance/Payroll keys added locally during run |
| 1 | Baseline | **Pass** | Login and menus work for Learn Fresh HR |
| 2 | Module gates | **Pass** | Turning Lite modules OFF/ON hides and restores access correctly |
| 3 | Projects | **Partial Pass** | Create, tasks, timesheets work via API; **file upload not tested** (no virus scanner) |
| 4 | Office Finance | **Pass** | Expense draft, approval, reversal, and access rules work |
| 5 | Payroll | **Partial Pass** | Calculate + approve work; **mark-paid fails** with 3 employees; payslips not tested |
| 6 | Navigation | **Partial Pass** | Menu rules and highlighting verified in tests/API; some browser personas missing |
| 7 | Concurrency | **Partial Pass** | 7 of 9 race tests pass; payroll races blocked or failed due to above bug |

---

## What passed (good news)

- Projects Lite lifecycle: create → activate → tasks → submit → complete → timesheets
- Office Finance: maker-checker, self-approve blocked, reversal, unauthorized users blocked
- Payroll: dependency gates, create run, calculate, independent approver approve
- Module capability gates: fail-closed when modules OFF
- Onboarding scope: HR routes vs employee workspace routes behave correctly (API)
- Menu highlighting and permission rules (automated tests)
- Concurrency: stale edits get controlled 409 conflicts; operationId replay works safely
- **No P0 security issues found** (no data leakage, duplicate payments, or public file URLs in tested paths)

---

## What did not pass (needs attention)

### Fail (real bugs)

| Issue | Where | Impact |
|-------|-------|--------|
| Payroll mark-paid fails with multiple employees | Phase 5 + 7 — run `PR-000005` | Cannot complete pay → finance expense flow for normal payroll runs |

### Blocked (missing setup, not code failure)

| Item | Phases affected |
|------|-----------------|
| ClamAV / file virus scanning not configured | Project file upload, payslip PDF |
| Full 15 UAT personas (delivery-only, leave-only, multi-company user) | Navigation browser checks |
| Manual browser + accessibility sign-off (mobile, keyboard, 200% zoom) | Navigation Phase 6 |
| Approved Finance/Payroll v1 keys from secret store (local dev keys used instead) | Production readiness note |
| Fresh payroll month for dual-approver concurrency test | Phase 7 CONC-06 |

---

## Key test records created

| Record | ID / number | Status |
|--------|-------------|--------|
| UAT Project (Phase 3) | `PRJ-000015`, `PRJ-000016` | Completed lifecycle |
| Finance expense (Phase 4) | `FT-000009` | Approved + reversed |
| Payroll run (Phase 5) | `PR-000005` | **APPROVED** — mark-paid not done |

---

## How testing was done

Most functional checks used **live API scripts** against `localhost:4500` with real UAT logins. Navigation and gates used **automated unit tests** where browser personas were unavailable. This matches the runbook intent but is **not a full manual browser-only sign-off**.

Evidence files per phase are in the evidence folder (markdown + JSON logs).

---

## Recommendation

| Decision | Status |
|----------|--------|
| **Continue development / fix bugs** | Yes — fix payroll mark-paid (P1) |
| **Business UAT sign-off** | **Not yet** — blocked items above |
| **Production enablement** | **NO-GO** per runbook section 15 |

### Before re-submitting for sign-off

1. Fix payroll mark-paid multi-employee bug and retest Phase 5 + 7
2. Configure ClamAV and retest PROJECT-04 + PAYROLL-04
3. Provide missing UAT personas and complete browser navigation checks
4. Replace local dev v1 keys with approved secret-store keys for final run

---

## Documents to submit together

1. **This summary** — `erp-lite-uat-submission-summary-2026-09-02.md`
2. **Phase checklist** — `erp-lite-uat-simple-phase-checklist.md`
3. **Evidence folder** — `uat-evidence-2026-09-02-5916d45/` (all phase evidence files)

---

## Sign-off (for lead to fill)

| Role | Name | Date | Approve / Reject / Pending |
|------|------|------|----------------------------|
| Tester | | 2 Sep 2026 | |
| Project business owner | | | Pending |
| Finance business owner | | | Pending |
| Payroll/HR business owner | | | Pending |
| Technical release owner | | | Pending |
| **Final decision** | | | **NO-GO** (pending items above) |
