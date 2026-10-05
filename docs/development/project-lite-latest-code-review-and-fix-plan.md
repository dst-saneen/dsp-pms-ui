# Project Lite Latest Code Review and Remediation Plan

**Review baseline:** repository `HEAD 84e8014` / Project Lite implementation commit `97aa7b4`  
**Review date:** 2026-08-21  
**Current decision:** **NO-GO — keep Project Lite disabled for every Company and Branch**  
**Scope:** Project Lite database, migrations, backend/API, frontend/UI, notifications, secure documents, tests, migration rehearsal and production acceptance.

This document explains how to close the findings from the latest Project Lite review. It supplements the authoritative product plan in `docs/development/project-lite-db-api-ui-implementation-plan.md`; it does not replace its business flow.

No migration should be applied to a shared development, UAT or production database until the P0 fixes and disposable-database rehearsals in this document pass.

## 2026-09-01 implementation completion update

**Development status:** the reopened Project Lite P0/P1 implementation findings and required P2 UI work are closed in the working tree. The ordered migration chain is applied and verified on shared `dsp_erp_dev/dsp_pms`. **Production status remains NO-GO** until real API/browser persona UAT and business sign-off are completed. Project Lite remains disabled and requires a non-empty Company allowlist.

### Implemented result

- Project enablement now fails closed when the global flag is off, the Company context is missing, or the Company allowlist is empty/non-matching. API guards, module capabilities, and navigation use the same predicate.
- Draft administration and Active Project Manager authority are enforced at record level. Child mutations lock and revalidate the parent Project, actor authority, organization relationships, and versions inside the command transaction.
- Project create and update share Branch, Manager, Business Party, Project type, and base-currency validation. A Project-scoped Business Party candidate API avoids granting Project Managers broad Finance access.
- Task work is restricted to the active assignee. Unassignment is pre-start only; reassignment, return, and cancellation require protected reasons. Project completion locks children and rejects incomplete Stages/Tasks, pending reviews, and submitted Timesheets.
- Submission/review history is immutable. Task detail exposes server-scoped submission, review, assignment, secure-document, and evidence history. Command receipts store only `{entityId,state,version}`.
- Company/Project-qualified Project hierarchy, participant, submission, review, document, Work Log, Branch, Manager, and Employee relationships are represented in Prisma and the corrective migration.
- `projects.week_start` is a typed Company setting; Branch IANA business dates are used for week and reminder decisions. Effective-date eligibility requires both Task participation and Project team membership.
- The race-prone daily-hours calculation is replaced by the `project_daily_time_totals` aggregate backstop. Project due-soon/overdue notifications revalidate the exact active Company/Branch Employee/User/Task relationship and use recipient-specific dedupe keys.
- Project Stage, Team, Task, assignment, evidence, history, document/download, and Timesheet UI gaps are implemented against server `allowedActions`.

### Database and migration evidence

- New additive migration: `backend/prisma/migrations/20260901110000_project_lite_production_hardening/migration.sql`. No previously applied migration was edited.
- Required predecessor remains `20260901100000_hr_operations_hardening`; the Project migration follows it in normal Prisma order.
- Disposable PostgreSQL 17 from-zero rehearsal applied all **145 migrations** successfully.
- Production-like upgrade rehearsal applied the first **143 migrations**, loaded synthetic legacy Project, Stage, Task, Team, Participant, Submission, Review, Work Log, Finance, Payroll, and generated-file rows, then applied the two ERP Lite corrective migrations successfully.
- Upgrade reconciliation preserved the Project fixture and backfilled the daily aggregate to `8.00` hours.
- Catalog verification inspected actual definitions for Company-qualified foreign keys, composite unique indexes, upload-session indexes, daily-total constraints, daily-total synchronization, and immutable submission/review triggers.
- Project preflight against the upgraded fixture returned `exceptionCount=0` and `blockingExceptionCount=0`.
- Custom-format backup and restore rehearsal succeeded; the restored database contained all 145 migration receipts, the Project fixture, and the expected daily aggregate.
- On 2026-09-01, shared `dsp_erp_dev/dsp_pms` successfully applied `20260901100000_hr_operations_hardening`, `20260901110000_project_lite_production_hardening`, and `20260901120000_office_finance_payroll_production_hardening` in Prisma order. `prisma migrate status` reports all 145 migrations up to date.
- Shared Project preflight returned `exceptionCount=0` and `blockingExceptionCount=0`. Catalog verification read the actual Company-qualified constraint, composite-index, daily-total trigger, immutable-history trigger, and permission definitions with no missing objects.

### Verification evidence

- Runtime baseline: Node `v24.20.0`.
- Prisma validate and generate: passed.
- Backend TypeScript 6 build/test configurations: passed.
- Backend TypeScript 7 build/test configurations: passed.
- Backend full lint: passed.
- Backend production build: passed.
- Backend full Jest: **157 suites passed, 3 skipped; 855 tests passed, 11 skipped**. Skipped opt-in suites are not counted as runtime evidence.
- Frontend TypeScript 6 and 7: passed.
- Frontend full lint: passed.
- Frontend Vitest: **26 files / 52 tests passed**.
- Frontend production build: passed; 85 routes generated/verified.
- Real PostgreSQL Project concurrency runner, with mock mode absent, passed:
  - Project completion versus child mutation serialization;
  - concurrent assign and stale retry;
  - reassign versus unassign and stale retry;
  - active-participant partial-unique enforcement (`23505`);
  - concurrent 13-hour entries where one is rejected with `TIMESHEET_DAILY_HOURS_EXCEEDED` and the committed aggregate remains `13.00`.
