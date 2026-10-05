# Notification System — Current Flow, Gaps & Plan

**Date:** 2026-09-25
**Scope:** Whole product notification stack (Projects/PMS, Leave, Roster, Assets, Onboarding, Recruitment, Payroll, Office Finance, and related)
**Status:** Audit + remediation plan only (no code changes in this document)

---

## 1. Purpose of this document

This document explains:

1. How notifications are implemented today
2. Which modules fire which events
3. Which pages / APIs show them
4. Which scenarios work end-to-end
5. What is missing or broken
6. A phased plan to close gaps (especially **Projects/PMS in-app + email**, and **activity log**)

---

## 2. What “notification” means in this product

There are only **two** delivery channels in the codebase today:

| Channel | Meaning | Status |
|---|---|---|
| **IN_APP** | Row in `user_notifications`, shown inside the product | Implemented |
| **EMAIL** | Message via ZeptoMail (Delivery V2) or transactional SMTP (legacy) | Implemented for some domains; **not** for Projects |
| **PUSH** (phone/browser popup) | FCM / web-push / OneSignal style | **Does not exist** |

Related but **different** concepts:

| Concept | What it is | Same as notification? |
|---|---|---|
| **User notification** | Alert for a person (`user_notifications`) | Yes |
| **Delivery message** | Delivery V2 queue row (EMAIL or IN_APP) | Pipeline toward notify/email |
| **Outbox event** | Reliable queue after a domain command | Trigger for notify/email |
| **Activity / Recent Activity** | User-facing “what happened lately” feed | **No** — currently a stub |
| **Audit / action evidence** | `AuditLog`, `ProjectActionEvent`, etc. | **No** — system history, not the bell |

**Important rule:** writing a notification does **not** write an activity row. Writing audit/action evidence does **not** create a notification.

---

## 3. Architecture — how it works end to end

```
Domain action (assign task, approve leave, send offer, …)
        │
        ▼
OutboxWriterService.write()
        │  table: outbox_events (PENDING)
        ▼
WorkforceJobsScheduler  (needs WORKFORCE_JOBS_ENABLED)
        │
        ▼
OutboxProcessorService
        │
        ├── Delivery V2 ON + company/branch allowlisted?
        │         YES → DeliveryFanoutService
        │                 → delivery_messages (per recipient × channel)
        │                 → DeliveryEmailWorker  → ZeptoMail
        │                 → DeliveryInAppWorker  → UserNotificationService.create
        │
        └── NO (legacy path)
                  ├─ recruitment.* → RecruitmentDeliveryProcessor
                  │                    (mail + in-app for HR)
                  └─ other events → UserNotificationService.create directly
```

### Dual path (critical)

| Condition | Path used | Result |
|---|---|---|
| `DELIVERY_V2_ENABLED=false` **or** company/branch **not** on allowlist | **Legacy** | In-app via `UserNotification` (recruitment may still email via processor) |
| V2 enabled **and** allowlisted | **Delivery V2** | Only events listed in `delivery-event.registry.ts` fan out. Unregistered events → `UNSUPPORTED_EVENT` → **no in-app, no email** |

So: turning Delivery V2 on for a company **without** registering leave/assets/roster/etc. can **stop** those in-app notifications for that company.

### Core files

| Layer | Path |
|---|---|
| Outbox write | `backend/src/modules/outbox/outbox-writer.service.ts` |
| Outbox process | `backend/src/modules/outbox/outbox-processor.service.ts` |
| Workforce cron | `backend/src/modules/workforce-jobs/workforce-jobs.scheduler.ts` |
| Delivery fan-out | `backend/src/modules/delivery/delivery-fanout.service.ts` |
| Event → channels | `backend/src/modules/delivery/resolution/delivery-event.registry.ts` |
| In-app worker | `backend/src/modules/delivery/delivery-inapp.worker.ts` |
| Email worker | `backend/src/modules/delivery/delivery-email.worker.ts` |
| Delivery cron | `backend/src/modules/delivery/delivery-jobs.scheduler.ts` |
| Feature gate | `backend/src/modules/delivery/delivery-feature-gate.service.ts` |
| User notification CRUD | `backend/src/modules/notification/user-notification.service.ts` |
| HTTP API | `backend/src/modules/notification/user-notification.controller.ts` |
| Title/message catalog | `backend/src/modules/notification/notification-event.catalog.ts` |
| Deep links | `backend/src/modules/notification/notification-href.ts` |
| ZeptoMail | `backend/src/modules/mail/zeptomail.service.ts` |
| Legacy/transactional mail | `backend/src/modules/mail/transactional-mail.service.ts` |

