# Collaborative UAT Summary — through Phase 8

**Execution ID:** `UAT-E2E-20260903-01`  
**Updated:** 4 September 2026  
**Tenant:** `E2E Atlas Group UAT-E2E-20260903-01`  
**Company / Branch:** Atlas Services · Kochi HQ  
**Guide:** [`erp-complete-website-workflow-and-manual-e2e-test-guide.md`](../erp-complete-website-workflow-and-manual-e2e-test-guide.md)

---

## Overall progress

| Phase | Focus | Result | Sheet |
|-------|--------|--------|-------|
| **1** | Foundation | **Pass** | [phase-1](./phase-1-collaborative-test-sheet.md) |
| **2** | Recruitment → hire Arun | **Pass** | [phase-2](./phase-2-collaborative-test-sheet.md) |
| **3** | Onboarding → Active | **Pass** | [phase-3](./phase-3-collaborative-test-sheet.md) |
| **4** | Employee Documents | **Pass** | [phase-4](./phase-4-collaborative-test-sheet.md) |
| **5** | Day-to-day HR | **Pass** | [phase-5](./phase-5-collaborative-test-sheet.md) |
| **6** | Asset V2 | **Pass** (AST-010 Partial) | [phase-6](./phase-6-collaborative-test-sheet.md) |
| **7** | Project Lite | **Pass** (PRJ-010 Partial) | [phase-7](./phase-7-collaborative-test-sheet.md) |
| **8** | Office Finance Lite | **Pass** (FIN-007 Partial) | [phase-8](./phase-8-collaborative-test-sheet.md) |
| **9** | Payroll Lite | **Pass** | [phase-9](./phase-9-collaborative-test-sheet.md) |
| 10 | Delivery / isolation / sign-off | Not run | — |

**Completed:** 9 of 10 phases  
**Remaining:** **1 phase** (10)

> Prefer the rolling summary: [collaborative-uat-summary-through-phase-9.md](./collaborative-uat-summary-through-phase-9.md).

---

## Phase 8 highlights (simple)

1. Company finance profile (INR)  
2. Customer + vendor business parties  
3. Income / expense / payroll categories  
4. Cash + bank payment accounts with opening balances  
5. Open monthly period (Sep 2026)  
6. Draft income, expense (with project link), and transfer  
7. Receipt upload session works after DB fix; Clean scan pipeline still Partial  
8. Maker submits; different Approver returns/approves (self-approve blocked)  
9. Approved expense cannot be edited; one audited reversal only  
10. Locked period blocks new postings; reopen with reason  
11. Reports + CSV use approved movements  

**Golden outcome:** Atlas UAT can run Office Finance Lite setup → posting → maker-checker → reverse → period lock → reports.

---

## Remaining

| Phase | Focus |
|-------|--------|
| **10** | Delivery, isolation, sign-off |

Say **start Phase 10** when ready.