- The concurrency runner verified zero remaining Project test Companies after cleanup.

### Remaining external release gates

1. Run authenticated real API and Playwright Project personas with mock mode disabled. No authenticated shared-environment credentials were used in this implementation pass, so this gate is not claimed.
2. Complete manual Project administrator, Project Manager, assignee, Timesheet approver, outsider, cross-Company, and cross-Branch UAT plus business/security/operations sign-off.
3. Enable only an explicitly approved Company allowlist after the preceding gates pass.

---

## 1. Intended Project Lite flow to preserve

The remediation must preserve this bounded flow:

1. An authorized Project administrator creates an Internal or Client Project.
2. The administrator configures Project Manager, organization, dates and commercial summary inputs.
3. The Project Manager creates Stages, Team membership and Tasks.
4. The Project Manager assigns Tasks to active Project Team members.
5. The assigned Employee starts work and submits immutable work/review evidence.
6. The Project Manager returns or completes the submitted Task.
7. Employees create weekly timesheets from eligible Project Tasks or configured Work Categories.
8. The snapshotted reporting manager approves or returns the weekly timesheet.
9. Project Time Summary uses approved timesheets only.
10. Project Finance Summary uses approved Office Finance cash transactions only and remains visibly disabled until that provider is production-ready.

Project Lite does not introduce full accounting, resource forecasting, billing, procurement or profitability accounting.

---

## 2. Current verified status

### 2.1 Completed foundation

- Project Lite feature flag defaults off and a Company allowlist is present.
- Canonical Project, Stage, Team, Task, self-service and manager-timesheet controllers exist.
- Canonical controllers have explicit Project permissions.
- Basic optimistic versions and `(companyId, operationId)` command receipts exist.
- Task start/submit verifies the active participant.
- Timesheet approval uses a snapshotted reporting-manager User and blocks self-approval.
- Generic Approval mutations reject `WORK_LOG_HEADER`.
- Secure Project upload waits for a `CLEAN` File Object before linking.
- Durable outbox events and dedupe keys exist for implemented Project notifications.
- Project list/detail, My Projects, My Timesheets and Team Timesheets page shells exist.
- `/projects/resources` safely redirects because resource planning is deferred.

### 2.2 Evidence that is not yet complete

- All five Project Lite migrations are pending on the shared development database:
  - `20260820170500_projects_lite_permissions`
  - `20260820180000_project_lite_expand`
  - `20260820181000_project_lite_reconcile`
  - `20260820182000_project_lite_contract`
  - `20260821120000_project_lite_file_session_binding`
- The current development Project, Stage, Task, Team, Participant and Work Log tables contain no legacy rows. This does not prove upgrade/backfill correctness.
- Prisma validation passes.
- Focused backend tests pass 7 suites / 32 tests, but migration tests use mocked Prisma query clients.
- Backend TypeScript fails, including Project-specific DTO/schema errors.
- Frontend TypeScript fails on current Delivery/Recruitment changes.
- Project frontend lint passes.
- No Project frontend unit test exists.
- No real Project Playwright persona test exists.
- No real PostgreSQL Project migration or concurrency rehearsal exists.

---

## 3. Finding register

| ID | Priority | Finding | Release effect |
|---|---|---|---|
| PRJ-P0-01 | P0 | Receipt immutability trigger rejects the required receipt completion update | Every Project mutation rolls back after contract migration |
| PRJ-P0-02 | P0 | Global context can resolve to an unrestricted Company filter | Cross-Company data exposure |
| PRJ-P0-03 | P0 | Legacy Project read controllers remain registered and unscoped | Cross-tenant Project, Employee and work-log exposure |
| PRJ-P0-04 | P0 | Backend does not compile against the new required Project snapshots | Build/deployment blocked |
| PRJ-P0-05 | P0 | UI-created Projects cannot configure activation prerequisites | Projects remain stuck in `DRAFT` |
| PRJ-P0-06 | P0 | Project Manager assignment/review flow is absent from the UI | Core Project lifecycle cannot complete |
| PRJ-P1-01 | P1 | Migration preflight can return green for contract-failing data | Unsafe rollout evidence |
| PRJ-P1-02 | P1 | Company-qualified aggregate constraints are incomplete | Direct SQL/bug can create tenant or aggregate drift |
| PRJ-P1-03 | P1 | Daily-hours enforcement is race-prone and terminal timesheets are mutable | Incorrect approved time history |
| PRJ-P1-04 | P1 | Project lifecycle and Task command preconditions are incomplete | Direct API can bypass `allowedActions` |
| PRJ-P1-05 | P1 | Task assignment authority and state rules are incomplete | Wrong actor or invalid unassignment |
| PRJ-P1-06 | P1 | Task submission/review rounds have no canonical write path | No immutable work/review evidence |
| PRJ-P1-07 | P1 | Receipt hashing, actor replay and isolation contract are incomplete | Weak idempotency and unsafe replay |
| PRJ-P1-08 | P1 | Client Project and Finance dependencies are unfinished | Client/Finance acceptance blocked |
| PRJ-P1-09 | P1 | Timesheet effective-date, timezone and manager eligibility rules are incomplete | Incorrect work/approval eligibility |
| PRJ-P1-10 | P1 | Notification recipient resolution and reminders are incomplete | Unsafe/missing notifications |
| PRJ-P1-11 | P1 | Timesheet, attachment and capability-driven UI journeys are incomplete | Required personas cannot finish work |
| PRJ-P2-01 | P2 | Query DTO allowlists, paging and exact preflight counts are incomplete | Unstable API/error behavior |
| PRJ-P2-02 | P2 | Migration integrity verification checks names rather than definitions | False-green catalog evidence |
| PRJ-P2-03 | P2 | UI error, paging, display-name and conflict behavior is incomplete | Poor production usability |