---

## 4. Where users see notifications (pages & UI)

### 4.1 End-user in-app UI

| Surface | Path | Wired to live route? | Notes |
|---|---|---|---|
| Employee Workspace notifications panel | `frontend/features/employee/workspace/employee-notifications.tsx` | **No dedicated app route found** | Component exists; data comes from `GET /employee-workspace/:employeeId` |
| Employee Workspace shell | `frontend/features/employee/workspace/employee-workspace.tsx` | Not mounted under `app/` | Orphaned relative to current My Workspace |
| Live **My Workspace** page | `frontend/app/(dashboard)/my-workspace/page.tsx` → `features/my-workspace` | **Yes** | Does **not** render notifications or activity today |
| Header notification slot | `frontend/components/layout/app-header.tsx` (`slots.notifications`) | Slot exists | **No bell component wired** |
| Direct `/notifications` API from frontend | — | **Not used** | Backend API exists; no `API_ENDPOINTS.notifications` client found |

**Practical meaning today:** backend can create `user_notifications`, but the primary live employee home (`/my-workspace`) does **not** show them. There is no global header bell. Mark-read APIs exist on the backend but are unused by the frontend.

### 4.2 Ops / delivery admin UI (not the user bell)

These pages track the **email/in-app delivery pipeline**, not personal alerts:

| Route | Purpose |
|---|---|
| `/hr/recruitment/delivery` | Recruitment delivery list |
| `/hr/recruitment/delivery/[id]` | Delivery detail |
| `/admin/operations/delivery` | Platform delivery queue |
| `/admin/operations/delivery/[id]` | Detail |
| `/admin/operations/delivery/dead-letters` | Dead letters |
| `/admin/operations/delivery/suppressions` | Suppressions |
| `/admin/operations/delivery/recipient-exceptions` | Recipient exceptions |

Feature code: `frontend/features/delivery/`

### 4.3 Backend APIs for end users

| Method | Path | Permission | Used by FE? |
|---|---|---|---|
| `GET` | `/notifications?unreadOnly&limit` | `hr.self.read` | No client found |
| `POST` | `/notifications/read-all` | `hr.self.manage` | No |
| `POST` | `/notifications/:id/read` | `hr.self.manage` | No |
| `GET` | `/employee-workspace/:employeeId` | (workspace) | Partial — aggregate includes notifications, but UI not on live My Workspace |

---

## 5. Domain inventory — scenarios that fire notifications

Legend for channels:

- **I** = IN_APP
- **E** = EMAIL
- **EI** = EMAIL + IN_APP
- **—** = not in Delivery V2 registry (legacy in-app only when V2 off / not allowlisted)

### 5.1 Projects / PMS

**Enqueue service:** `backend/src/modules/projects/services/project-notification.service.ts`
**Registry channels today:** **IN_APP only** for every `projects.*` event
**Email for Projects:** **No**
**Catalog copy for `projects.*`:** falls back to generic “Workforce update”
**Deep links for `projects.*`:** `null` (no project/task/timesheet href)

| Scenario | Event code | Triggered from | Who typically notified |
|---|---|---|---|
| Project activated / held / resumed / completed / cancelled | `projects.project.*` | `projects-lifecycle.service.ts` | Manager / team (recipient list at enqueue) |
| Team member added / ended | `projects.team.member.added/ended` | `project-team-command.service.ts` | Member |
| Task assigned / reassigned | `projects.task.assigned/reassigned` | `project-task-command.service.ts` | Assignee |
| Task submitted / returned / completed | `projects.task.submitted/returned/completed` | `project-task-command.service.ts` | Manager or assignee |
| Task due soon / overdue | `projects.task.due_soon/overdue` | `project-task-reminder-job.service.ts` (cron) | Assignee |
| Timesheet submitted / returned / approved / cancelled | `projects.timesheet.*` | `project-timesheet-command.service.ts` | Approver or employee |

