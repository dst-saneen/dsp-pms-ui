# ERP Lite and Menu Manual Testing and Bug-Fix Guide

**Document status:** Ready for manual execution; every case starts as `Not Run`  
**Test type:** Real browser, real API, real PostgreSQL, and real configured providers  
**Application:** HRMS/ERP initial release  
**Reference commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Prepared:** 1 September 2026  
**Local frontend:** `http://localhost:3200`  
**Local backend:** `http://localhost:4500`

---

## 1. Purpose and evidence rules

This guide manually verifies the initial-release Project, Office Finance,
Payroll, Onboarding, Recruitment, Leave, and navigation changes. It is not an
automated-test guide and contains no automated-test commands.

Coverage includes:

- Project Lite;
- Office Finance Lite and Expenses;
- Payroll Lite and Payslips;
- Onboarding;
- Recruitment and Leave navigation permissions;
- menu highlighting and direct-route gating;
- Company and Branch context switching;
- negative authorization and manual concurrency checks;
- defect diagnosis, correction, and retesting.

Evidence rules:

1. Every case begins as `Not Run`.
2. A passing build, unit test, mocked browser test, or previous database record
   is not manual-UAT evidence.
3. Run the browser against the real backend and approved non-production
   database.
4. Keep Recruitment mock mode disabled.
5. Do not substitute mock S3, mock ClamAV, or a mocked Payslip worker for a real
   provider-backed test.
6. Record `Blocked` when a required credential, provider, persona, or approved
   data mutation is unavailable.
7. Never record credentials, access keys, encryption keys, HMAC keys, session
   tokens, salary values, bank references, or personal data in this document.
8. Browser evidence must show that unauthorized records are absent from network
   responses, not merely hidden in the page.

---

## 2. Approved test scope and known records

Use Learn Fresh Company as the allowed pilot scope:

```env
TEST_COMPANY_ID=e4c645f1-2359-439c-ac68-41785cf11e82
TEST_BRANCH_ID=5c79da96-64e5-4027-83fc-4c1de736b10c
TEST_COMPANY_NAME=Learn Fresh Company 01
TEST_BRANCH_NAME=Learn Fresh HQ 01

OUT_OF_SCOPE_COMPANY_ID=eadf7f5f-1669-4e90-9f32-0a1040e7cebf
OUT_OF_SCOPE_BRANCH_ID=d9b23f66-34d4-472e-a397-48a406787a99
OUT_OF_SCOPE_COMPANY_NAME=Datascape Technology Kowdiar
OUT_OF_SCOPE_BRANCH_NAME=Kowdiar
```

Existing safe record identifiers:

```env
TEST_PROJECT_ID=60854dea-fada-4373-a541-5efb8cef63b0
TEST_PROJECT_CODE=PRJ-000001

TEST_PAYROLL_RUN_ID=32dad0d6-f410-4a2e-b26b-5d8e711eadf9
TEST_PAYROLL_RUN_NUMBER=PR-000004

TEST_FINANCE_TRANSACTION_ID=f5d33da3-18f2-491d-852a-0402a709d3ea
```

Read-only preparation checks found the following data in the allowed Company:

- one Draft Project;
- two active Salary Components;
- three active Employee Salary revisions;
- five active Employees in Learn Fresh HQ;
- one August 2026 Attendance Period in `PAYROLL_PENDING`;
- Payroll run `PR-000004` in `APPROVED`, version `2`;
- one Company Financial Profile;
- nine active Finance Payment Accounts;
- one open Finance Period;
- no existing File Objects.

These observations help prepare the test. They do not prove that any manual
flow passed.

### 2.1 Data-mutation boundary

- Read-only page and access checks may use the existing identifiers above.
- Creating Projects, Timesheets, Expenses, Payroll Runs, Payslips, reversals,
  files, or notifications changes shared UAT data and requires the approved UAT
  execution window.
- `PR-000004` may be opened for read-only detail verification.
- Do not mark `PR-000004` paid until the business owner explicitly approves the
  resulting Finance Expense, Payslip, File Object, outbox, and notification
  changes.
- Do not create another active August 2026 Payroll Run. A complete new Payroll
  lifecycle requires a fresh prepared UAT period.

---

## 3. Environment configuration

Environment files are local/deployment configuration only. Do not commit actual
secret values.

### 3.1 Backend feature configuration