---

## 4. Migration correction strategy

### 4.1 Do not rewrite migration history by default

The existing Project migrations are committed. Create a new corrective migration after `20260821120000_project_lite_file_session_binding`, for example:

`20260821xxxx_project_lite_p0_p1_remediation`

Only amend an earlier migration if a read-only migration-ledger check proves it has never been applied in any developer, CI, UAT, staging or production database and the team explicitly agrees to replace its checksum. Otherwise, use the corrective migration.

Keep `PROJECTS_LITE_ENABLED=false` during the complete migration chain. No Project API traffic may run between the contract migration and its corrective migration.

### 4.2 Corrective migration responsibilities

The corrective migration must:

1. Replace the receipt immutability trigger.
2. Add missing supporting unique keys and Company-qualified composite foreign keys.
3. Add missing Work Log snapshot/header constraints.
4. Add terminal Work Log immutability guards.
5. replace the daily-hours trigger with a concurrency-safe implementation.
6. make reconciled submission/review state columns non-null when their preflight is clean.
7. add any new indexes needed by Project and Timesheet queues.
8. keep every constraint and trigger explicitly named for error translation and catalog verification.

---

## 5. P0 remediation

### 5.1 PRJ-P0-01 — Repair command receipt completion

#### Problem

`20260820182000_project_lite_contract` installs an unconditional `BEFORE UPDATE OR DELETE` immutable trigger on `project_command_receipts`. `ProjectCommandReceiptService` first inserts the claimed receipt and then updates it with the command result. The required update raises `PROJECT_HISTORY_IMMUTABLE` and rolls back the business transaction.

#### Required database behavior

A receipt may have exactly two logical states:

- **CLAIMED:** immutable command identity/hash fields are populated and result fields are null.
- **COMPLETED:** result entity, safe response snapshot and `completedAt` are populated exactly once.

Add `completedAt DateTime?` to `ProjectCommandReceipt` and replace the current trigger with a guard that:

- always rejects `DELETE`;
- rejects changes to `id`, `companyId`, `operationId`, `commandType`, `actorUserId`, request hash/version fields and `createdAt`;
- permits only one update from a fully empty result shape to a fully populated result shape;
- rejects completion when any result field was already populated;
- rejects clearing or changing a completed result;
- returns `PROJECT_HISTORY_IMMUTABLE` for prohibited changes.

Illustrative trigger rule:

```sql
IF TG_OP = 'DELETE' THEN
  PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
END IF;

IF OLD."safeResultSnapshot" IS NULL
   AND OLD."resultEntityType" IS NULL
   AND OLD."resultEntityId" IS NULL
   AND OLD."completedAt" IS NULL
   AND NEW."safeResultSnapshot" IS NOT NULL
   AND NEW."resultEntityType" IS NOT NULL
   AND NEW."resultEntityId" IS NOT NULL
   AND NEW."completedAt" IS NOT NULL
   AND NEW.id = OLD.id
   AND NEW."companyId" = OLD."companyId"
   AND NEW."operationId" = OLD."operationId"
   AND NEW."commandType" = OLD."commandType"
   AND NEW."actorUserId" = OLD."actorUserId"
   AND NEW."requestHash" = OLD."requestHash"
   AND NEW."requestHashKeyVersion" = OLD."requestHashKeyVersion"
   AND NEW."requestHashFormatVersion" = OLD."requestHashFormatVersion"
THEN
  RETURN NEW;
END IF;

PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
```

#### Required service behavior

- Write `completedAt` with the safe result in the same transaction as the domain mutation.
- Replays must require the same Company, command type, request hash and `actorUserId`.
- A different actor receives `OPERATION_ID_REUSED`; they must not receive the original snapshot.
- A claimed but incomplete receipt returns `PROJECT_COMMAND_IN_PROGRESS` rather than overloading `OPERATION_ID_REUSED`.
- Safe snapshots contain stable IDs, status and version only. Exclude free text, file metadata, remarks and private reasons.

#### Required tests

