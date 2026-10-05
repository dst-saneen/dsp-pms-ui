# Phase 6 — Collaborative Manual Test Sheet (Asset V2)

**Execution ID:** `UAT-E2E-20260903-01`  
**Phase 6 overall:** **Pass** (9 Pass / 1 Partial)  
**Completed:** 4 September 2026 (agent API run)  

**Tenant:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**Subject:** Arun (`EMP-000032`) · Ishan IT (`EMP-000033`)

---

## Checklist (10 tasks)

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | AST-001 | **Pass** | Categories IT/Access/Software + types Laptop/Card/Location/Licence |
| 2 | AST-002 | **Pass** | IT department grant for Ishan already active (idempotent) |
| 3 | AST-003 | **Pass** | Inventory `AST-000001`…`AST-000004` (+ extras for lifecycle/transfer) |
| 4 | AST-004 | **Pass** | Laptop 1 assigned → Ishan |
| 5 | AST-005 | **Pass** | Concurrent assign: 1 win / 1 conflict `409` |
| 6 | AST-006 | **Pass** | Arun return request on Laptop 2 → custodian complete |
| 7 | AST-007 | **Pass** | Licence seats 2 ok; 3rd blocked; revoke + reallocate |
| 8 | AST-008 | **Pass** | Transfer accept / reject / cancel |
| 9 | AST-009 | **Pass** | Repair cycle + mark lost on hardware; suspend/retire `409` on laptop (pool-oriented) |
| 10 | AST-010 | **Partial** | Clearance **preflight** OK; full waiver needs employee separation flow |

---

## Fixes applied for this phase

1. Added UAT companies to `ASSET_V2_SCOPE_ALLOWLIST_JSON`.  
2. Fixed Asset V2 scope resolver so selected Company/Branch wins over group-level mixed check (`asset-feature-gate.ts`).

---

## Where to look in UI

| Area | URL |
|------|-----|
| Categories | http://localhost:3200/asset-management/asset-categories |
| Types | http://localhost:3200/asset-management/asset-types |
| Assets | http://localhost:3200/asset-management/assets |
| Licences | http://localhost:3200/asset-management/licenses |
| Inbox | http://localhost:3200/asset-management/inbox |
| Transfers | http://localhost:3200/asset-management/transfers |
| Grants | http://localhost:3200/asset-management/department-grants |

**Phase 6 complete enough to continue.** Next was Phase 7 Project Lite — see [phase-7 sheet](./phase-7-collaborative-test-sheet.md) and [summary through Phase 7](./collaborative-uat-summary-through-phase-7.md).