```env
RECRUITMENT_ENABLED=true
PUBLIC_CAREERS_ENABLED=true

ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
ONBOARDING_V2_BRANCH_IDS=
ONBOARDING_REMINDERS_ENABLED=false
ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION=v1
ONBOARDING_IDEMPOTENCY_ACCEPTED_KEY_VERSIONS=v1

PROJECTS_LITE_ENABLED=true
PROJECTS_LITE_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
PROJECTS_REMINDERS_ENABLED=false
PROJECTS_IDEMPOTENCY_HMAC_ACTIVE_VERSION=v1
PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON=<existing-approved-v1-secret>

OFFICE_FINANCE_LITE_ENABLED=true
OFFICE_FINANCE_LITE_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION=v1
FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON=<existing-approved-v1-secret>
FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION=v1
FINANCE_BANK_REFERENCE_ENC_KEYS_JSON=<existing-approved-v1-secret>

PAYROLL_LITE_ENABLED=true
PAYROLL_LITE_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION=v1
PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON=<existing-approved-v1-secret>
WORKFORCE_JOBS_ENABLED=true
```

The allowlists are intentionally explicit and fail closed. Never enable a Lite
module with a blank Company allowlist.

### 3.2 Existing-key safeguard

The database already contains versioned command and encryption evidence:

- one Project command receipt using `v1`;
- 45 Finance command receipts using `v1`;
- 12 Payroll command receipts using `v1`;
- five encrypted Finance bank-reference rows using `v1`.

Do not generate replacement values and label them `v1`. Retrieve the original
values from the approved secret store. Replacing them can make receipt replay
or encrypted data unreadable. If the original keys are unavailable, keep the
affected feature disabled and record the positive test as `Blocked`.

### 3.3 File Storage, Payslip, and Project-document configuration

```env
FILE_STORAGE_V2_ENABLED=true
FILE_STORAGE_SCOPE_ALLOWLIST_JSON=[{"companyId":"e4c645f1-2359-439c-ac68-41785cf11e82","branchIds":["5c79da96-64e5-4027-83fc-4c1de736b10c"]}]

FILE_NAME_ENC_ACTIVE_KEY_VERSION=v1
FILE_NAME_ENC_ACCEPTED_KEY_VERSIONS=v1
FILE_NAME_ENC_KEYS_JSON=<approved-stable-v1-secret>

STORAGE_S3_REGION=ap-south-1
STORAGE_S3_BUCKET=<approved-private-test-bucket>
STORAGE_S3_ACCESS_KEY_ID=<approved-access-key>
STORAGE_S3_SECRET_ACCESS_KEY=<approved-secret>
STORAGE_S3_ENDPOINT=
STORAGE_S3_FORCE_PATH_STYLE=false
STORAGE_PRESIGNED_PUT_TTL_SECONDS=900
STORAGE_PRESIGNED_GET_TTL_SECONDS=300

FILE_SCAN_WORKER_ENABLED=true
CLAMAV_HOST=<approved-clamav-host>
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=30000
CLAMAV_MAX_STREAM_BYTES=26214400
```

The current database has no File Objects. Once the first file is created, the
filename-encryption key becomes durable operational state and must be retained
securely.

If S3 or ClamAV is unavailable:

- mark Project document upload/download cases `Blocked`;
- mark Payroll Payslip generation/download cases `Blocked`;
- do not claim provider-backed file acceptance using local or mocked storage.

### 3.4 Frontend configuration

```env
BACKEND_INTERNAL_URL=http://localhost:4500
# Recruitment availability is returned by backend capability APIs.
NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false
```

Restart the backend after backend environment changes. Restart the frontend
after changing a `NEXT_PUBLIC_*` value. Sign out and sign back in after role or
permission changes so the authorization snapshot is refreshed.

### 3.5 Disabled-state profile

Use this profile for the fail-closed menu and direct-route cases:

```env
ONBOARDING_V2_ENABLED=false
PROJECTS_LITE_ENABLED=false
OFFICE_FINANCE_LITE_ENABLED=false
PAYROLL_LITE_ENABLED=false
WORKFORCE_JOBS_ENABLED=false
FILE_STORAGE_V2_ENABLED=false
FILE_SCAN_WORKER_ENABLED=false
```

Restore the approved enabled profile and restart before running positive
lifecycle cases.

---

## 4. Manual personas

Use distinct approved UAT accounts. Do not use a real production Employee or
share one browser session between personas.

1. Company Administrator / Project Administrator.
2. Project Manager.
3. Assigned Project Employee.
4. Reporting Manager / Timesheet Approver.
5. HR Manager / Payroll Maker.
6. Finance Manager / Payroll Approver and Payment Operator.
7. Employee viewing only their own Payslip.
8. Recruitment Delivery Viewer with `hr.recruitment.delivery.read` but without
   `hr.recruitment.read`.
9. Leave Calendar Viewer with `hr.calendar.read` but without general Leave
   permissions.
10. Holiday Viewer with `hr.holidays.read`.
11. Comp-off Viewer with `hr.comp-off.read`.
12. Unauthorized Employee without HR, Project administration, Finance, or
    Payroll administration permission.
13. User from another Company or Branch.

Payroll maker-checker is mandatory:

- HR Manager creates, adjusts, and calculates Payroll.
- Finance Manager independently approves and marks it paid.
- The maker must not approve or pay their own run.