**Needs:** `PROJECTS_LITE_ENABLED` + company allowlist, and `WORKFORCE_JOBS_ENABLED` (plus `PROJECTS_REMINDERS_ENABLED` for due/overdue).

---

### 5.2 Leave

**Enqueue:** `leave-request.service.ts` (+ optional-holiday selection path)
**In Delivery V2 registry?** **No**

| Scenario | Event | Typical recipient |
|---|---|---|
| Leave submitted | `LEAVE_REQUEST_SUBMITTED` | Approvers |
| Leave submitted (requester ack) | `LEAVE_REQUEST_SUBMITTED_REQUESTER` | Requester |
| Leave approved / rejected | `LEAVE_REQUEST_APPROVED` / `REJECTED` | Employee |

**Href:** approver → `/hr/leave?requestId=…`; employee → `/my-workspace`
**Catalog:** dedicated copy exists

---

### 5.3 Shift roster

**Enqueue:** `shift-roster-outbox.service.ts` / `shift-roster.service.ts`
**In Delivery V2 registry?** **No**

| Scenario | Event | User-facing? |
|---|---|---|
| Roster published / locked / archived | `SHIFT_ROSTER_PUBLISHED/LOCKED/ARCHIVED` | Yes (branch users via processor) |
| Roster generated / entry overridden | `SHIFT_ROSTER_GENERATED`, `SHIFT_ROSTER_ENTRY_OVERRIDDEN` | Outbox only; no catalog/href |

**Href (user-facing):** `/my-workspace`

---

### 5.4 Optional holiday

| Scenario | Event | Service |
|---|---|---|
| Selection window opened | `OPTIONAL_HOLIDAY_SELECTION_OPENED` | `business-calendar-publish.service.ts` |
| Selection updated | `OPTIONAL_HOLIDAY_SELECTION_UPDATED` | `optional-holiday-selection.service.ts` |
| Reminder (tomorrow) | `OPTIONAL_HOLIDAY_TOMORROW` | `optional-holiday-reminder.service.ts` |

**In Delivery V2 registry?** **No**
**Href:** `/my-workspace`

---

### 5.5 Assets

**Enqueue:** `asset-notification.service.ts`
**In Delivery V2 registry?** **No**

| Scenario | Event | Enqueued? |
|---|---|---|
| Asset assigned | `ASSET_ASSIGNED` | Yes (`asset-custody.service.ts`) |
| License allocated | `ASSET_LICENSE_ALLOCATED` | Yes |
| Custody request submitted / resolved | `ASSET_CUSTODY_REQUEST_*` | Yes |
| Transfer requested / accepted / rejected | `ASSET_TRANSFER_*` | Yes |
| Clearance waiver requested / approved / rejected | `ASSET_CLEARANCE_WAIVER_*` | Yes |
| Acknowledgement pending / expiry / capacity | catalog events | **Never enqueued** |

**Href:** employee-facing → `/my-workspace`; ops → `/asset-management/assets`

---

### 5.6 Onboarding V2

**Enqueue:** `onboarding-notification.service.ts`
**In Delivery V2 registry?** **Yes** (mixed EI / I)

| Scenario | Event | Channels (registry) | Enqueued? |
|---|---|---|---|
| Task assigned / reassigned / due soon / overdue | `ONBOARDING_TASK_*` | **EI** (assignee) | Yes |
| Task unassigned / dept work available | … | **I** (department) | Partial |
| Task completed / waived | … | **I** | Yes |
| Onboarding started | `ONBOARDING_STARTED` | **EI** employee + **I** HR | **No enqueue found** |
| Onboarding completed / cancelled | … | **I** | **No enqueue found** |
| Dept no assigner | `ONBOARDING_DEPARTMENT_NO_ASSIGNER` | **I** HR | **No enqueue found** |

**Href:** `/my-workspace/onboarding`

---

### 5.7 Recruitment

**Enqueue:** `recruitment-outbox.service.ts`
**In Delivery V2 registry?** **Yes** (strongest email usage)

