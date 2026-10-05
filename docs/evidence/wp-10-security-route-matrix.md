# WP-10 Security Route Matrix — Workforce Time Management

Date: 2026-08-05  
Source: `backend/src/modules/auth/route-policy.ts` + frontend `config/navigation.ts`

| Area | API pattern | Read | Manage / other | UI route |
| --- | --- | --- | --- | --- |
| Shift roster | `shift-rosters` | `hr.schedule.read` | `hr.schedule.manage`, publish/lock `hr.schedule.publish` | `/hr/work-schedule` |
| Attendance daily | `attendance` | `hr.attendance.read` | `hr.attendance.manage` | `/hr/attendance` |
| Exceptions / regs | `attendance/exceptions`, `attendance/regularizations` | `hr.attendance.read` | `hr.attendance.regularize` | `/hr/attendance/exceptions` |
| Periods | `attendance-periods` | `hr.attendance.read` | `hr.attendance.lock` | `/hr/attendance/periods` |
| Overtime | `overtime-requests` | `hr.overtime.read` | manage `hr.overtime.manage`, approve `hr.overtime.approve` | `/hr/overtime` |
| Comp-off | `comp-off-credits` | `hr.comp-off.read` | `hr.comp-off.manage` | `/hr/leave/comp-off` |
| Holidays | `holidays` | `hr.holidays.read` | `hr.holidays.manage` | `/hr/leave/holidays` |
| Workforce calendar | `workforce-calendar` | `hr.calendar.read` | — | `/hr/leave/calendar` |
| Team calendar | `team/workforce-calendar` | `hr.team.read` | — | (team surface) |
| Self-service | `me/*` | `hr.self.read` | `hr.self.manage` | `/my-workspace` |
| Jobs health | `workforce-jobs/health` | ops / manage attendance | jobs gated by env | — |

Notes:

- Self-service never trusts client-sent employee IDs.
- Out-of-scope entity access returns `404`.
- Stale optimistic transitions return `409` with workforce error codes.
- Navigation items are filtered by `hasPermission` in the sidebar.