For concurrency cases, open normal and incognito browser sessions or use two
separate browser profiles. Confirm the sessions belong to the intended
personas before performing either action.

---

## 5. Result and evidence format

Copy this block under each executed case:

```text
Status: Not Run | Pass | Fail | Blocked
Tester:
Execution date/time:
Commit:
Persona:
Permission/role summary:
Active Company:
Active Branch:
Environment profile:
Route/entity:
Expected result:
Actual result:
Browser console:
Relevant Network request/status/error code:
Screenshot or recording:
Audit/outbox/file evidence, when applicable:
Defect ID:
Retest result:
```

Do not put access tokens, passwords, salaries, bank references, private file
links, or secret configuration in the evidence.

---

## 6. Common capability and context checks

### CAP-01 — Allowed Company capability response

**Status:** `Not Run`

1. Sign in with an authorized Company-scoped persona.
2. Select Learn Fresh Company / Learn Fresh HQ.
3. Open browser Developer Tools and select Network.
4. Reload the page.
5. Inspect `GET /me/module-capabilities`.

Expected:

- capability values match enabled modules and the actor's permissions;
- `projectsLite` is true when Project Lite is enabled for the Company;
- `officeFinanceLite` is true when Finance is enabled for the Company;
- `payrollDependencyState` explains every unmet dependency;
- navigation-specific fields remain false when the actor lacks permission;
- no data from another Company is present.

### CAP-02 — Context switch clears scoped capability state

**Status:** `Not Run`

1. Begin in Learn Fresh Company and record visible gated menus.
2. Switch to Datascape Technology Kowdiar using the organization switcher.
3. Do not manually refresh yet.
4. Confirm the active Company/Branch label changes.
5. Observe the sidebar.
6. Inspect the new `GET /me/module-capabilities` response.
7. Open the prior allowed Company's direct URLs.

Expected:

- the client clears scoped queries during context switching;
- enabled-only menus disappear immediately;
- capability fields are false for the out-of-scope Company;
- direct URLs display a controlled blocked/denied state;
- no previously cached Learn Fresh record remains visible.

### CAP-03 — Global or Company Group context requires Company selection

**Status:** `Not Run`

1. Sign in as an Organization Owner or Group actor.
2. Select a scope without an active Company, when available.
3. attempt to open Project, Finance, Payroll, and Onboarding routes.

Expected:

- no module performs an unrestricted Company-wide query;
- the UI requests Company selection or shows a controlled unavailable state;
- no tenant records appear.

---

## 7. Project Lite manual UAT

### PRJ-01 — Disabled feature and direct-route gating

**Status:** `Not Run`

1. Apply the disabled-state profile and restart the backend.
2. Sign in as Company Administrator, Project Manager, and Employee in turn.
3. Confirm Project Management is absent.
4. Confirm My Projects and My Timesheets are absent.
5. Open each route directly:
   - `/projects/projects`;
   - `/projects/projects/60854dea-fada-4373-a541-5efb8cef63b0`;
   - `/my-workspace/projects`;
   - `/my-workspace/timesheets`;
   - `/team/timesheets`;
   - `/projects/resources`.

Expected:

- every executable Project route fails closed;
- the deferred Resources URL redirects to the gated Project list and does not
  bypass the feature gate;
- no Project API data appears before the blocked state;
- no raw 500 response or endless loading state occurs.

### PRJ-02 — Enabled capability and role-specific navigation

**Status:** `Not Run`

1. Apply the approved Project configuration and restart the backend.
2. Sign in as Company Administrator.
3. Confirm Projects is visible under Project Management.
4. Sign in as Project Manager and repeat.
5. Sign in as Employee.
6. Confirm My Projects and My Timesheets follow the Employee's Project
   permissions.
7. Sign in as Timesheet Approver and confirm Team Timesheets is visible.
8. Check `GET /me/module-capabilities` for each persona.

Expected:

- `projectsLite` reflects Company enablement;
- `projectsNav` requires at least one relevant Project permission;
- each persona sees only its authorized Project surfaces;
- the out-of-scope Company remains denied.

### PRJ-03 — Draft Project creation and validation

**Status:** `Not Run`

1. As Company Administrator, open Project Management → Projects.
2. Create an Internal Project using a unique UAT name.
3. Select only Learn Fresh Branch and an active, user-linked Project Manager.
4. Save the Draft.
5. Edit dates and allowed commercial fields.
6. Attempt to select a Branch from another Company by direct request or stale
   browser value.
7. Attempt to assign an inactive, other-Company, or non-user-linked Manager.
8. Attempt to add a Business Party to the Internal Project.

Expected:

- the valid Draft is created once;
- server-generated ID, status, version, and `allowedActions` are authoritative;
- cross-Company Branch/Manager values are rejected safely;
- an Internal Project cannot retain a Business Party;
- field-level errors preserve the valid form values.

