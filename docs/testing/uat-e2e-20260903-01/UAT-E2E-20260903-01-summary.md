# Collaborative UAT Summary — All Phases (Manager pack)

**Execution ID:** `UAT-E2E-20260903-01`  
**Updated:** 4 September 2026  
**Guide used:** `docs/testing/erp-complete-website-workflow-and-manual-e2e-test-guide.md`  
**Testing window:** Started 3 September 2026 · Finished 4 September 2026  

**Tenant:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**Primary employee path:** Arun Manager (`EMP-000032`) hired via Recruitment → Onboarded → ACTIVE  

**Verdict:** **Pass — 10 of 10 phases complete** (with documented accepted Partials)

**Detailed checklist (submit with this file):** `UAT-E2E-20260903-01-checklist.md`

---

## What we tested (simple story)

1. Register / login / org setup  
2. Hire Arun through Recruitment (opening → offer → convert → invite)  
3. Complete Onboarding (template → tasks → laptop → Active)  
4. Employee documents (upload / verify / map from recruitment)  
5. Day-to-day HR (calendar, attendance, leave, OT, comp-off)  
6. Assets (inventory, assign, licence seats, transfers)  
7. Project Lite (project, task, timesheet, archive)  
8. Office Finance Lite (accounts, transactions, maker-checker, reverse)  
9. Payroll Lite (salary → calculate → approve → mark paid → payslip)  
10. Workspace, isolation vs another tenant, reconciliation, sign-off  

**Golden outcome:** One controlled Atlas UAT company can run hire → work → finance → payroll end-to-end; tenant data stays isolated.

---

## Phase results

| Phase | Focus | Result |
|------:|-------|--------|
| **1** | Foundation | **Pass** |
| **2** | Recruitment → hire Arun | **Pass** |
| **3** | Onboarding → Active | **Pass** |
| **4** | Employee Documents | **Pass** |
| **5** | Day-to-day HR | **Pass** |
| **6** | Asset V2 | **Pass** (AST-010 Partial) |
| **7** | Project Lite | **Pass** (PRJ-010 Partial) |
| **8** | Office Finance Lite | **Pass** (FIN-007 Partial) |
| **9** | Payroll Lite | **Pass** |
| **10** | Delivery / isolation / sign-off | **Pass** (DEL/OPS Partial) |

---

## Highlights by phase

### Phase 1 — Foundation
Org registered, OTP verified, master data (companies/branches/depts/shifts) created. Fixed password≠email rule and branch timezone trigger bug.

### Phase 2 — Recruitment
Full hire path produced Arun `EMP-000032` from opening `Software Engineer UAT-E2E-20260903-01`.

### Phase 3 — Onboarding
SE UAT template published; Arun onboarding completed; laptop fulfilled; employment **ACTIVE**. Several onboarding UX/API bugs fixed during the run.

### Phase 4 — Documents
Passport uploaded/verified; Degree reject/reset path OK; recruitment docs mapped to employee.

### Phase 5 — Workforce
Calendar, attendance, leave, overtime, and comp-off half-day leave approved with maker ≠ approver.

### Phase 6 — Assets
Inventory, assignment concurrency, returns, licence capacity, and transfers Pass. Clearance waiver left Partial (needs separation lifecycle).

### Phase 7 — Projects
`PRJ-000002` activated, task/timesheet approved, then completed/archived. Client project / resources left Partial (Finance dependency / deferred).

### Phase 8 — Finance
INR profile, parties, accounts, Sep 2026 period, maker-checker approvals, reverse, lock/reopen, reports. Receipt Clean-scan left Partial (scan worker).

### Phase 9 — Payroll
`PR-000002` Sep 2026 **PAID** (net `111500.00`); payslips AVAILABLE; Arun can download; other user blocked. Salary-line, mark-paid idempotency, and CLEAN file evidence bugs fixed.

### Phase 10 — Close-out
My Workspace, notifications (deep links fixed), file ops, retention, tenant isolation vs Learn Fresh, concurrency replays, DB reconciliation. Delivery Queue Partial because `DELIVERY_V2_ENABLED=false` for this UAT.

---

## Accepted Partials (not Fail)

| ID | Meaning |
|----|---------|
| AST-010 | Full clearance waiver needs separation flow |
| PRJ-010 | Client project / resources deferred |
| FIN-007 | Upload session OK; Clean malware scan worker incomplete |
| DEL-001 / DEL-002 / DEL-003 / OPS-001 | Delivery V2 pilot off — empty queue / platform ops persona |

---

## Product fixes worth calling out

- Password cannot equal email  
- Branch timezone update trigger  
- Onboarding template/runtime/status sync issues  
- Document upload (S3 checksum / CORS proxy)  
- Asset V2 allowlist + company context scope  
- Projects / Finance / Payroll company allowlists  
- Finance upload-session DB checks  
- Payroll salary lines, mark-paid unique keys, payslip CLEAN evidence  
- Notification deep links  

---

## Build status (checked 4 Sep 2026)

| App | Production build |
|-----|------------------|
| Backend | **Pass** |
| Frontend | **Pass** |

---

## Sign-off recommendation

Collaborative UAT for run `UAT-E2E-20260903-01` is **complete and Pass** for the tested Atlas path.  

Before production go-live, specifically close or formally accept:

1. Delivery V2 pilot (if real email delivery is in scope)  
2. File scan worker for finance receipt Clean path  
3. Remaining Partials (AST-010, PRJ-010) if those features are release-critical  

**Submit to manager:** this summary + `UAT-E2E-20260903-01-checklist.md` (2 files).
