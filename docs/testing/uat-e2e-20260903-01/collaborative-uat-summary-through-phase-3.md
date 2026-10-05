# Collaborative UAT Summary — through Phase 3

> **Superseded:** Phase 4 is complete. Current rolling summary:  
> [collaborative-uat-summary-through-phase-4.md](./collaborative-uat-summary-through-phase-4.md)

**Execution ID:** `UAT-E2E-20260903-01`  
**Updated:** 4 September 2026 (snapshot through Phase 3 only)  
**Tenant:** `E2E Atlas Group UAT-E2E-20260903-01`  
**Company / Branch:** Atlas Services · Kochi HQ  
**Guide:** [`erp-complete-website-workflow-and-manual-e2e-test-guide.md`](../erp-complete-website-workflow-and-manual-e2e-test-guide.md)

**Status key:** `Pass` · `Partial` · `Not run` · `Blocked`

---

## Overall progress

| Phase | Focus | Result | Sheet |
|-------|--------|--------|-------|
| **1** | Foundation — auth, register, org setup | **Pass** | [phase-1](./phase-1-collaborative-test-sheet.md) |
| **2** | People — recruitment → hire Arun | **Pass** | [phase-2](./phase-2-collaborative-test-sheet.md) |
| **3** | Onboarding template → run → Active | **Pass** | [phase-3](./phase-3-collaborative-test-sheet.md) |
| **4** | Employee Documents | **Pass** — see [through Phase 4](./collaborative-uat-summary-through-phase-4.md) | [phase-4](./phase-4-collaborative-test-sheet.md) |
| 5 | Day-to-day HR (calendar / attendance / leave / OT) | Not run | — |
| 6 | Asset V2 full suite | Not run | — |
| 7 | Project Lite | Not run | — |
| 8 | Office Finance Lite | Not run | — |
| 9 | Payroll Lite | Not run | — |
| 10 | Delivery, platform ops, isolation, sign-off | Not run | — |

**Completed:** 3 of 10 planned collaborative phases  
**Remaining:** **7 phases**

After each later phase finishes, update this table and add a short module bullet under “Modules completed”.

---

## Modules completed up to Phase 3 (point list)

### Phase 1 — Platform & setup
1. Authentication (login / logout)  
2. Organization registration + OTP  
3. Organization onboarding wizard  
4. Company Groups / Companies / Branches  
5. Departments / Designations / Shifts  
6. Branch timezone  
7. Password policy (password ≠ email)  
8. Forgot / change password  

### Phase 2 — People & hiring
9. Employees list (Owner employee)  
10. Users / Roles (owner administration usage)  
11. Recruitment — Job Opening  
12. Recruitment — Application / Interview / Offer  
13. Public offer accept (as needed in run)  
14. Recruitment conversion → Employee created  
15. Employee invitation / career start events  

### Phase 3 — Onboarding & lifecycle
16. Onboarding Templates (author / publish)  
17. Designation onboarding resolution  
18. Employee Onboarding V2 (start / monitor / complete)  
19. My Workspace Onboarding (My Tasks + Department Queue)  
20. Onboarding asset fulfilment (laptop custody)  
21. Probation → Confirm Active  

**Golden outcome:** Arun (`EMP-000032`) is **ACTIVE** with completed V2 onboarding and career events.

---

## Modules not done yet (remaining phases)

| Phase | Modules (guide §§) |
|-------|---------------------|
| **4** | Employee Documents — categories, types, upload, verify, download (§17) |
| **5** | Business Calendar (deeper), Work Schedule, Attendance, Leave, Holidays, Overtime, Comp-off (§11, §18–20) |
| **6** | Asset V2 full — categories/types/inventory, grants, transfers, clearance beyond onboarding laptop (§21) |
| **7** | Project Lite — project, stages, tasks, timesheets (§22) |
| **8** | Office Finance Lite — transactions, approvals, reverse (§23) |
| **9** | Payroll Lite — period, calculate, approve, payslips (§24) |
| **10** | Dashboard / My Workspace extras, Delivery monitoring, file/retention ops, tenant isolation, concurrency, golden-thread, sign-off (§25–33) |

---

## Phase checklists (links)

- [Phase 1 checklist](./phase-1-collaborative-test-sheet.md) — **Pass**  
- [Phase 2 checklist](./phase-2-collaborative-test-sheet.md) — **Pass**  
- [Phase 3 checklist](./phase-3-collaborative-test-sheet.md) — **Pass**  

---

## How this file will grow

When Phase 4 (or later) is finished:

1. Add/update that phase’s collaborative sheet under this folder.  
2. Mark the phase row **Pass / Partial / Fail** in the table above.  
3. Append the finished modules under “Modules completed”.  
4. Reduce “Remaining” count.

---

## Explicitly out of this UAT scope

CRM · Procurement · Full accounting · BIM · Training · Full separation/clearance · Resource forecasting · Generic workflow admin