### PRJ-04 — Activation and record authority

**Status:** `Not Run`

1. Activate the valid Draft.
2. Record the resulting version and allowed actions.
3. As an unrelated administrator, open the Active Project.
4. Attempt Stage, Team, Task assignment, and review actions.
5. As the current Project Manager, repeat.

Expected:

- only server-returned actions render;
- unrelated administrators cannot manage Active Project children;
- the current Project Manager can manage authorized child work;
- direct calls by the unrelated administrator are rejected.

### PRJ-05 — Stage, Team, Task, and assignment lifecycle

**Status:** `Not Run`

1. As Project Manager, create and activate a Stage.
2. Add an active same-Company Employee to the Team.
3. Create a Task under the Stage.
4. Assign the Task to the active Team member.
5. Before work starts, unassign and reassign once.
6. Start the Task as the assigned Employee.
7. Confirm ordinary unassignment is no longer available.
8. Reassign in-progress work directly with a mandatory reason.
9. As a different Employee, attempt to start or submit the Task.

Expected:

- only eligible Team members can be assigned;
- pre-start unassignment works;
- in-progress work requires direct reassignment and evidence;
- only the current assignee can start or submit;
- version conflicts show a controlled refresh/retry state.

### PRJ-06 — Submission, return, resubmission, and completion

**Status:** `Not Run`

1. As the assigned Employee, submit work evidence.
2. As Project Manager, inspect immutable submission history.
3. Return the first submission with a reason.
4. As Employee, correct and resubmit.
5. As Project Manager, accept/complete the Task.
6. Complete the Stage.
7. Reopen a prerequisite while a dependent remains completed.

Expected:

- return requires a reason;
- prior submissions and reviews remain visible and immutable;
- resubmission creates new evidence instead of rewriting history;
- invalid dependency reopening is rejected;
- completion history records actors, timestamps, and final state.

### PRJ-07 — Project hold, resume, cancellation, and completion blockers

**Status:** `Not Run`

1. Create an unfinished Task or Stage.
2. Attempt Project completion.
3. Put the Project on hold with a reason.
4. Attempt a child mutation.
5. Resume the Project.
6. Complete or cancel every blocking child with required reasons.
7. Confirm no Task submission/review or submitted Timesheet remains pending.
8. Complete the Project.
9. Attempt another child mutation.

Expected:

- unfinished children block completion;
- held and terminal Projects reject child mutations;
- reasons are mandatory where specified;
- completion succeeds once and produces terminal evidence.

### PRJ-08 — Employee weekly Timesheet

**Status:** `Not Run`

1. As Employee, open My Workspace → Timesheets.
2. Create a weekly Timesheet.
3. Add Project/Task lines for eligible work dates.
4. Edit and remove Draft lines.
5. Attempt to exceed the daily-hours limit.
6. Submit the Timesheet.
7. Attempt to edit after submission.

Expected:

- the week boundary follows Company setting and Branch timezone;
- only effective-date eligible Project/Task work is selectable;
- daily-hours enforcement is consistent under refresh;
- submitted content is immutable until an authorized return.

### PRJ-09 — Timesheet return and approval

**Status:** `Not Run`

1. As the wrong Manager, open the submitted Timesheet ID directly.
2. Attempt approval.
3. As the submitting Employee, attempt self-approval.
4. As the correct snapshotted Reporting Manager, inspect every line.
5. Return once with a reason.
6. As Employee, correct and resubmit.
7. As Reporting Manager, approve.
8. Inspect Project Time Summary.

Expected:

- wrong-manager and self-approval attempts are denied;
- return reason and history are preserved;
- approved lines are immutable;
- Project Time Summary includes approved time only.

### PRJ-10 — Real Project document flow

**Status:** `Not Run`

1. Confirm File Storage and scan worker health.
2. Upload a permitted evidence file.
3. Observe Quarantined/Scanning status.
4. Attempt to link the file before it is CLEAN.
5. After a successful real scan, link it to the authorized Task submission.
6. Download through the short-lived authorized URL.
7. Attempt the same File Object ID as another Project Employee.
8. Attempt it as an out-of-scope Company user.
9. Inspect the browser URL and Network response.

Expected:

- non-CLEAN files cannot be linked;
- the link is bound to the authorized Task/submission;
- unauthorized direct IDs return safe denial/not-found behavior;
- the object remains private and no permanent public URL is exposed.

---

## 8. Office Finance Lite and Expense manual UAT

### FIN-01 — Disabled feature and direct-route gating

**Status:** `Not Run`

1. Disable Office Finance and Payroll, then restart.
2. Sign in as Finance Manager.
3. Confirm Office Finance is absent.
4. Open directly:
   - `/office-finance`;
   - `/office-finance/transactions`;
   - `/office-finance/reports`;
   - `/office-finance/setup`;
   - `/office-finance/transactions/f5d33da3-18f2-491d-852a-0402a709d3ea`.