| Scenario | Candidate | Panel | HR | Enqueued? |
|---|---|---|---|---|
| Application received | E | — | I | Yes |
| Interview scheduled / rescheduled / cancelled | E | EI | I | Yes |
| Offer sent / accepted / declined | E | — | I | Yes |
| Offer signature flows | E / I (varies) | — | I | Yes |
| Conversion completed | — | — | I | Yes |
| Employee invitation | E | — | — | Yes |
| Shortlisted / evaluation due / manager decision due / ready to hire / probation due | (registered) | | | **No enqueue found** |

**Ops pages:** `/hr/recruitment/delivery*`
**Href:** applications / interviews / offers / employees routes

---

### 5.8 Payroll

| Scenario | Event | Channels | Service |
|---|---|---|---|
| Payslip available | `payroll.payslip.available` | **EI** | `payroll-payslip-worker.service.ts` |

**Href:** `/my-workspace`
Note: `payroll.payslip.generate` is an outbox job for generation, not a user notification.

---

### 5.9 Office Finance

**Enqueue:** `office-finance-delivery.service.ts`
**Channels:** **IN_APP only**

| Scenario | Event |
|---|---|
| Transaction submitted / approved / returned / cancelled / reversed | `office-finance.transaction.*` |
| Period locked / reopened | `office-finance.period.*` |

**Catalog / href:** no dedicated cases → generic title, `href: null`

---

### 5.10 HR request / separation / clearance

| Domain | Events (examples) | In V2 registry? | Catalog / href |
|---|---|---|---|
| HR request | `HR_REQUEST_CREATED/COMPLETED/CANCELLED/APPROVED/REJECTED` | No | Generic / null |
| Separation | `EMPLOYEE_SEPARATION_*` | No | Generic / null |
| Clearance | `EMPLOYEE_CLEARANCE_ITEM_*` | No | Generic / null |

---

### 5.11 Auth invitations (email outside outbox)

| Path | Mechanism |
|---|---|
| Admin invite / resend | `account-lifecycle.service.ts` → `TransactionalMailService` (direct mail) |
| Recruitment conversion invite | Outbox `recruitment.employee.invitation` → Delivery / legacy processor |

These are emails, not `UserNotification` rows (except where recruitment also creates HR in-app).

---

### 5.12 Catalog-only — copy/href exist, **never enqueued**

| Event group | Status |
|---|---|
| `OVERTIME_REQUEST_SUBMITTED/APPROVED/REJECTED` | No outbox in overtime module |
| `ATTENDANCE_REGULARIZATION_SUBMITTED/APPROVED` | No enqueue found |
| `COMP_OFF_CREDIT_CREATED/EXPIRED` | No notify from expiry job |
| `ATTENDANCE_PERIOD_REOPENED` | No enqueue found |
| Several asset expiry / capacity / acknowledgement events | Catalog only |

---

## 6. Projects/PMS deep dive (focus area)

### Current flow (working path)

```
Project / Task / Team / Timesheet command
        │
        ▼
ProjectNotificationService.enqueue()  (same DB transaction)
        │
        ▼
outbox_events
        │
        ▼
OutboxProcessor
        ├─ legacy → UserNotification (IN_APP)
        └─ V2 allowlisted → DeliveryFanout → IN_APP only (no EMAIL)
        │
        ▼
user_notifications
```

### What works

- Events are defined and enqueued for lifecycle, team, task, timesheet, due/overdue
- Recipients resolved at enqueue; Delivery V2 revalidates via `delivery-project-recipient.handler.ts`
- Durable in-app rows can be created when jobs run

### What is missing for Projects

| Gap | Detail |
|---|---|
| **No email** | Registry uses `IN_APP` only for all `projects.*` |
| **Weak titles** | No `projects.*` cases in `notification-event.catalog.ts` → “Workforce update” |
| **No deep links** | `notification-href.ts` returns `null` for project events |
| **User UI gap** | Live `/my-workspace` does not list notifications; header bell unused |
| **Activity not written** | No activity feed entry alongside notify |
| **V2 entity context risk** | In-app worker may create rows without `entityType` / `entityId`, hurting future hrefs |

