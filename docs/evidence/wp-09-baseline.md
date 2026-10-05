# WP-09 Baseline

Date: 2026-08-05

## Scope

Implemented workforce time management frontend screens against protected backend APIs, with permission-controlled navigation, FormSheet workflows, and My Workspace enrichments.

Delivered:

- Shared `MonthCalendar` component (`frontend/components/workforce/`) with keyboard-focusable day grid and privacy-state tones.
- Navigation updates in `frontend/config/navigation.ts` for Work Schedule, Attendance children, Overtime, Leave Calendar / Holidays / Comp-off.
- API endpoint map extended in `frontend/config/api.ts` for roster, exceptions, periods, OT, Comp-off, holidays, workforce calendar, and `/me/*` self-service.

### Feature folders

| Feature | Route(s) |
| --- | --- |
| `features/shift-roster` | `/hr/work-schedule` |
| `features/attendance` (expanded daily) | `/hr/attendance` |
| `features/attendance-exception` | `/hr/attendance/exceptions` |
| `features/attendance-period` | `/hr/attendance/periods` |
| `features/overtime` | `/hr/overtime` |
| `features/comp-off` | `/hr/leave/comp-off` |
| `features/holiday` | `/hr/leave/holidays` |
| `features/workforce-calendar` | `/hr/leave/calendar` |
| `features/my-workspace` (updated) | `/my-workspace` |

### My Workspace

Displays separately:

- Today's Shift (from `/me/workspace.todayShift`)
- Today's Work Plan (from `/me/workspace.todayWorkPlan`)
- Check-in/out state
- Personal attendance exceptions
- Leave balances/requests
- Overtime eligibility/requests
- Comp-off available/reserved/expiring
- Personal privacy calendar (`/me/workforce-calendar`)

Backend self-service also returns `todayWorkPlan` via `WorkScheduleItemService` (project work plan; distinct from shift roster).

### UI patterns

- `WorkspaceShell` + `FormSheet` for create/edit/review
- `ConfirmActionDialog` for publish/lock/archive/reopen-style actions
- Loading skeletons, empty states, retry on error
- Permission gates via `useAuth().hasPermission` (publish/lock/approve/revoke hidden without permission)

## Verification

```text
cd frontend
npx tsc --noEmit

cd ../backend
npx tsc --noEmit -p tsconfig.build.json
```

Result:

- Frontend TypeScript check passed.
- Backend TypeScript build check passed (self-service WorkScheduleItem wiring).

## Acceptance mapping

- No fake actions or data: services call real `/api` endpoints only.
- Forms use right-side sheets where appropriate (generate/override, regularization review, OT process, holiday edit, Comp-off revoke, period create).
- Permission-controlled navigation filters items by granted permissions.