Expected:

- every route displays the controlled module-disabled state;
- no Finance data request leaks through the blocked page;
- no raw 403/500 page or transient Finance data appears.

### FIN-02 — Setup readiness

**Status:** `Not Run`

1. Restore the approved Finance configuration and original `v1` secrets.
2. Sign in as Finance setup administrator.
3. Verify Company Financial Profile and base currency.
4. Verify an active Expense category.
5. Verify an active payment account and its opening date.
6. Verify an open Finance Period.

Expected:

- setup records are Company-scoped;
- sensitive bank-reference content is masked;
- only authorized setup actions render;
- `officeFinanceLite` and `officeFinanceNav` match scope and permission.

### FIN-03 — Expense Draft and complete edit UI

**Status:** `Not Run`

1. As Finance Maker, create an Expense Draft.
2. Edit category, source account, Department, Project, Party, Employee, date,
   amount, and description.
3. Save and refresh.
4. Enter a date before the selected account's opening date.
5. Select an incompatible Branch/Department/Project/Employee combination.

Expected:

- every supported Draft field persists;
- invalid opening date is rejected;
- incompatible organization combinations are rejected;
- Branch is derived by the server rather than trusted from the client.

### FIN-04 — Maker-checker return and approval

**Status:** `Not Run`

1. Submit the Expense as Finance Maker.
2. Attempt self-approval.
3. As independent approver, return with a reason.
4. Correct and resubmit as Maker.
5. Approve as independent approver.
6. Refresh Transactions and Reports.

Expected:

- self-approval is denied;
- return requires and preserves a reason;
- stale Draft edits after submission are rejected;
- the approved Expense appears exactly once in reports.

### FIN-05 — Reversal

**Status:** `Not Run`

1. Open the approved Expense as a user with reversal permission.
2. Reverse it with a mandatory reason.
3. Repeat the reversal request using the same operation ID.
4. Attempt another reversal using a different operation ID.
5. Inspect the original and reversal records.

Expected:

- the original approved row is immutable;
- exactly one linked reversal exists;
- idempotent replay returns the safe existing result;
- a conflicting second reversal is rejected.

### FIN-06 — Company/Branch and direct-ID denial

**Status:** `Not Run`

1. As an unauthorized Employee, open Finance routes and the known transaction
   ID.
2. As a user from the out-of-scope Company, repeat.
3. As Finance Manager, switch from the allowed Company to the out-of-scope
   Company without a manual reload.

Expected:

- `officeFinanceNav` is false without permission or enabled scope;
- direct IDs do not disclose existence or data;
- previously cached transaction content disappears after context switching.

---

## 9. Payroll Lite and Payslip manual UAT

### PAY-01 — Disabled state

**Status:** `Not Run`

1. Disable Payroll and restart.
2. Sign in as HR Manager, Finance Manager, and Employee in turn.
3. Confirm Payroll is absent from HR navigation.
4. Confirm My Payslips is absent or unavailable.
5. Open `/hr/payroll` and
   `/hr/payroll/runs/32dad0d6-f410-4a2e-b26b-5d8e711eadf9` directly.

Expected:

- Payroll APIs fail closed;
- the workspace explains unavailability;
- salary and run data are not rendered to an unauthorized or disabled scope.

### PAY-02 — Dependency-gating sequence

**Status:** `Not Run`

Enable one dependency at a time and restart between configurations:

1. Payroll disabled or Company omitted.
2. Payroll enabled while Finance is disabled.
3. Payroll and Finance enabled while File Storage is disabled/out of scope.
4. Storage enabled while `WORKFORCE_JOBS_ENABLED=false`.
5. All configuration dependencies enabled.
6. Validate business readiness: Finance profile, Payroll Expense category,
   payment account, open period, and every active Employee Branch covered by
   File Storage.

Expected blocked reasons include, as applicable:

- `PAYROLL_SCOPE_NOT_ENABLED`;
- `PAYROLL_FINANCE_SCOPE_NOT_ENABLED`;
- `PAYROLL_FILE_STORAGE_SCOPE_NOT_ENABLED`;
- `PAYROLL_WORKFORCE_JOBS_NOT_ENABLED`;
- `PAYROLL_FINANCE_SETUP_REQUIRED`;
- `PAYROLL_PAYMENT_ACCOUNT_REQUIRED`;
- `PAYROLL_OPEN_FINANCE_PERIOD_REQUIRED`.

When all dependencies are ready:

- `payrollLite` is true;
- `payrollNav` follows the actor's Payroll permission;
- `payrollDependencyState.ready` is true;
- `blockedReasons` is empty.

### PAY-03 — Payroll setup and privacy

**Status:** `Not Run`

