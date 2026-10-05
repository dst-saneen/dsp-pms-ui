# Phase 9 — Collaborative Manual Test Sheet (Payroll Lite)

**Execution ID:** `UAT-E2E-20260903-01`  
**Phase 9 overall:** **Pass** (11/11)  
**Completed:** 4 September 2026 (agent API run)  

**Tenant:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**Maker:** Owner (`owneratlasuate2e.b1627019`)  
**Approver:** HR Approver (`hr.approver.uate2e20260903`)  
**Employee payslip:** Arun (`arun.saanlo` / `EMP-000032`)  
**Evidence run:** `PR-000002` · Sep 2026 · **PAID** · net `111500.00`

---

## Checklist (11 tasks)

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | PAY-001 | **Pass** | Runs / components / dashboard reachable; Tax Profile UI still API-oriented |
| 2 | PAY-002 | **Pass** | Basic / Housing / Standard Deduction components created |
| 3 | PAY-003 | **Pass** | Salary revisions for Owner + Arun (after nested-line create fix) |
| 4 | PAY-004 | **Pass** | Preflight blockers empty; attendance period `PAYROLL_PENDING` |
| 5 | PAY-005 | **Pass** | Draft `PR-000002` + manual earning adjustment |
| 6 | PAY-006 | **Pass** | Calculate → `CALCULATED`; employee rows listed |
| 7 | PAY-007 | **Pass** | Return to draft → recalculate |
| 8 | PAY-008 | **Pass** | Self-approve `409`; Approver approve once; replay `409` |
| 9 | PAY-009 | **Pass** | Mark paid → Finance payroll expense linked; status `PAID` |
| 10 | PAY-010 | **Pass** | Payslip `AVAILABLE`; Arun download-grant OK; other user blocked |
| 11 | PAY-011 | **Pass** | Duplicate month run blocked; CSV register safe |

---

## Fixes applied for this phase

1. **Env:** UAT companies on `PAYROLL_LITE_COMPANY_IDS` (subset of Finance allowlist); `WORKFORCE_JOBS_ENABLED=true`.  
2. **Salary revision create (product):** Nested `EmployeeSalaryLine` create with `companyId` failed Prisma compound-FK validation → empty/zero payroll. Fixed to create parent then `createMany` lines (`payroll-employee-inputs.service.ts`, also legacy `employee-salary.service.ts`).  
3. **Mark paid (product):** Multiple payslip `PENDING` action events reused one `operationId`, violating `PayrollActionEvent` unique `(companyId, operationId, entityType, action)`. Fixed to `${operationId}:${payslipId}`.  
4. **Payslip PDF (product):** Generated CLEAN `FileObject` rows omitted `clamAvResult`/`scannedAt`, failing `file_objects_clean_evidence_chk`. Fixed in `generated-file.service.ts`.

---

## Where to look in UI

| Area | URL |
|------|-----|
| Payroll | http://localhost:3200/hr/payroll |
| My Workspace / payslips | http://localhost:3200/my-workspace |

**Phase 9 complete.** Next was Phase 10 — see [phase-10 sheet](./phase-10-collaborative-test-sheet.md) and [summary through Phase 10](./collaborative-uat-summary-through-phase-10.md).
