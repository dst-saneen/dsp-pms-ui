# WP-10 UAT Checklist — Workforce Time Management

Date: 2026-08-05  
Environment: _________________ (pilot Company / Branch)  
Tester: _________________  
Build/commit: _________________

Instructions: Mark Pass / Fail / Blocked. Attach screenshots or request IDs for failures. Do not invent data — use real tenant records.

## Prerequisites

- [ ] Branch timezone set (IANA)
- [ ] Working calendar reviewed
- [ ] Shifts exist and employees assigned
- [ ] `WORKFORCE_JOBS_ENABLED=false` until smoke complete
- [ ] Tester has required permissions for each workflow

## Workflows

| # | Workflow | Pass | Fail | Notes / request ID |
| --- | --- | --- | --- | --- |
| 1 | Configure Branch calendar | | | |
| 2 | Configure Shifts and employee assignments | | | |
| 3 | Dry-run and publish a roster (`/hr/work-schedule`) | | | |
| 4 | Employee check-in and check-out (`/my-workspace`) | | | |
| 5 | Late, early and missing-punch scenarios | | | |
| 6 | Employee regularization and manager approval | | | |
| 7 | Full-day and half-day Leave | | | |
| 8 | Leave rejection and cancellation | | | |
| 9 | Holiday and weekly-off work | | | |
| 10 | Overtime submission and approval (`/hr/overtime`) | | | |
| 11 | Comp-off generation, reservation and use | | | |
| 12 | Attendance period review, blockers, lock | | | |
| 13 | Payroll Pending handoff (no money calc) | | | |
| 14 | Tenant / manager-team / self-service isolation | | | |

## Frontend smoke (responsive)

| Viewport | Work Schedule | Attendance | OT / Comp-off | Calendar | My Workspace |
| --- | --- | --- | --- | --- | --- |
| 1440px | | | | | |
| 1024px | | | | | |
| 768px | | | | | |
| 390px | | | | | |

Also verify:

- [ ] Loading / error / empty / unavailable states
- [ ] Keyboard focus on FormSheets and calendar days
- [ ] No body-level horizontal overflow
- [ ] No fake Message / Email / Chat / Upgrade actions on My Workspace

## Isolation checks

- [ ] Employee cannot access another employee via `/me/*`
- [ ] Project Manager sees only reporting team on team calendar
- [ ] Cross-tenant ID returns `404`
- [ ] Self-approval rejected where configured

## Sign-off

| Role | Name | Date | Result |
| --- | --- | --- | --- |
| Technical | | | Pending / Pass / Fail |
| Business UAT | | | Pending / Pass / Fail |

Production approval requires **both** technical and business sign-off.