1. As HR Manager, open Payroll.
2. Verify Salary Components.
3. Verify active Employee Salary revisions.
4. Verify Tax Profiles and Recurring Deductions.
5. Sign in as an unauthorized Employee and attempt the same routes/direct IDs.
6. Inspect Network responses.

Expected:

- HR Manager receives configured management actions;
- Finance approver receives only appropriate read/approval actions;
- unauthorized users cannot receive salary values in the DOM or network;
- all actions come from server capabilities/allowed actions.

### PAY-04 — Fresh Payroll Draft and calculation

**Status:** `Not Run`

Prepare a fresh approved UAT Payroll period. Do not create another active
August 2026 run.

1. Confirm an Attendance Period in `PAYROLL_PENDING` or `CLOSED` for every
   eligible Employee Branch.
2. Confirm active salary revisions on the effective date.
3. As HR Manager, create a Payroll Draft.
4. Add and edit adjustments.
5. Run preflight.
6. Calculate.
7. Inspect Employee lines, earnings, deductions, net salary, attendance
   snapshots, and totals.
8. Attempt to change salary, tax, deduction, or Attendance Period inputs using
   another session during calculation.

Expected:

- missing dependencies produce explicit blockers;
- eligible Employees are included once;
- calculation snapshots are deterministic;
- conflicting source edits or duplicate calculations are rejected safely;
- no partial run state is committed.

### PAY-05 — Independent approval

**Status:** `Not Run`

1. As Payroll Maker, attempt to approve the calculated run.
2. As independent Finance Manager, inspect the run and history.
3. Approve.
4. Attempt to add or edit adjustments after approval.
5. Refresh and inspect the immutable snapshot.

Expected:

- self-approval is denied;
- the independent approver can approve once;
- terminal calculation snapshots cannot be rewritten;
- history records maker, approver, timestamps, versions, and safe reasons.

### PAY-06 — Mark paid and Finance integration

**Status:** `Not Run`

1. Obtain explicit authorization before mutating an approved run.
2. As Finance Manager, select the configured payment account.
3. Enter a unique UAT payment reference.
4. Mark the approved run paid.
5. Repeat with the same operation ID.
6. Attempt the action concurrently from another session.
7. Open Office Finance Transactions and Reports.

Expected:

- one Mark Paid command succeeds;
- idempotent replay returns the same safe result;
- stale/concurrent action receives a controlled conflict;
- exactly one aggregate approved Payroll Expense is created;
- the Finance Expense contains no employee-level salary lines;
- Payroll and Finance link to each other exactly once.

### PAY-07 — Payslip generation and private download

**Status:** `Not Run`

1. Confirm real S3 access and workforce job processing.
2. Observe one generation operation per paid Employee.
3. Wait for each Payslip to become `AVAILABLE`.
4. Inspect Payslip Operations for pending, stale, failed, or dead-lettered work.
5. As the Employee, open My Workspace → My Payslips.
6. Download through the authorized short-lived link.
7. As another Employee, attempt the Payslip and File Object IDs.
8. Inspect URL lifetime and object privacy.

Expected:

- one Payslip and one File Object exist per paid Employee;
- generated files remain private;
- an Employee sees only their own Payslip;
- direct cross-Employee and cross-Company IDs are denied;
- no permanent storage URL is exposed.

### PAY-08 — Failed operation retry

**Status:** `Not Run`

1. Use an approved failed/stale test operation; do not create an artificial
   production-provider outage.
2. Open Payslip Operations.
3. Retry with expected version, a new operation ID, and mandatory reason.
4. Repeat the retry command.
5. Inspect final Payslip/File Object and operation history.

Expected:

- only authorized Payroll managers can retry;
- the reason and actor are audited;
- replay does not duplicate a Payslip or File Object;
- an exhausted failure remains visible for operator action.

---

## 10. Onboarding manual regression

### ONB-01 — Disabled and empty-scope fail-closed behavior

**Status:** `Not Run`

1. Disable Onboarding and restart.
2. As HR Manager, confirm Employee Onboarding and Onboarding Templates are
   hidden.
3. As Employee, confirm My Workspace Onboarding is unavailable.
4. Open the three routes directly.
5. For the operator-only validation case, enable Onboarding with both Company
   and Branch allowlists blank and attempt a controlled backend start.

Expected:

- disabled routes show the controlled unavailable state;
- no Onboarding data appears;
- enabled plus both blank scopes is rejected during environment validation;
- an empty allowlist never means all Companies.

### ONB-02 — Allowed Company and Branch behavior

**Status:** `Not Run`

1. Restore the approved Company allowlist and restart.
2. As HR Manager, open Employee Onboarding and Onboarding Templates.
3. As Employee, open My Workspace Onboarding.
4. Switch to the out-of-scope Company.
5. Repeat direct URLs.

Expected:

- `onboardingNav` is true only for the enabled scope and relevant permission;
- each persona receives only its authorized Onboarding surface;
- out-of-scope menu and direct access fail closed.

