# Phase 8 — Collaborative Manual Test Sheet (Office Finance Lite)

**Execution ID:** `UAT-E2E-20260903-01`  
**Phase 8 overall:** **Pass** (10 Pass / 1 Partial)  
**Completed:** 4 September 2026 (agent API run)  

**Tenant:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**Maker:** Owner (`owneratlasuate2e.b1627019`)  
**Approver:** HR Approver (`hr.approver.uate2e20260903`) — separate user for maker-checker  

---

## Checklist (11 tasks)

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | FIN-001 | **Pass** | Financial profile INR, reporting start 2026-01-01 |
| 2 | FIN-002 | **Pass** | Customer + Vendor parties; archive + reactivate spare party |
| 3 | FIN-003 | **Pass** | Service Income / Office Expense / Payroll Expense; payroll category linked on profile |
| 4 | FIN-004 | **Pass** | Petty Cash 100000 + Operating Bank 500000; bank ref not returned in full |
| 5 | FIN-005 | **Pass** | Period 2026-09 OPEN (idempotent on re-run) |
| 6 | FIN-006 | **Pass** | Draft Income/Expense/Transfer (`FT-*`); expense linked to active Internal Project |
| 7 | FIN-007 | **Partial** | Upload session issued (`201`) after DB fix; full Clean scan → link needs File Scan worker |
| 8 | FIN-008 | **Pass** | Submit all; self-approve blocked `409`; Approver return + approve I/E/T |
| 9 | FIN-009 | **Pass** | Approved edit blocked; reverse once OK; second reverse `409` |
| 10 | FIN-010 | **Pass** | Lock period → create blocked → reopen with reason |
| 11 | FIN-011 | **Pass** | Income/expense, by-category, by-project, account movements, CSV export |

---

## Fixes applied for this phase

1. **Env:** Added UAT companies to `OFFICE_FINANCE_LITE_COMPANY_IDS` (was only Learn Fresh). Restart required.  
2. **Permissions:** Ensured Owner has full `finance.*`; Approver has approve/reverse/read.  
3. **DB — upload sessions (product bug):**  
   - `file_upload_sessions_public_token_chk` did not allow authenticated sessions keyed by `creatorUserId`.  
   - `file_upload_sessions_purpose_target_chk` never allowed `FINANCE_RECEIPT` / `PROJECT_SUPPORTING` / `HR_REQUEST_ATTACHMENT` / `PAYROLL_PAYSLIP` after those purposes were added.  
   - Migration: `backend/prisma/migrations/20260904123000_file_upload_session_authenticated_creator_chk/`.  
4. **UAT script:** Business party archive requires `reason` (`VersionedReasonCommandDto`).

---

## Where to look in UI

| Area | URL |
|------|-----|
| Setup | http://localhost:3200/office-finance/setup |
| Transactions | http://localhost:3200/office-finance/transactions |
| Reports | http://localhost:3200/office-finance/reports |

**Phase 8 complete enough to continue.** Next was Phase 9 Payroll Lite — see [phase-9 sheet](./phase-9-collaborative-test-sheet.md) and [summary through Phase 9](./collaborative-uat-summary-through-phase-9.md).