- First command inserts and completes one receipt.
- Exact retry by the same actor returns the original safe result without a second mutation.
- Same operation ID with another request returns `OPERATION_ID_REUSED`.
- Same operation ID and request from another actor is rejected.
- A second result update and every delete are rejected by PostgreSQL.
- A failed domain command leaves no completed receipt and no partial business state.
- Two concurrent identical commands produce one mutation and one replay result.

### 5.2 PRJ-P0-02 — Require one Company context

#### Backend changes

Change `ProjectsFeatureGateService` and `ProjectsDomainScopeService` so every canonical Project operation resolves exactly one active Company.

- Global and Company Group actors without `activeCompanyId` fail closed with `PROJECTS_COMPANY_CONTEXT_REQUIRED`.
- The server never returns `{}` as a Project scope filter.
- The Company must be present in the server-side Project allowlist.
- Branch scope may include the active Branch plus explicitly Company-wide Projects only after Company resolution.
- A client query/body cannot override the active Company.
- Direct foreign Company/Branch/Project IDs return the same safe `404` as missing records.

Expected invariant:

```ts
const companyId = scope.activeCompanyId;
if (!companyId) {
  throw new DomainConflictException(
    PROJECTS_ERROR_CODES.PROJECTS_COMPANY_CONTEXT_REQUIRED,
    "Select a Company before using Projects.",
  );
}
```

Do not use an unrestricted fallback for a Global actor.

#### Tests

- Global actor without Company selection is denied.
- Company Group actor without Company selection is denied.
- Global actor with an allowlisted active Company sees only that Company.
- Global actor selecting a non-allowlisted Company is denied.
- Company and Branch actors cannot read another Company/Branch by direct ID.

### 5.3 PRJ-P0-03 — Remove legacy read-surface leaks

Authoritative routes are:

- `/projects/...`
- `/me/project-tasks`
- `/me/timesheets`
- `/team/timesheets`

Unregister the following legacy modules/controllers from the production application or make every route delegate to the same canonical scoped policy:

- `/project-stages`
- `/project-team-members`
- `/project-tasks`
- `/task-participants`
- `/task-submissions`
- `/task-reviews`
- `/work-log-header`
- `/work-log-line`
- legacy Project `TaskParticipant` duplicates

Recommended implementation:

1. Search all imports and callers.
2. Move any required internal read behind canonical query services.
3. Remove legacy modules from `AppModule`.
4. Delete obsolete controllers/services after confirming no internal consumer.
5. Do not leave unscoped read-only routes live merely because writes are disabled.

If temporary compatibility is unavoidable, return `410 PROJECTS_LEGACY_ROUTE_DISABLED` for both reads and writes. Do not expose raw Prisma entities.

#### Tests

- Every legacy route returns 404/410 without data.
- Canonical same-Company reads succeed.
- Cross-Company and cross-Branch canonical reads return safe 404.
- Route enumeration confirms no duplicate Task participant/submission implementation is registered.

### 5.4 PRJ-P0-04 — Restore compile and lint gates

The legacy services currently call Prisma create methods without required Company/Project/Branch snapshots.

Fix by removing obsolete write paths or deriving snapshots server-side from the locked parent aggregate. Never add client-controlled `companyId` merely to satisfy TypeScript.

Known Project compile areas:

- `project-stages.service.ts`
- `project-tasks.service.ts`
- `project-tasks/services/task-participant.service.ts`
- `project-team-members.service.ts`
- `task-submissions.service.ts`
- `work-log-header.service.ts`
- `work-log-line.service.ts`
- `projects/migration/project-lite-backfill.service.ts`

Remove Project core paths from ESLint ignore rules. The following must be linted normally:

- `src/modules/project-tasks/**`
- `src/modules/task-work-session/**`
- `src/modules/work-log-header/**`
- `src/modules/work-log-line/**`

Exit gate:

- Prisma validation passes.
- Backend TypeScript passes with no Project or unrelated errors.
- Backend lint passes with zero errors.
- Frontend TypeScript and lint pass with zero errors.
- Backend and frontend production builds pass from a clean checkout.

### 5.5 PRJ-P0-05/06 — Complete the executable UI flow

#### Project creation/edit

Add a server-capability-driven create/edit form with:

- Project name and type;
- Branch when permitted;
- Project Manager candidate lookup;
- start and optional end date;
- Client Business Party for Client Projects only;
- currency/expected income/expense budget when the shared Finance profile is enabled;
- description.

Until Business Party is available, the server and UI must permit only `INTERNAL`; Client must be disabled with an explicit blocked reason.

Add an `EDIT` action to the Project response and render it only from `allowedActions`. Activation preflight must return exact blockers rather than allowing a predictable 409 after submission.

#### Project Manager Task actions

Wire the existing APIs into Project detail:

- candidate lookup;
- assign;
- reassign with mandatory reason;
- unassign while allowed;
- return submitted work with mandatory reason;
- complete submitted work;
- cancel with mandatory reason;
- view submission/review history;
- attach/download secure documents.

The UI must never infer these actions from role names or status. It renders the exact server `allowedActions` and action requirements.

#### Required UI tests

- Internal Project create → edit → activate.
- Client type is blocked while Business Party capability is disabled.
- PM assigns an eligible Team member.
- Another PM cannot assign or review that Project.
- Employee starts and submits.
- PM returns; Employee resubmits; PM completes.
- Version conflict preserves user input and refetches authoritative state.