### ONB-03 — Branch-only allowlist

**Status:** `Not Run`

Use:

```env
ONBOARDING_V2_COMPANY_IDS=
ONBOARDING_V2_BRANCH_IDS=5c79da96-64e5-4027-83fc-4c1de736b10c
```

Expected:

- Learn Fresh HQ is enabled;
- every other Branch is denied;
- Branch scope does not broaden to the whole Company.

---

## 11. Recruitment and Leave permission regression

### NAV-01 — Recruitment Delivery-only persona

**Status:** `Not Run`

1. Sign in as the Delivery Viewer with mock mode disabled.
2. Expand Human Resources → Recruitment.
3. Open Delivery and refresh the direct route.

Expected:

- the Recruitment parent is visible;
- Delivery is visible;
- Dashboard, Openings, Applications, Candidates, Interviews, and Offers are
  hidden without `hr.recruitment.read`;
- Delivery loads from the live API.

### NAV-02 — Leave child-only personas

**Status:** `Not Run`

Repeat using Calendar, Holiday, Comp-off, and Team Viewers.

Expected:

- `hr.calendar.read` or `hr.team.read` exposes Leave → Calendar;
- `hr.holidays.read` exposes Leave → Holidays;
- `hr.comp-off.read` exposes Leave → Comp-off;
- unrelated Leave children remain hidden;
- the parent never hides an otherwise authorized child.

---

## 12. Active navigation, responsive, and accessibility checks

### UI-01 — One most-specific active child

**Status:** `Not Run`

Verify these mappings:

- Project detail → Projects only;
- My Project Task/deep link → My Projects only;
- My Timesheets → Timesheets only;
- Team Timesheets → Team Timesheets only;
- Payroll Run detail → Payroll only;
- Finance Transaction detail → Transactions only;
- Recruitment Delivery → Delivery only;
- Leave Calendar → Calendar only;
- Leave Holidays → Holidays only;
- Leave Comp-off → Comp-off only;
- My Workspace Onboarding → Onboarding only.

Expected:

- the parent section may remain expanded;
- only one child has active styling;
- only one child has `aria-current="page"`;
- a section landing child is not highlighted together with its nested child;
- refresh and deep-link navigation preserve the correct active child.

### UI-02 — Responsive and keyboard behavior

**Status:** `Not Run`

Repeat representative Project, Payroll, Finance, Recruitment, Leave, and
Onboarding routes using:

- expanded desktop sidebar;
- collapsed desktop sidebar;
- mobile navigation;
- keyboard-only navigation;
- 200% browser zoom.

Expected:

- focus remains visible;
- menu groups expand and links activate by keyboard;
- active state remains correct;
- labels remain readable;
- no horizontal page overflow or inaccessible hidden action occurs.

---

## 13. Manual negative and concurrency cases

### CON-01 — Project version conflict

**Status:** `Not Run`

1. Open the same Draft Project in two sessions.
2. Save a valid update in session A.
3. Save a different update from stale session B.

Expected: A succeeds; B receives a controlled state/version conflict and can
refresh without losing unrelated input.

### CON-02 — Project completion versus child mutation

**Status:** `Not Run`

Attempt Project completion in one session while another session mutates or
submits a blocking child.

Expected: one transaction wins; the other refreshes to authoritative state;
the Project never completes with an invalid child state.

### CON-03 — Task assignment versus submission

**Status:** `Not Run`

Reassign an in-progress Task while the prior assignee submits from another
session.

Expected: only the transaction consistent with the locked current assignee and
version succeeds.

### CON-04 — Timesheet approval versus correction

**Status:** `Not Run`

Approve a submitted Timesheet while another session attempts a line edit or
return/correction.

Expected: no approved history is rewritten and the stale action is rejected.

### CON-05 — Finance approval versus Draft edit

**Status:** `Not Run`

Submit/approve in one session while another saves a stale Draft edit.

Expected: no approved transaction is altered and the stale edit is rejected.

### CON-06 — Payroll approval and Mark Paid concurrency

**Status:** `Not Run`

Use two authorized sessions to attempt:

- approval with the same version;
- Mark Paid with the same version;
- repeated and conflicting operation IDs.

Expected:

- one command succeeds;
- stale/conflicting commands receive controlled errors;
- exactly one Finance Expense, Payslip, and File Object result is produced.

### CON-07 — Allowed versus out-of-scope Company

**Status:** `Not Run`

Use known record IDs from the allowed Company while authenticated in the
out-of-scope Company.

Expected: safe denial/not-found behavior with no record metadata leakage.

---

## 14. Bug classification and fix guide

### 14.1 Severity

P0 examples:

- cross-Company or cross-Branch data leakage;
- unauthorized direct-route action succeeds;
- self-approval succeeds where maker-checker is required;
- duplicate Finance Expense, Payslip, File Object, or terminal Project action;
- enabled module treats an empty allowlist as all Companies;
- salary, bank, secret, or private-file exposure.

