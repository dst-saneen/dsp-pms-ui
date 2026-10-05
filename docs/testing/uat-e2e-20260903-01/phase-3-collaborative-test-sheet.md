# Phase 3 — Collaborative Manual Test Sheet (Onboarding)

**Execution ID:** `UAT-E2E-20260903-01`  
**Tenant:** `E2E Atlas Group UAT-E2E-20260903-01`  
**Company:** `E2E Atlas Services UAT-E2E-20260903-01`  
**Branch:** `E2E Kochi HQ UAT-E2E-20260903-01`  
**Completed:** 4 September 2026  
**Phase 3 overall:** **Pass** (happy path)  
**How we work:** Agent = health/config/API/fixes · User = browser clicks · No mocks · No legacy employee create

**Website:** http://localhost:3200  
**Backend:** http://localhost:4500

---

## Phase 3 result (final)

| Task | Guide ID | What | Result |
|------|----------|------|--------|
| 1 | ONT-001 | Open Software Engineer UAT Onboarding template | **Pass** |
| 2 | ONT-002 | Draft + HR/IT task groups | **Pass** |
| 3 | ONT-003 | Add execution tasks (checklist + laptop asset) | **Pass** |
| 4 | ONT-004 | Validate + publish Version 2 | **Pass** |
| 5 | ONT-005 | Automatic designation/branch resolution | **Pass** |
| 6 | ONB-001 | Preflight + start V2 onboarding for Arun | **Pass** |
| 7 | ONB-002 | HR monitoring (progress / tasks visible) | **Pass** |
| 8 | ONB-003 | Department queue assign IT tasks to Ishan | **Pass** |
| 9 | ONB-004 | Complete checklist tasks (IT / manager / employee) | **Pass** |
| 10 | ONB-005 | Fulfil Assign laptop (E2E Laptop 2) | **Pass** |
| 11 | ONB-006 | Optional skip / reopen / waive | **Not run** (optional edge cases) |
| 12 | ONB-007 | Complete Onboarding | **Pass** (after statusV2 sync fix) |
| 13 | ONB-008 | Confirm Probation → Active | **Pass** (early override) |

**Primary subject:** Arun Manager UAT-E2E-20260903-01 (`EMP-000032`) — now **ACTIVE**  
**Template:** Software Engineer UAT Onboarding (`SE-UAT-E2E`) Version 2 published  
**IT assignee:** Ishan IT UAT-E2E-20260903-01 (`EMP-000033`)

---

## Modules covered in Phase 3

1. Onboarding Templates (designer, draft, publish)  
2. Designation onboarding assignment / automatic resolution  
3. Employee Onboarding (V2 start, monitor, complete)  
4. My Workspace → Onboarding (My Tasks + Department Queue)  
5. Asset fulfilment from onboarding (laptop custody)  
6. Employee career / Probation due → Confirm Active  

---

## Bugs found and fixed in Phase 3

1. Template clone missing tenant snapshot → create draft 500 / trigger fail  
2. Task group / task create 409 from same snapshot omission  
3. Designer UI not refreshing / layout clipping after add group  
4. Add Task form missing owner/work-type; grid mandatory mapping wrong  
5. Empty Asset Types for Atlas — seeded Laptop type + empty-state UX  
6. Employee Onboarding list empty while KPI showed data (V2 `{items}` unwrap + normalize)  
7. Detail crash on `status.replaceAll` for legacy/conversion rows  
8. My Tasks `sortOrder` ASC/DESC vs API `asc`/`desc`  
9. Department Queue tab hidden for owner/admin (permission gate)  
10. Assign drawer no-op (no assignee picker / API wiring)  
11. Assignee open-task 403 (required HR onboarding instead of self-read)  
12. No Complete on laptop (ASSET uses Fulfil Asset; inventory empty)  
13. Complete Onboarding toast success but badge stayed In Progress (`statusV2` not updated)

---

## Optional leftover (not required for Pass)

**ONB-006** — skip Office introduction, reopen, HR waive. Skipped because happy path completed all tasks instead.

---

## Next

See [Collaborative UAT summary through Phase 3](./collaborative-uat-summary-through-phase-3.md) for modules completed so far and remaining phases.
