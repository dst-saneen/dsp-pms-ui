# Phase 7 — Collaborative Manual Test Sheet (Project Lite)

**Execution ID:** `UAT-E2E-20260903-01`  
**Phase 7 overall:** **Pass** (9 Pass / 1 Partial)  
**Completed:** 4 September 2026 (agent API run)  

**Tenant:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**PM:** Owner (`EMP-000031`) · **Worker:** Arun (`EMP-000032`)  
**Evidence project:** `PRJ-000002` (Internal; activated → completed → archived)

---

## Checklist (10 tasks)

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | PRJ-001 | **Pass** | Workspace capabilities: Projects Lite on; Internal only; Client/Finance flags off |
| 2 | PRJ-002 | **Pass** | Created Internal project `PRJ-000002` in `DRAFT` |
| 3 | PRJ-003 | **Pass** | Stages Discovery/Delivery; team PM+Engineer; task assign to Arun in Draft |
| 4 | PRJ-004 | **Pass** | Activate → Hold (task start blocked `409`) → Resume |
| 5 | PRJ-005 | **Pass** | Arun Start → Submit review (`WAITING_REVIEW`) |
| 6 | PRJ-006 | **Pass** | PM Return → resubmit → Complete (`COMPLETED`). Restart Start after Return is `409` by design (status already `IN_PROGRESS`) |
| 7 | PRJ-007 | **Pass** | Weekly timesheet create + 8h line + submit |
| 8 | PRJ-008 | **Pass** | Manager return → resubmit → approve |
| 9 | PRJ-009 | **Pass** | Time/finance/summary OK; stages completed; project complete + archive |
| 10 | PRJ-010 | **Partial** | Client create blocked until Office Finance Lite; `/projects/resources` deferred (`400`) |

---

## Fixes applied for this phase

1. **Env:** `PROJECTS_LITE_ENABLED=true` and UAT company IDs on `PROJECTS_LITE_COMPANY_IDS` (restart required).  
2. **Product:** Task **assign / unassign** used “active project only” authority, so Draft setup could create tasks but not assign them (UI still offered Assign). Switched assign/unassign to **configuration authority** so Draft + Active both work — same pattern as create task/stage/team.  
3. **UAT data:** Ensured Owner + Arun roles have `projects.*` permissions used by this flow.

---

## Where to look in UI

| Area | URL |
|------|-----|
| Projects | http://localhost:3200/projects/projects |
| My workspace projects | http://localhost:3200/my-workspace/projects |
| My timesheets | http://localhost:3200/me/timesheets |
| Team timesheets | http://localhost:3200/team/timesheets |
| Resources (deferred) | http://localhost:3200/projects/resources |

**Phase 7 complete enough to continue.** Next was Phase 8 Office Finance Lite — see [phase-8 sheet](./phase-8-collaborative-test-sheet.md) and [summary through Phase 8](./collaborative-uat-summary-through-phase-8.md).