### Domain evidence (not the activity feed)

Projects also write:

- `ProjectActionEvent` — state-transition evidence
- `ProjectCommandReceipt` — idempotent command receipts

These are **audit/correctness**, not My Workspace “Recent Activity”, and are **not linked** to `UserNotification` IDs.

---

## 7. Activity log — current state

| Piece | Path | Status |
|---|---|---|
| Activity service | `backend/src/modules/employee-workspace/services/employee-workspace-activity.service.ts` | **Stub** — always returns `[]` |
| Activity UI | `frontend/features/employee/workspace/employee-activity.tsx` | Renders empty state |
| Live My Workspace | `features/my-workspace` | Does not show activity panel |

**Conclusion:** there is **no working user activity log** today. Notifications and activity are separate; neither writes the other.

---

## 8. Feature flags & runtime requirements

| Variable | Effect |
|---|---|
| `WORKFORCE_JOBS_ENABLED` | Outbox processor + reminder crons must run |
| `DELIVERY_V2_ENABLED` | Master switch for Delivery V2 (default often false) |
| `DELIVERY_V2_ALLOWLIST_JSON` | Required when V2 on; `{ companyId, branchIds?, dryRun? }` |
| `ZEPTOMAIL_*` | Required when V2 email is used |
| `PROJECTS_LITE_ENABLED` + `PROJECTS_LITE_COMPANY_IDS` | Projects domain on |
| `PROJECTS_REMINDERS_ENABLED` | Due soon / overdue job |
| `ONBOARDING_V2_ENABLED` + allowlists | Onboarding notify gate |
| `RECRUITMENT_ENABLED` | Recruitment domain |
| `EMAIL_ENABLED` / SMTP vars | Legacy transactional mail when V2 off |

**Delivery workers** also require `WORKFORCE_JOBS_ENABLED && DELIVERY_V2_ENABLED`.

---

## 9. Gap summary (whole system)

### P0 — product-visible / data loss risk

1. **Delivery V2 allowlist drops unregistered domains** (leave, roster, assets, optional holiday, HR request, separation, clearance) → `UNSUPPORTED_EVENT`, no in-app.
2. **End-user UI not wired** — notifications API + Employee Workspace panel exist; live `/my-workspace` and header bell do not show them.
3. **Projects have no email** while product expectation for PMS is in-app + email.

### P1 — quality / completeness

4. Projects / office-finance / HR request / separation / clearance: **generic titles**, **null deep links**.
5. Activity feed stub.
6. Catalog-only events never enqueued (overtime, regularization, comp-off, some assets, some onboarding/recruitment due events).
7. Delivery V2 in-app worker may drop entity context needed for hrefs.

### P2 — polish / ops

8. Mark-read unused by FE.
9. `queryKey: ["notifications"]` invalidated from onboarding with no matching FE query.
10. No push channel (explicitly out of scope unless requested later).
11. Admin invites bypass Delivery evidence (direct transactional mail).

---

## 10. Plan (phased)

### Phase 0 — Decisions (no code)

Lock answers before implementation:

1. **Channels for Projects:** IN_APP + EMAIL (confirm); push later/never.
2. **Which `projects.*` events get email** — all vs high-value only (recommend high-value first: assign/reassign, due/overdue, timesheet submit/approve/return, team add).
3. **Activity log meaning:**
   - A) Build real My Workspace Recent Activity
   - B) Rely only on domain evidence (`ProjectActionEvent`)
   - C) Both
4. **Where users read in-app alerts:** My Workspace panel and/or header bell.
5. **Delivery V2 rollout:** register workforce events **before** allowlisting companies that use leave/assets/roster.

**Exit:** written product decisions.

---

### Phase 1 — Make current in-app visible (frontend consumption)

1. Surface notifications on live `/my-workspace` **or** mount Employee Workspace notifications there.
2. Optionally wire header `slots.notifications` bell → `GET /notifications`.
3. Wire mark-read / read-all.
4. Invalidate the correct query keys after actions.

**Exit:** users can see and clear in-app notifications in production UI.

---

### Phase 2 — Projects notification quality