---

## 6. P1 database remediation

### 6.1 Make preflight genuinely fail closed

Change these to blocking findings:

- unknown participant status;
- unknown Project/Stage/Task/Team/Timesheet status;
- unknown submission/review state;
- Client Project without an approved Business Party mapping;
- Internal Project with a Business Party;
- duplicate weekly header `(companyId, employeeId, periodStart)`;
- duplicate active Team membership;
- duplicate active Task participant;
- cross-Company Branch, Project Manager, Stage, Team, Task, submission, review, document or Work Log reference;
- Task whose Stage belongs to a different Project;
- Work Log date outside its header period;
- Work Log line with neither or both Task and Work Category;
- approved/terminal history missing actor or timestamp;
- legacy local `TaskSubmission.filePath` without a completed secure-file import decision.

Return both:

- exact `count` from `COUNT(*)`;
- a bounded `sampleIds` list.

Do not derive the total count from a truncated ID array.

The preflight CLI exits nonzero when any blocking finding exists. Reconcile must be idempotent and preflight must be rerun after reconciliation.

### 6.2 Add Company-qualified aggregate constraints

Add supporting unique keys and composite foreign keys in matching field order. Required relationships include:

- Project → Branch `(companyId, branchId)`;
- Project → Project Manager `(companyId, projectManagerId)`;
- Project Stage → Project `(companyId, projectId)`;
- Project Team Member → Project and Employee using Company-qualified keys;
- Project Task → Project and Stage using `(companyId, projectId, stageId)` so Stage belongs to the same Project;
- parent Task → same Company and Project;
- Task Participant → Task and Employee using Company-qualified keys;
- Task Submission → Task using Company, Project and Task;
- Task Review → Submission/Task/Reviewer using Company-qualified keys;
- Project Document → Project, optional Task, optional Submission and File Object using Company-qualified keys;
- Work Log Header → Branch and Employee using Company-qualified keys;
- Work Log Line → Header using `(companyId, branchId, employeeId, workLogHeaderId)`;
- Work Log Line → Task or Work Category using Company-qualified keys.

Use `onDelete: Restrict` and `onUpdate: Restrict` for Project history, organization, Employee, Task, File Object and actor evidence.

Add an exact-one-target constraint for Project Documents when the contract requires a Project-level, Task-level or Submission-level target.

### 6.3 Make weekly hours concurrency-safe

Inside every line create/update/remove transaction:

1. Lock the Work Log Header.
2. Verify it remains editable.
3. Lock the Employee/day aggregate using a transaction-scoped PostgreSQL advisory lock or a dedicated daily aggregate row.
4. Recalculate the total for `(companyId, employeeId, workDate)`.
5. Reject totals greater than 24 with `TIMESHEET_DAILY_HOURS_EXCEEDED`.
6. Recalculate the header total.
7. Write evidence/audit/outbox in the same transaction.

The database trigger remains a direct-SQL backstop and must obtain the same deterministic lock before calculating the sum.

Add checks:

- `0 < hours <= 24`;
- exactly one of `taskId` and `workCategoryId`;
- `periodStart <= workDate <= periodEnd` through trigger/service because it crosses tables;
- line Company/Branch/Employee equals the parent header snapshots.

### 6.4 Make approved history immutable

After a Work Log Header reaches `SUBMITTED`, ordinary line mutation is blocked. A returned header becomes editable only through the explicit return transition.

After `APPROVED` or `CANCELLED`:

- Header and lines cannot be updated or deleted.
- Actor/timestamp/manager snapshots cannot be cleared.
- Corrections require a separate audited correction/reversal workflow; do not rewrite approved history.

### 6.5 Complete typed submission/review persistence

- Backfill `TaskSubmission.statusV2` and `TaskReview.decisionV2` deterministically.
- Stop on unknown legacy values.
- Make Company, Project, Task and typed status/decision non-null after reconciliation.
- Add unique submission version per Task and unique review round/decision rules.
- Keep `filePath` historical and non-downloadable; new evidence uses `ProjectDocument` + `FileObject` only.

---

## 7. P1 backend/API remediation

### 7.1 Enforce Project lifecycle inside every command

`allowedActions` is presentation metadata, not authorization. Every command must lock and revalidate the Project.

#### Activation

Require:

- `DRAFT` state and expected Project version;
- active same-Company Project Manager with an active User;
- start date;
- at least one non-cancelled Stage;
- Client has an active same-Company `CUSTOMER`/`BOTH` Business Party;
- Internal has no Business Party;
- configured currency when commercial amounts exist.

#### Completion

Require:

