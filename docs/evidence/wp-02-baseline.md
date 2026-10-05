# WP-02 Evidence — Scope, permissions and approval resolution

**Status:** Complete  
**Date:** 2026-08-05  
**Branch:** `feat/workforce-time-management-wp`  
**Migration:** `20260805140000_workforce_permissions_and_approval_resolution`

---

## 1. Acceptance checklist

| Criterion | Result |
| --- | --- |
| Permission catalog entries + tenant-role mappings | Pass — 15 permissions; Owner/Admin/HR = 15; PM = 3 |
| Org-scoped assertions for new workforce models | Pass — `*Where()` + assert helpers on `EmployeeDomainScopeService` |
| Workflow `scopeKey` generation (server-owned) | Pass — `buildWorkflowScopeKey` + `ApprovalWorkflowService.create/update` |
| Company → global workflow resolution | Pass — `WorkforceApprovalResolverService.resolveWorkflow` |
| Manager → HR → Admin/Owner fallback | Pass — `resolveApproverEmployeeId` |
| No self-approval + current-step ownership | Pass — `assertCurrentStepActor`; wired into leave approve/reject |
| Route matrix | Pass — extended `route-policy.spec.ts` |
| Cross-tenant IDs → 404 | Pass — same notFound pattern via new assert helpers |
| Repeated approval → 409 | Pass — `STALE_TRANSITION` when step not PENDING |

Evidence JSON: `docs/evidence/wp-02-security-verify.json`

---

## 2. Delivered

### Permissions (idempotent SQL)

`hr.schedule.{read,manage,publish}`, `hr.holidays.{read,manage}`, `hr.attendance.{regularize,lock}`, `hr.overtime.{read,manage,approve}`, `hr.comp-off.{read,manage}`, `hr.calendar.read`, `hr.team.{read,approve}`

Role grants: Org Owner / Company Admin / HR Manager → all; Project Manager → team + calendar only; Employee → unchanged self permissions; custom roles → none automatic.

### Route policy

New administrative path mappings including action overrides for publish / approve / lock. Holidays moved from leave permissions to `hr.holidays.*`.

### Scope

Filters/asserts for shift roster, attendance exception/regularization/period/policy, overtime, comp-off, leave ledger, notifications.

### Approval resolution

- Module: `WorkforceApprovalModule`
- Leave submit uses company→global workflow + resolver for step approvers
- Leave approve/reject enforce current-step ownership (409 on repeat)
- Global workforce workflows now have default `REPORTING_MANAGER` step 1

---

## 3. How to re-verify

```bash
cd backend
node scripts/wp02-security-verify.mjs
npx jest --testPathPatterns="route-policy|workforce-approval|employee-domain-scope|leave-request.service.spec"
```

---

## 4. Next

**WP-03** — Shift Roster APIs (generation, publish, lock, overrides).