P1 examples:

- an authorized persona cannot complete the required lifecycle;
- capability response is wrong for the active scope;
- Project/Finance/Payroll/Onboarding direct route bypasses or incorrectly
  blocks authorization;
- server `allowedActions` and rendered controls disagree;
- Payroll dependency/readiness state is wrong;
- Project completion, Timesheet approval, or Payroll maker-checker rules are
  incorrect.

P2 examples:

- two navigation children appear active;
- responsive, keyboard, focus, empty, loading, retry, or conflict-state defect;
- confusing but non-blocking validation or status text.

### 14.2 Required defect record

For every failure, record:

- defect ID and severity;
- exact commit;
- persona, roles, and relevant permission codes;
- active Company and Branch;
- environment profile without secrets;
- route, entity ID, and expected version;
- operation ID for command failures;
- expected versus actual result;
- screenshot or recording;
- browser console;
- safe Network request/status/stable error code;
- relevant audit, action-event, receipt, outbox, and File Object identifiers;
- whether mock mode or any mock provider was used.

### 14.3 Diagnosis order

1. Confirm the tested commit and that backend/frontend were restarted.
2. Confirm real API/provider mode and active Company/Branch.
3. Inspect `GET /me/module-capabilities`.
4. Inspect the current authorization snapshot and relevant permissions.
5. Inspect server-returned collection actions and record `allowedActions`.
6. Check the page/module gate and direct route.
7. Check the API stable error code and expected version.
8. Check committed database state, action evidence, command receipt, outbox,
   and File Object state when a mutation occurred.
9. Check S3/ClamAV/job health for file or Payslip failures.
10. Confirm no stale browser session or Company-context data remains.

### 14.4 Common symptoms

- **Module hidden while expected enabled:** verify the global flag, explicit
  Company/Branch allowlist, active context, permission, and capability response.
- **Module visible in another Company:** treat as P0; restore fail-closed scope
  evaluation and retest direct IDs.
- **Project action missing:** compare actor, Project lifecycle, version, current
  Project Manager, Team membership, assignee, and server `allowedActions`.
- **Payroll blocked:** read `payrollDependencyState` and verify Finance scope,
  File Storage coverage, workforce jobs, Finance setup, payment account, and
  open period.
- **Finance/backend rejects configured `v1`:** restore the original approved
  secret; never invent a replacement for an existing key version.
- **Payslip or Project file stuck:** inspect storage access, scan/job health,
  operation intent, lease/retry state, and File Object status.
- **Parent menu missing for child-only persona:** ensure the parent permission
  union includes every valid child permission without exposing siblings.
- **Two children highlighted:** select the longest/most-specific matching child.
- **Capability remains stale after context switch:** verify the context change
  clears cached queries and refetches the capability response.

### 14.5 Fix and retest sequence

1. Reproduce on the recorded commit and environment profile.
2. Identify the failing layer before changing code or data.
3. Preserve existing routes and server-authoritative authorization.
4. Do not weaken a guard to make a positive case pass.
5. Do not modify historical receipts, encrypted values, approved Payroll
   snapshots, completed history, or applied migrations as a test fix.
6. Add the smallest scoped correction.
7. Retest the failed actor and route.
8. Retest an unauthorized actor.
9. Retest the out-of-scope Company/Branch.
10. Retest direct URL, refresh, stale version, and repeated operation ID.
11. Verify no duplicate database, outbox, Finance, Payslip, or file result.
12. Attach fresh evidence and update the defect status.

---

## 15. Completion and sign-off

Manual UAT is complete only when:

- Project Administrator → Project Manager → Employee → Timesheet Approver
  lifecycle passes;
- Expense Maker → independent Approver → reversal lifecycle passes;
- Payroll Maker → independent Approver → Payment → Finance Expense → Payslip →
  Employee download lifecycle passes;
- Project documents and Payslips use real private storage and required scanning
  or generation jobs;
- Onboarding, Recruitment, Leave, and active-menu regressions pass;
- disabled and out-of-scope direct routes fail closed;
- cross-Company, cross-Branch, outsider, direct-ID, stale-version, and repeated
  operation tests pass;
- no mock provider is presented as real evidence;
- every case has `Pass`, `Fail`, `Blocked`, or `Not Run` plus evidence;
- all P0/P1 defects are fixed and retested;
- unresolved S3, ClamAV, secrets, credentials, monitoring, security, Finance,
  Payroll, operations, or business approvals remain explicit blockers.

Required sign-offs:

- Project business owner;
- Finance business owner;
- Payroll/HR business owner;
- Security reviewer;
- Infrastructure/operations owner;
- technical release owner.

Production remains `NO-GO` until the required cases pass on one recorded commit
and all external approvals are complete.
