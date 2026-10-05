# WP-08 Baseline

Date: 2026-08-05

## Scope

Implemented privacy-aware workforce calendar assembly, reporting-team scope for Project Managers, self-service roster/calendar/exception/regularization endpoints, and non-breaking Employee Workspace / My Workspace enrichments.

Delivered:

- `WorkforceCalendarModule` with privacy-safe day states (`AVAILABLE` … `UNSCHEDULED`).
- `ReportingTeamScopeService`: `SELF` / `TEAM` (direct reports via `managerId`) / `TENANT|GLOBAL` (HR calendar permissions).
- HR calendar `GET /workforce-calendar` (`hr.calendar.read`) and team calendar `GET /team/workforce-calendar` (`hr.team.read`).
- Self-service (session employee only):
  - `GET /me/shift-roster`
  - `GET /me/workforce-calendar`
  - `GET /me/attendance/exceptions`
  - `GET /me/attendance/regularizations`
  - `POST /me/attendance/regularizations`
  - Existing OT / Comp-off `/me` routes retained from WP-06.
- Employee Workspace response adds optional `todayShift` and `todayWorkPlan` without removing existing fields.
- Self-service `/me/workspace` includes `todayShift` from published/locked roster for branch-local today.

## Privacy rules

- Employee cannot query another employee via `/me/*` (employeeId from session only).
- Team mode sees operational availability; leave type name hidden for TEAM views.
- Overtime status included only for self.
- Leave reasons are never returned on calendar payloads.
- Calendar range capped at 62 days (`ROSTER_PERIOD_TOO_LONG`).

## Verification

```text
npx prisma generate
npx tsc --noEmit -p tsconfig.build.json
npx jest src/modules/workforce-calendar --passWithNoTests
```

Result:

- TypeScript build check passed.
- Focused Jest suites passed: workforce-calendar (`3` suites, `8` tests) — privacy states, reporting-team scope, date-range limits.

## Acceptance mapping

- Employee cannot access another employee: self-service resolves employee from auth context; calendar self route forces `employeeId = actor.employeeId`.
- Project Manager sees only authorized reporting employees: `hr.team.read` → direct reports + self; out-of-scope employee filter throws `ForbiddenException`.
- HR sees only active tenant scope: `hr.calendar.read` uses `EmployeeDomainScopeService.employeeWhere()` / `assertEmployeeInScope`.