1. Add dedicated `projects.*` copy in `notification-event.catalog.ts`.
2. Add deep links in `notification-href.ts` (project / task / timesheet pages with safe IDs).
3. Ensure V2 in-app worker passes `entityType` / `entityId`.
4. Verify enqueue + recipient safety for each scenario in §5.1.

**Exit:** PMS in-app alerts have clear titles and clickable destinations.

---

### Phase 3 — Projects email

1. Update `delivery-event.registry.ts` for approved events → `EMAIL` or `EMAIL_AND_IN_APP`.
2. Reuse Delivery email content + ZeptoMail patterns (same as onboarding/payslip).
3. Confirm allowlist + ZeptoMail env for target companies.
4. UAT: assign, due soon, timesheet approve/return, team add.

**Exit:** agreed PMS events arrive by email and in-app.

---

### Phase 4 — Activity log (if Phase 0 chose A or C)

1. Define activity model (new table vs derive from notifications / `ProjectActionEvent`).
2. Write activity when key PMS (and optionally workforce) actions succeed.
3. Replace stub `EmployeeWorkspaceActivityService`.
4. Show on My Workspace.

**Exit:** Recent Activity is non-empty and accurate.

---

### Phase 5 — Delivery V2 safety for workforce domains

1. Register leave, roster, assets, optional holiday, HR request, separation, clearance in delivery registry **or** keep them on legacy path explicitly.
2. Add regression tests: allowlisted company must still deliver leave/asset in-app.
3. Document allowlist runbook.

**Exit:** enabling V2 does not silence workforce notifications.

---

### Phase 6 — Backfill “catalog-only” domains (optional backlog)

Priority order (product decide):

1. Overtime request notifications
2. Attendance regularization
3. Comp-off credit create/expire
4. Asset expiry / capacity / acknowledgement
5. Missing onboarding lifecycle + recruitment due events

---

### Phase 7 — Explicitly out of scope unless requested

- Push notifications (FCM / web push)
- Changing recruitment email content beyond shared pipeline fixes
- Rewriting AuditLog / ProjectActionEvent into the user bell

---

## 11. Suggested UAT matrix (after implementation)

| # | Scenario | Expect in-app | Expect email | Expect activity (if in scope) |
|---|---|---|---|---|
| 1 | Task assigned | Yes | Per Phase 0 | Optional |
| 2 | Task due soon / overdue | Yes | Per Phase 0 | Optional |
| 3 | Timesheet submitted | Yes (approver) | Per Phase 0 | Optional |
| 4 | Timesheet approved / returned | Yes (employee) | Per Phase 0 | Optional |
| 5 | Team member added | Yes | Per Phase 0 | Optional |
| 6 | Project held / completed | Yes | Per Phase 0 | Optional |
| 7 | Leave submitted (regression) | Yes | N/A today | — |
| 8 | Payslip available (regression) | Yes | Yes | — |
| 9 | Open My Workspace / bell | List visible | — | Feed visible if built |
| 10 | Click notification | Lands on correct page | — | — |

---

## 12. Quick reference — status board

| Area | Today | Target |
|---|---|---|
| Shared outbox + UserNotification | Working | Keep |
| Delivery V2 + ZeptoMail | Working for registered events | Extend carefully |
| Projects in-app enqueue | Working | Keep + polish copy/links |
| Projects email | Missing | Add for agreed events |
| Push | Missing | Stay missing unless asked |
| End-user notification UI on live pages | Missing / orphaned | Wire My Workspace + optional bell |
| Activity feed | Stub `[]` | Real feed if product wants it |
| Leave/assets/roster under V2 allowlist | Risk of drop | Register or exclude from V2 |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Outbox** | DB queue so notify/email happens after the main action commits |
| **Delivery V2** | Shared fan-out to EMAIL and/or IN_APP with workers and ops UI |
| **User notification** | Personal in-app alert row |
| **Deep link / href** | In-app URL opened from a notification |
| **Allowlist** | Company/branch list allowed to use Delivery V2 |
| **Activity log** | User-facing recent history (separate from audit evidence) |

---

**Document intent:** single source of truth for how notifications work today, where they appear, which scenarios fire, what is missing, and the ordered plan to fix — especially Projects/PMS in-app + email and activity logging.
