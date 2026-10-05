# Phase 10 — Collaborative Manual Test Sheet (Delivery / Isolation / Sign-off)

**Execution ID:** `UAT-E2E-20260903-01`  
**Phase 10 overall:** **Pass** (17 Pass / 4 Partial / 0 Fail)  
**Completed:** 4 September 2026 (agent API run)  

**Tenant A:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**Tenant B (isolation):** Learn Fresh Org 01 · Learn Fresh Company 01 (stand-in for Beacon)  
**Actors:** Owner (`owneratlasuate2e.b1627019`) · HR Approver · Arun · Learn Fresh owner (`mohammedsaneenv.cb8b0e28`)

---

## Checklist (21 tasks)

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | WRK-001 | **Pass** | Arun My Workspace / leave / assets / docs / payslips |
| 2 | WRK-002 | **Pass** | Owner dashboard scope; no Tenant B leak in employee list |
| 3 | WRK-003 | **Pass** | Kochi ↔ Bengaluru branch switch; Labs context denied |
| 4 | WRK-004 | **Pass** | Notifications list + mark-read; deep `href` after product fix |
| 5 | DEL-001 | **Partial** | Delivery health/list OK; queue empty (`DELIVERY_V2_ENABLED=false`) |
| 6 | DEL-002 | **Partial** | No retryable Atlas DeliveryMessage (V2 off during UAT) |
| 7 | DEL-003 | **Partial** | Platform dead-letters/suppressions require `platform.delivery.*` (owner 403; employee 403) |
| 8 | DEL-004 | **Pass** | Recipient-exceptions endpoint reachable |
| 9 | OPS-001 | **Partial** | Queue API healthy; no live V2 messages to operate |
| 10 | OPS-003 | **Pass** | File ops stats/list; employee denied |
| 11 | OPS-004 | **Pass** | Retention policies readable by owner; employee denied; no purge |
| 12 | ISO-001 | **Pass** | Atlas lists do not leak Learn Fresh / reverse |
| 13 | ISO-002 | **Pass** | Cross-tenant employee/payslip detail → safe 404 |
| 14 | ISO-003 | **Pass** | Tenant B cannot switch into Atlas context; foreign finance create rejected |
| 15 | ISO-004 | **Pass** | Employee payroll approve forbidden |
| 16 | CON-009 | **Pass** | Leave approve replay → 409 |
| 17 | CON-012 | **Pass** | Payroll approve replay 409; duplicate Sep run blocked |
| 18 | UX-003 | **Pass** | Permission-denied + empty filter shapes |
| 19 | DB-001 | **Pass** | `PR-000002` PAID; 2 AVAILABLE payslips; clean files present |
| 20 | GOLD-001 | **Pass** | Arun ACTIVE + paid payroll + finance + projects chain |
| 21 | SIGNOFF-001 | **Pass** | No Fail/Blocked; Partials accepted for Delivery V2 pilot off |

---

## Fixes applied for this phase

1. **Notification deep links (product):** API notifications / workspace cards now include authorized `href` from `eventCode` + entity (`notification-href.ts`). My Workspace notification titles link when `href` is present.  
2. **Env note (not a code bug):** `DELIVERY_V2_ENABLED=false` for the whole UAT run → Delivery Queue stays empty; platform dead-letter/suppression ops stay behind `platform.delivery.*`. Marked Partial, not Fail.

---

## Where to look in UI

| Area | URL |
|------|-----|
| My Workspace | http://localhost:3200/my-workspace |
| Recruitment Delivery | http://localhost:3200/hr/recruitment/delivery |
| Ops Delivery | http://localhost:3200/admin/operations/delivery |
| File operations | http://localhost:3200/administration/operations/files |
| Document retention | http://localhost:3200/settings/security/document-retention |

---

## Collaborative UAT complete

Phases **1–10** finished for `UAT-E2E-20260903-01`.  
See [summary through Phase 10](./collaborative-uat-summary-through-phase-10.md).