- Project is `ACTIVE` or the explicitly locked allowed predecessor;
- no Task remains `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `WAITING_REVIEW` or `RETURNED`;
- every non-cancelled Stage is completed;
- no pending review/submission action;
- lifecycle actor/time/evidence written atomically.

#### Archive

- Only terminal or history-free Draft Projects may archive under the locked rule.
- Archive never hard-deletes Project history.

#### Child commands

Stage, Team, Task, submission, attachment and timesheet commands must reject invalid Project states. No Task can be assigned or started after Project hold/completion/cancellation/archive.

### 7.2 Enforce record-level Project Manager authority

Company permission alone is insufficient.

- Stage/Team/Task management requires the actor to be the current Project Manager, unless an explicit audited administrator override permission is introduced.
- An Organization Owner is not automatically the manager of every Project.
- Start/submit requires the current active Task participant User.
- Return/complete requires the current Project Manager User.
- Attachment link requires active participation for Employee work evidence or Project Manager authority for Project management evidence.
- Recheck authority inside the transaction after locking Project, Team and Task.

Unassign rules:

- allowed only before work starts;
- `IN_PROGRESS` or returned work must be reassigned directly with a reason;
- submitted/completed/cancelled Tasks cannot be unassigned;
- the final active participant cannot be removed while the Task state requires an assignee.

### 7.3 Implement immutable submission/review rounds

`POST /projects/:projectId/tasks/:taskId/submit-review` must:

1. lock Project, Task and active participant;
2. verify actor and Project/Task state;
3. allocate the next `versionNo` safely;
4. create `TaskSubmission` with Company/Project/Task/Employee/User snapshots;
5. link only `CLEAN` File Objects belonging to the same Company/upload session;
6. move Task to `WAITING_REVIEW`;
7. create action evidence, audit and outbox in one transaction.

Return must create a `TaskReview(RETURNED)` for the current submission. Resubmission creates a new immutable submission version. Complete creates `TaskReview(APPROVED)` and completes the Task. Previous submissions and reviews remain immutable.

Expose typed submission/review history on Task detail. Do not expose legacy local paths.

### 7.4 Harden idempotency and concurrency

Replace plain SHA-256/`JSON.stringify` with:

- a command-specific canonical request object after DTO transforms;
- stable sorted-key canonical JSON;
- normalized UUID, date, decimal and string formats;
- explicit hash-format version;
- HMAC-SHA-256 with an active Project command key version;
- retained verification keys for all existing receipts.

At application startup, fail Project V2 closed if the active HMAC key/version is unavailable.

Use serializable transactions with bounded retry for serialization/deadlock errors on multi-aggregate commands. Define one lock order:

1. command receipt/advisory operation lock;
2. feature/permission rows when required;
3. Employee and reporting manager;
4. Project;
5. Stage/Team/Task;
6. submission/review or Work Log Header;
7. Work Log Lines/File Objects;
8. evidence, audit and outbox.

### 7.5 Complete Client Project and Finance dependency

Office Finance owns the shared models:

- `BusinessParty`;
- `CompanyFinancialProfile`.

After those models exist:

- add the Company-qualified Project → Business Party FK;
- require active `CUSTOMER` or `BOTH` type for Client Projects;
- derive default currency from Company Financial Profile;
- validate any override against configured currencies;
- query approved, non-reversed Project-linked Office Finance income/expense for Finance Summary.

Finance Summary labels must remain:

- approved cash income;
- approved cash expense;
- operational net.

Do not label it profit, margin, receivable, payable or accounting balance.

Before Finance foundation is enabled, return `enabled:false` and block Client Project activation. Internal Project execution can proceed after all other Project gates pass.

### 7.6 Correct Timesheet eligibility

- Derive Employee from authenticated User for self-service.
- Work date must fall inside the weekly header period.
- Task line requires active Project Team and Task participation effective on the work date, not merely current `ACTIVE` state.
- Work Category line requires an active same-Company category.
- Use Company week configuration and Branch timezone; do not hard-code UTC Monday–Sunday unless that is the configured calendar.
- Submission snapshots an active same-Company reporting manager Employee and User.
- Manager approval revalidates the snapshotted User, Company scope and no self-approval.
- A manager change after submission does not silently transfer the approval; use an explicit audited re-route command if required.

### 7.7 Complete notification safety and reminders

Recipient resolution must be server-side and Company/Branch-safe:

- Project Manager notifications resolve the current active manager User inside the Project Company.
- Task notifications resolve active assigned participants.
- Timesheet notifications use the snapshotted reporting-manager User.
- Administrative exception recipients use exact RoleAssignment scope.
- Delivery handlers must revalidate recipient Company/Branch rather than trusting payload User IDs.

Add due-soon and overdue reminder production using Branch business dates, deterministic cursors and recipient-specific dedupe keys.

Safe notification payloads contain IDs, state and dates only. Private notes, document names, commercial values and reasons stay out of outbox payloads.

---

## 8. P1 frontend/UI remediation

### 8.1 Add server workspace capabilities

Add a collection/module capability response, for example:

`GET /projects/workspace-capabilities`

It should return:

```ts
interface ProjectWorkspaceCapabilities {
  enabled: boolean;
  companyId: string;
  allowedActions: Array<
    | "CREATE_PROJECT"
    | "CREATE_TIMESHEET"
    | "VIEW_TEAM_TIMESHEETS"
  >;
  clientProjectsEnabled: boolean;
  financeSummaryEnabled: boolean;
  blockedReasons: string[];
}
```

Use it to control navigation and collection-level buttons. Resource actions continue to come from each Project/Task/Timesheet response.

### 8.2 Complete Project detail tabs

- **Overview:** edit Project, activation preflight, lifecycle actions and blocked reasons.
- **Stages:** add/edit/activate/complete/cancel using server actions.
- **Team:** candidate picker, add/update/end member with effective dates.
- **Tasks:** candidate picker, assign/reassign/unassign and submission/review actions.
- **Time:** approved time summary and scoped Timesheet drill-down.
- **Finance Summary:** correct disabled state or approved operational cash summary.
- **Documents:** list, upload, short-lived download grant and safe error states.

### 8.3 Correct Timesheet UI

- Replace raw Task ID entry with an eligible Task lookup.
- Add an active Work Category lookup.
- Require exactly one target in the form before enabling Add.
- Add Timesheet detail route.
- Support header edit, line edit/remove, submit and cancel from server actions.
- Returned Timesheets must be correctable and resubmittable.
- Manager approval detail must show every line, date, Project/Task/Category, hours and safe remarks before approval.
- Preserve reason/input on 409 and refetch authoritative versions.

### 8.4 Correct summaries and display projections

- “Active Projects” must count distinct active Projects, not open Tasks.
- Project/Task/Timesheet responses should include safe Employee code/name/designation projections, not only UUIDs.
- Include typed `blockedReasons` and `actionRequirements`.
- Use server progress/totals rather than recalculating authorization or completion locally.
- Format dates using Branch timezone and locale.
- Add paging/filter/sort controls matching API allowlists.

### 8.5 Complete error behavior

- `400/422`: keep form open and map field violations.
- `401`: use existing session-expiry handling.
- `403`: refetch capabilities and hide revoked action.
- `404`: show safe not-found without revealing foreign Project/Employee data.
- `409 PROJECT_STATE_CHANGED`/`TASK_STATE_CHANGED`: preserve input, refetch and request review.
- Network/5xx: preserve input and provide retry without optimistic success.
- No Project, assignment, Task or Timesheet transition is optimistic.

---

## 9. P2 remediation

### API/query contract

- Replace free status strings with DTO enums.
- Validate `page >= 1`, bounded `limit`, exact `sortBy` allowlists and `ASC|DESC` sort order.
- Return `{items,total,page,limit}` consistently.
- Remove fixed 100-row personal Task behavior.
- Translate named DB constraints/triggers to stable Project error codes.

### Migration verification

Catalog verification must check definitions, not only names:

- `pg_get_constraintdef` for every FK/check;
- `pg_get_indexdef` including columns and partial predicate;
- trigger table/event/enabled state/function;
- column type, nullability and defaults;
- enum labels;
- supporting unique keys;
- no invalid/unvalidated constraints.

Add the File Upload Session indexes to Prisma schema so schema and migration definitions remain aligned.

### UI usability

- Add paging and filters to Project and personal Task lists.
- Render Employee names/codes instead of UUIDs.
- Add loading, empty, denied, error and retry states for every tab.
- Keep reason dialogs open until the command succeeds.
- Meet keyboard, focus, responsive and screen-reader requirements.

---

## 10. Required test and evidence plan

### 10.1 Backend unit/service tests

- Company-context and allowlist resolution.
- Project lifecycle preconditions and `allowedActions`.
- Project Manager versus Organization Owner authority.
- Team effective-date eligibility.
- Task assignment/unassignment/reassignment state matrix.
- Submission/review rounds and File Object rules.
- Timesheet target XOR, work-date and manager resolution.
- Receipt canonicalization, HMAC rotation, actor-bound replay and safe snapshot mapping.
- Notification recipient scope, redaction and dedupe.
- Client Project/Finance provider enabled and disabled behavior.

### 10.2 Real PostgreSQL migration tests

Run on disposable PostgreSQL, not mocked Prisma clients:

1. From-zero migration through the complete repository migration chain.
2. Upgrade from production-like Project legacy fixtures.
3. Run preflight before reconciliation and assert expected blocking findings.
4. Run reconciliation twice and prove idempotency.
5. Run contract and corrective migrations.
6. Rerun preflight and require zero blocking findings.
7. Verify exact catalog definitions.
8. Verify receipt claim → completion is allowed once and later mutation is rejected.
9. Backup the upgraded database and restore it into a separate disposable database.
10. Run integrity and smoke tests against the restored copy.

### 10.3 Real PostgreSQL concurrency tests

- concurrent identical Project create operation IDs;
- same operation ID with different request/actor;
- Project activation versus Stage/manager edit;
- Project completion versus Task creation/start;
- Team member end versus Task assignment;
- concurrent Task assign/reassign/unassign;
- Task resubmission versus Project Manager review;
- Task parent-cycle race;
- concurrent Work Log line inserts crossing 24 hours;
- Timesheet submit versus line update;
- Timesheet approve versus return/cancel;
- File link versus scan/quarantine state change.

Every test must assert final database rows, audit/action evidence, receipt and outbox state—not only HTTP status.

### 10.4 API persona tests

1. Organization Owner/Project administrator.
2. Project Manager for Project A.
3. Project Manager for Project B.
4. Assigned Project Employee.
5. Reporting manager approving a Timesheet.
6. Employee not on the Project.
7. User from another Branch.
8. User from another Company.
9. Global/Group actor without Company selection.
10. Secure-document uploader/downloader.

Required proof includes direct foreign IDs, stale versions, repeated operation IDs, permission revocation and safe 403/404 behavior.

### 10.5 Frontend unit/component tests

- Collection and resource controls render only server actions.
- Project create/edit activation blockers.
- PM Task assignment/review controls.
- Employee Task start/submit controls.
- Timesheet XOR form and eligible lookup behavior.
- Returned Timesheet correction.
- Manager line-level approval view.
- 400/403/404/409/422/5xx input preservation.
- Project count uses distinct Project IDs.
- secure upload/download and scan states.

### 10.6 Real Playwright personas

Run against the production-candidate API with mock mode disabled:

1. Administrator creates and activates an Internal Project.
2. PM adds Stage, Team member and Task.
3. PM assigns the Task.
4. Assigned Employee starts and submits evidence.
5. PM returns the first submission.
6. Employee resubmits.
7. PM approves/completes the Task and Stage.
8. Employee creates and submits a weekly Timesheet.
9. Reporting manager inspects lines and approves.
10. Project Time Summary reflects approved time only.
11. Other Project Manager, Branch and Company personas are denied.
12. Secure document upload, scan, link and authorized download complete.
13. Notification deep links resolve only for authorized recipients.
14. Project completes only after every blocking child is terminal.

Client Project and Finance Summary personas run only after Office Finance foundation is enabled.

---

## 11. Execution sequence and exit gates

### Gate 0 — Containment

- Keep `PROJECTS_LITE_ENABLED=false`.
- Ensure no Company/Branch allowlist enables Project Lite.
- Record current migration status read-only.

### Gate 1 — P0 database/runtime correction

- Add corrective receipt migration/schema/service behavior.
- Close global Company-context leak.
- unregister/delegate legacy routes.
- restore backend compile and lint.

**Exit:** receipt real-DB test passes; cross-tenant route tests pass; backend build passes.

### Gate 2 — P1 database integrity

- Harden preflight/reconcile.
- add composite FKs/checks/triggers/indexes.
- make timesheet concurrency and history safe.
- complete submission/review typed persistence.

**Exit:** from-zero and production-like upgrade rehearsal, catalog verification and PostgreSQL concurrency tests pass.

### Gate 3 — Backend domain completion

- lifecycle/authority rules;
- submission/review rounds;
- HMAC receipts;
- effective-date Timesheets;
- notification recipient safety/reminders;
- explicit Office Finance disabled seam.

**Exit:** API persona and concurrency suites pass with final DB/audit/outbox assertions.

### Gate 4 — Frontend completion

- Project create/edit/activate;
- PM Stage/Team/Task work;
- Employee Task execution;
- complete Timesheet and document journeys;
- capability/`allowedActions` discipline;
- error/accessibility behavior.

**Exit:** frontend types, lint, tests and build pass; real Playwright personas pass without mock mode.

### Gate 5 — Controlled database deployment

- Confirm prerequisite storage/delivery migrations and Project migration ordering.
- Take required operational backup unless the database owner explicitly accepts another recovery method.
- Apply to UAT first.
- Run post-migration preflight/catalog/API/browser checks.
- Obtain technical and business sign-off on one recorded commit.

**Exit:** explicit approval before shared development/UAT/production apply and before enabling any Company.

---

## 12. Production acceptance criteria

Project Lite may be enabled only when all statements are true:

- No global, cross-Company or cross-Branch Project data leakage exists.
- Every legacy Project route is removed, disabled or canonically scoped.
- Every Project mutation completes with an immutable, actor-bound receipt.
- Backend/frontend type-check, lint, unit tests and builds pass.
- All Project migrations are applied in order in the target environment with no pending Project migration.
- From-zero and production-like upgrade rehearsals pass on real PostgreSQL.
- Daily hours cannot exceed 24 under concurrent writes.
- Approved Timesheet history cannot be rewritten.
- Project lifecycle cannot complete with open Tasks/Stages.
- Only the actual Project Manager can assign/review Project work.
- Only the assigned Employee can execute their Task.
- Submission/review rounds are immutable and securely linked to clean File Objects.
- Timesheet approval is limited to the snapshotted eligible reporting manager.
- Notifications resolve Company/Branch-safe recipients and retry/dedupe/dead-letter behavior is monitored.
- Internal Project real-browser personas pass.
- Client Project is either fully integrated with Business Party/Finance and accepted, or explicitly disabled.
- Backup/restore, monitoring, technical UAT and business sign-off are recorded for the release commit.

---

## 13. Recommended commit grouping

1. `fix(projects): close P0 receipt and tenant-scope failures`
2. `refactor(projects): retire legacy project read surfaces and restore build gates`
3. `fix(projects-db): enforce aggregate and timesheet integrity`
4. `feat(projects): complete lifecycle authority and submission review rounds`
5. `feat(projects): harden receipts notifications and timesheets`
6. `feat(projects-ui): complete project manager employee and timesheet journeys`
7. `test(projects): add postgres api and browser acceptance evidence`
8. `docs(projects): record migration rehearsal and release sign-off`

Do not mix Office Finance foundation schema into a Project-only migration. Office Finance owns `BusinessParty` and `CompanyFinancialProfile`; Project consumes their published contract in a later dependency-ordered migration.
