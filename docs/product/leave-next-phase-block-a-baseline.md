# Block A — Phase 0 baseline

| Field | Value |
|-------|--------|
| Recorded | 2026-08-11 |
| Branch | `UI-SA-100826` |
| Commit | `30c5966ecc9b8a58df6525e33c6b22917af8a02a` (`business calendar complete`) |
| Tracking | ahead of `origin/UI-SA-100826` by 6 (local calendar/leave docs) |
| Work order | `leave-next-phase-development-work-order.md` v1.0 |

## Handoff review (current checkout)

Business Calendar + personal calendar work is on this branch. Leave types/policies/apply/ledger already exist from earlier workforce work. **No stash apply or merge is part of this work order.**

## Confirmed Block A gaps (from inspection)

| ID | Finding |
|----|---------|
| A1.1 | `backend/scripts/uat-remaining-runner.mjs` has hardcoded `UatApiRunner!2026` and `InviteAccept!2026A`. Comment still says it mutates `dsp_erp_dev`. No `current_database()` / `current_schema()` guard. |
| A1.2 | `EmployeeShiftService` loads Employee/Shift by id with **no tenant filter**. Create uses `400` for missing rows. List returns all assignments. |
| A1.3 | Leave approve/reject require **all of** `hr.leave.manage`. Overtime uses `hr.overtime.approve` only. Regularization uses `hr.attendance.regularize` only. **`hr.team.approve` is not accepted.** PermissionGuard uses `.every()` (AND). |
| A1.4 | Role create/update/clone/permissions/status and user role-assignment replace write `securityEvent` + session revoke, but **no `auditLog` (AuditService) row**. Create/update/clone are not wrapped with audit in the same transaction. |

## Block B (do not start until A exit gate)

Policy resolver missing Branch+Designation-only tier. No matrix APIs. Leave approve is not sequential Manager-then-HR UX. No employee-selector personal calendar.

## Next

A1 implemented on this baseline (UAT env+DB guard, employee-shift 404 scope, `RequireAnyPermissions` for team approve, role/user assignment audit in the same transaction).
