# ERP Lite Manual UAT — Step-by-Step Execution Guide

**Document status:** Executed — see checklist + submission summary  
**Initial result:** Every phase and checkpoint was `Not Run`  
**Final result:** All 25 checkpoints run — **NO-GO for production** (Partial/Blocked items remain)  
**Prepared:** 2 September 2026  
**Executed:** 2 September 2026  
**Checklist:** [erp-lite-uat-simple-phase-checklist.md](../../testing/erp-lite-uat-simple-phase-checklist.md)
**Submission summary:** [erp-lite-uat-submission-summary-2026-09-02.md](../../testing/erp-lite-uat-submission-summary-2026-09-02.md)
**Evidence:** [uat-evidence-2026-09-02-5916d45/](../../testing/uat-evidence-2026-09-02-5916d45/)
**Application:** HRMS/ERP initial release  
**Test method:** Manual browser testing against the real API, PostgreSQL database,
and configured providers  
**Reference commit:** `5916d458cef64ba798fcc440ee9eff024462306c`

Companion specification:
[ERP Lite and Menu Manual Testing and Bug-Fix Guide](../../testing/erp-lite-and-menu-manual-testing-guide-2026-09-01.md).

This runbook explains how to execute the companion guide in a safe order. It
does not treat earlier automated tests or code inspection as manual evidence.
It contains no automated-test commands.

---

## 1. Scope and final decision

Execute the following manually:

1. Company/Branch capability and menu gating.
2. Project Lite lifecycle, Task submissions, Timesheets, and documents.
3. Office Finance Lite Expense maker-checker and reversal.
4. Payroll Lite setup, calculation, approval, payment, Finance integration,
   Payslip generation, and Employee download.
5. Onboarding, Recruitment, and Leave navigation regressions.
6. Direct-route, cross-tenant, responsive, accessibility, and concurrency checks.

This execution establishes readiness for business UAT sign-off. It does not by
itself authorize production enablement.

Previous menu-capability evidence may be attached as supporting evidence, but
do not copy its Pass results into this new run. Retest against the recorded
commit and environment.

---

## 2. Non-negotiable execution rules

- Keep every checkpoint `Not Run` until a person performs it.
- Use the real frontend and backend; mock mode must remain disabled.
- Record the actual Git commit before starting.
- Use dedicated UAT accounts, never real Employee accounts.
- Never paste passwords, access keys, encryption keys, HMAC keys, cookies, or
  tokens into this document, screenshots, tickets, or chat.
- Do not invent replacement `v1` keys. Existing receipts and encrypted records
  depend on the approved original keys.
- Do not mark File Storage, Project documents, or Payslips Pass with mock S3 or
  mock malware scanning.
- Do not alter Payroll run `PR-000004` unless explicit data-mutation approval is
  recorded.
- Use a fresh approved Payroll period for the full lifecycle.
- Use separate Payroll Maker and Payroll Approver accounts.
- Use `Blocked`, not `Fail`, when required infrastructure, secret, persona, or
  business authorization is unavailable.
- Use `Fail` when the required setup exists but actual behavior differs from the
  expected result.
- Stop immediately for suspected Company/Branch leakage, unauthorized salary or
  document access, duplicate payment/Expense/Payslip, or public file exposure.

---

## 3. Approved UAT scope and known records

### 3.1 Allowed pilot

```env
TEST_COMPANY_ID=e4c645f1-2359-439c-ac68-41785cf11e82
TEST_BRANCH_ID=5c79da96-64e5-4027-83fc-4c1de736b10c
```

- Company: Learn Fresh Company.
- Branch: Learn Fresh HQ.

### 3.2 Denied comparison scope

```env
OUT_OF_SCOPE_COMPANY_ID=eadf7f5f-1669-4e90-9f32-0a1040e7cebf
OUT_OF_SCOPE_BRANCH_ID=d9b23f66-34d4-472e-a397-48a406787a99
```

### 3.3 Existing safe records

```env
TEST_PROJECT_ID=60854dea-fada-4373-a541-5efb8cef63b0
TEST_PROJECT_CODE=PRJ-000001

TEST_PAYROLL_RUN_ID=32dad0d6-f410-4a2e-b26b-5d8e711eadf9
TEST_PAYROLL_RUN_NUMBER=PR-000004

TEST_FINANCE_TRANSACTION_ID=f5d33da3-18f2-491d-852a-0402a709d3ea
```

Known starting data:

- one Draft Project;
- two active Salary Components;
- three active Employee Salary revisions;
- one August 2026 Attendance Period in `PAYROLL_PENDING`;
- Payroll run `PR-000004` in `APPROVED`;
- one Finance profile;
- nine active Finance accounts;
- one open Finance period;
- no existing File Objects at the time this plan was prepared.

Before testing, ask the database/operator owner to confirm that these facts are
still true. If they changed, record the replacement IDs and facts in the run
header; do not silently reuse stale IDs.

---

## 4. Prepare the environment

### ENV-01 — Record the test build

**Status:** `Not Run`

1. Open the application checkout used by the backend and frontend.
2. Record the current Git commit in the execution sheet.
3. Confirm the backend and frontend are built from the same commit.
4. Record the database/environment name without recording credentials.
5. Record who approved UAT data mutation.
6. If the commit changes during testing, close the current run and start a new
   run for the new commit.

Expected:

- every screenshot and defect can be tied to one commit and environment;
- no result combines evidence from different builds.

### ENV-02 — Obtain approved personas

**Status:** `Not Run`

Provision or identify distinct approved accounts for:

1. Company Administrator / Project Administrator.
2. Project Manager.
3. Assigned Project Employee.
4. A different Project Employee.
5. Reporting Manager / Timesheet Approver.
6. HR Manager / Payroll Maker.
7. Finance Manager / Payroll Approver.
8. Employee viewing their own Payslip.
9. Recruitment Delivery-only Viewer.
10. Leave Calendar-only Viewer.
11. Holiday-only Viewer.
12. Comp-off-only Viewer.
13. Unauthorized Employee.
14. User from another Company/Branch.
15. A user permitted to switch between allowed and denied scopes, if the
    organization model permits it.

For every account, record only:

- tester-facing alias;
- intended persona;
- Company and Branch;
- permission names;
- whether the account is active and linked to an active Employee.

Do not record passwords or authentication tokens.

### ENV-03 — Apply the enabled backend profile

**Status:** `Not Run`

Use the approved environment-management process to configure:

```env
RECRUITMENT_ENABLED=true
PUBLIC_CAREERS_ENABLED=true

ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
ONBOARDING_V2_BRANCH_IDS=
ONBOARDING_REMINDERS_ENABLED=false

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

Safeguard:

- Project already has 1 `v1` receipt.
- Finance already has 45 `v1` receipts.
- Payroll already has 12 `v1` receipts.
- Finance already has 5 encrypted bank-reference rows.

Retrieve the original approved key material from the secret owner. If it is not
available, mark the affected enabled-state flows `Blocked`. Do not generate a
new value under version `v1`.

### ENV-04 — Configure real File Storage and malware scanning

**Status:** `Not Run`

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

FILE_SCAN_WORKER_ENABLED=true
CLAMAV_HOST=<approved-clamav-host>
CLAMAV_PORT=3310
```

1. Ask the infrastructure owner to confirm the bucket is private.
2. Confirm the test Branch is included in the File Storage allowlist.
3. Confirm the scan worker can reach ClamAV.
4. Confirm generated/downloaded files are not exposed through permanent public
   URLs.
5. Store the new filename encryption key in the approved secret store before
   the first upload.
6. Retain that key permanently after File Objects are created.

If S3 or ClamAV is unavailable:

- mark Project document cases `Blocked`;
- mark Payroll Payslip generation/download cases `Blocked`;
- continue non-file UAT;
- do not use a mock provider as replacement evidence.

### ENV-05 — Apply the frontend profile

**Status:** `Not Run`

```env
BACKEND_INTERNAL_URL=http://localhost:4500
NEXT_PUBLIC_RECRUITMENT_ENABLED=true
NEXT_PUBLIC_PUBLIC_CAREERS_ENABLED=true
NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false
```

1. Apply these values through the approved local/UAT environment method.
2. Restart the backend after backend environment changes.
3. Restart the frontend after any `NEXT_PUBLIC_*` change.
4. Open `http://localhost:3200` in a fresh browser session.
5. Confirm the frontend communicates with the backend at port `4500`.
6. In DevTools Network, verify Recruitment requests are not served by mock mode.

### ENV-06 — Prepare browser sessions and evidence storage

**Status:** `Not Run`

1. Use separate browser profiles for each persona when possible.
2. Use a normal and an incognito/private session for two-actor races.
3. Enable preservation of Network logs.
4. Keep the Console visible during each critical mutation.
5. Create an evidence folder named with date, commit, environment, and test run.
6. Use filenames such as `PRJ-05-step-08-project-manager.png`.
7. Redact cookies, tokens, salary amounts not needed for the defect, bank
   references, and secret values before sharing evidence.

---

## 5. Evidence worksheet

Copy this block for every checkpoint:

```text
Case ID:
Status: Not Run | Pass | Fail | Blocked
Tester:
Date/time and timezone:
Commit:
Environment:
Persona:
Permissions:
Company/Branch:
Route:
Entity ID and version before action:
Operation ID, if applicable:
Expected:
Actual:
HTTP method/path/status:
Stable error code:
Entity ID and version after action:
Screenshot/video:
Console summary:
Database/audit/outbox/file evidence owner:
Mock mode disabled: Yes | No
Defect ID or blocker:
```

A Pass requires:

- the expected browser behavior;
- the expected live API response;
- no relevant Console error;
- authoritative refreshed state;
- database/audit/outbox/file evidence when the action changes business state.

---

## 6. Execute the baseline capability checks

### BASE-01 — Login and allowed scope

**Status:** `Not Run`

1. Sign in as Company Administrator.
2. Select Learn Fresh Company and Learn Fresh HQ.
3. Hard-refresh the page.
4. Open DevTools Network.
5. Find `GET /me/module-capabilities`.
6. Save the response as evidence.
7. Confirm Project, Finance, Payroll, and Onboarding capability fields are
   present and typed.
8. Confirm navigation flags follow both feature scope and permission.

Expected:

- enabled modules report enabled for the allowed Company;
- unauthorized navigation remains false;
- the response contains no secret material;
- only permitted menu items are visible.

### BASE-02 — Context switching

**Status:** `Not Run`

1. Begin in Learn Fresh Company and record the visible menu.
2. Switch to the out-of-scope Company/Branch without manually reloading.
3. Confirm the active Company label changes.
4. Confirm gated menus disappear immediately.
5. Confirm `/me/module-capabilities` refetches for the new scope.
6. Open a known Project, Finance Transaction, Payroll Run, and Onboarding route
   directly.
7. Confirm no Learn Fresh content remains visible in the page or Network cache.
8. Switch back and confirm the allowed menu returns after a fresh capability
   response.

If no valid cross-company switch persona exists, record `Blocked`. Use a
separate out-of-scope account for direct-ID denial, but do not call that a
browser context-switch Pass.

---

## 7. Execute disabled-state gating first

### GATE-01 — Disable the gated modules

**Status:** `Not Run`

Temporarily apply:

```env
ONBOARDING_V2_ENABLED=false
PROJECTS_LITE_ENABLED=false
OFFICE_FINANCE_LITE_ENABLED=false
PAYROLL_LITE_ENABLED=false
```

1. Restart the backend.
2. Sign out and sign back in.
3. Test Company Administrator, Project Manager, HR Manager, Finance Manager,
   and Employee personas.
4. Confirm Project Management, My Projects, My Timesheets, Office Finance,
   Payroll, My Payslips, and Onboarding items are hidden as applicable.
5. Open the following routes directly:
   - `/projects/projects`;
   - `/projects/projects/60854dea-fada-4373-a541-5efb8cef63b0`;
   - `/my-workspace/projects`;
   - `/my-workspace/timesheets`;
   - `/team/timesheets`;
   - `/office-finance`;
   - `/office-finance/transactions`;
   - `/office-finance/transactions/f5d33da3-18f2-491d-852a-0402a709d3ea`;
   - `/hr/payroll`;
   - `/hr/payroll/runs/32dad0d6-f410-4a2e-b26b-5d8e711eadf9`;
   - `/hr/employee-onboarding`;
   - `/hr/onboarding-templates`;
   - `/my-workspace/onboarding`.
6. Refresh every representative blocked page.
7. Confirm no protected data flashes before the blocked state.

Expected:

- menus are hidden;
- direct routes show a controlled unavailable state;
- APIs fail closed;
- no raw error, blank page, endless loader, or protected payload appears.

### GATE-02 — Restore enabled profile

**Status:** `Not Run`

1. Restore ENV-03, ENV-04, and ENV-05.
2. Restart the backend and frontend where required.
3. Sign out and sign back in.
4. Reconfirm the allowed Company/Branch.
5. Capture a fresh `/me/module-capabilities` response.
6. Do not continue until dependency blockers are understood and recorded.

---

## 8. Execute Project Lite

### PROJECT-01 — Draft, validation, and activation

**Status:** `Not Run`

1. Sign in as Company Administrator.
2. Open Project Management → Projects.
3. Open `PRJ-000001` for read-only baseline comparison.
4. Create a new Internal Project with a unique `UAT-<date>-<sequence>` name.
5. Select Learn Fresh HQ.
6. Select an active same-Company, user-linked Project Manager.
7. Save the Draft and record its ID/version.
8. Edit dates and supported commercial fields; save and refresh.
9. Try a stale or direct out-of-scope Branch ID.
10. Try an inactive, non-user-linked, or other-Company Manager.
11. Try to attach a Business Party to the Internal Project.
12. Confirm field-level errors and that valid form data remains intact.
13. Activate the valid Project.
14. Sign in as an unrelated Project Administrator and attempt child management.
15. Sign in as the selected Project Manager and confirm server-authorized actions
    are available.

Expected:

- the Project is created once;
- invalid relationships fail safely;
- only the current Manager manages child work after activation;
- the UI renders `allowedActions` from the server.

### PROJECT-02 — Stage, Team, Task, submission, and completion

**Status:** `Not Run`

1. As Project Manager, create and activate a Stage.
2. Add an active same-Company Employee to the Team.
3. Create a Task under the Stage.
4. Assign the Task to that Employee.
5. Before work starts, unassign it and confirm the action succeeds.
6. Reassign it to an eligible Team member.
7. Sign in as the assignee and start the Task.
8. Confirm ordinary unassignment is no longer available.
9. As Project Manager, directly reassign in-progress work with a reason.
10. As the former assignee, attempt submission and confirm denial.
11. As the current assignee, submit work evidence.
12. As Project Manager, return the submission with a mandatory reason.
13. As Employee, correct and resubmit.
14. As Project Manager, accept/complete the Task.
15. Confirm prior submission and review history remains immutable.
16. Complete the Stage.
17. Create unfinished blocking work and attempt Project completion.
18. Resolve the blocking work and complete the Project.
19. Attempt a child mutation after completion.

Expected:

- only eligible actors can act;
- reasons are required and preserved;
- unfinished work blocks completion;
- terminal Projects reject child changes;
- histories remain visible and immutable.

### PROJECT-03 — Timesheet lifecycle

**Status:** `Not Run`

1. As assigned Employee, open My Workspace → Timesheets.
2. Create a weekly Timesheet.
3. Add eligible Project/Task lines for actual work dates.
4. Edit and remove Draft lines.
5. Attempt to exceed the daily-hours limit.
6. Submit the Timesheet.
7. Attempt an edit after submission.
8. As the wrong Manager, open the Timesheet ID and attempt approval.
9. As the Employee, attempt self-approval.
10. As the correct Reporting Manager, inspect each line.
11. Return the Timesheet with a reason.
12. As Employee, correct and resubmit.
13. As Reporting Manager, approve.
14. Open Project Time Summary.

Expected:

- effective-date eligibility and daily-hour validation are enforced;
- wrong-manager and self-approval are denied;
- submitted history is immutable;
- only approved time appears in the summary.

### PROJECT-04 — Real document flow

**Status:** `Not Run`

1. Confirm ENV-04 is healthy.
2. Use a small, permitted, non-sensitive UAT file.
3. Upload it as authorized evidence.
4. Record the upload/File Object ID without recording a storage credential.
5. Confirm the file enters Quarantined/Scanning state.
6. Attempt to link it before CLEAN and confirm rejection.
7. Wait for a real ClamAV CLEAN result.
8. Link it to the authorized Task submission.
9. Download through the short-lived application-provided link.
10. Try the File Object ID as another Project Employee.
11. Try it as the out-of-scope Company user.
12. Confirm no permanent public S3 URL is exposed.

If real S3 or ClamAV is unavailable, set `Blocked` and continue to Finance.

---

## 9. Execute Office Finance Lite and Expense

### FINANCE-01 — Setup and Draft edit

**Status:** `Not Run`

1. Confirm approved original Finance `v1` keys are loaded.
2. Sign in as Finance Manager/setup administrator.
3. Verify the Company Financial Profile and base currency.
4. Verify an active Expense category.
5. Verify an active payment account and note its opening date.
6. Verify an open Finance Period.
7. Sign in as Finance Maker.
8. Create an Expense Draft with a unique UAT description.
9. Edit category, account, Department, Project, Party, Employee, date, amount,
   and description.
10. Save, refresh, and confirm every field persists.
11. Set a date before the selected account opening date.
12. Try incompatible Branch, Department, Project, Employee, or account IDs.

Expected:

- sensitive values remain masked;
- all supported Draft fields persist;
- invalid dates and organization relationships are rejected;
- Branch is derived by the server.

### FINANCE-02 — Maker-checker approval and reversal

**Status:** `Not Run`

1. Submit the Expense as Finance Maker.
2. Attempt self-approval using the Maker account.
3. Sign in independently as Finance Approver.
4. Return the transaction with a reason.
5. As Maker, correct and resubmit.
6. As Approver, approve.
7. Confirm the approved Expense appears exactly once in Transactions and
   Reports.
8. As an actor with `finance.transactions.reverse`, reverse it with a reason.
9. Replay the same operation ID.
10. Attempt another reversal with a different operation ID.
11. Inspect the original and linked reversal.

Expected:

- maker cannot self-approve;
- return and reversal require reasons;
- the original approved row remains immutable;
- exactly one linked reversal exists;
- idempotent replay does not duplicate business state.

### FINANCE-03 — Scope and direct-ID denial

**Status:** `Not Run`

1. Sign in as Unauthorized Employee.
2. Open Office Finance routes and the known Finance Transaction ID directly.
3. Repeat as an out-of-scope Company/Branch user.
4. If possible, switch an authorized user from allowed to out-of-scope Company.
5. Confirm cached Finance content disappears.

Expected:

- unauthorized navigation is hidden;
- direct IDs do not disclose record existence or data;
- context switching refetches capability and data state.

---

## 10. Execute Payroll Lite and Payslips

### PAYROLL-01 — Prove every dependency gate

**Status:** `Not Run`

Change one dependency at a time and restart the backend after each change:

1. Payroll disabled or allowed Company omitted.
2. Payroll enabled while Office Finance is disabled/out of scope.
3. Payroll and Finance enabled while File Storage is disabled/out of scope.
4. Storage enabled while `WORKFORCE_JOBS_ENABLED=false`.
5. All configuration dependencies enabled but Finance setup missing in a safe
   controlled UAT scope, when such a scope exists.
6. Payment account missing, when safely testable.
7. Open Finance Period missing, when safely testable.
8. Restore all approved dependencies.
9. Capture `/me/module-capabilities` after each configuration.

Expected blocked reasons include as applicable:

- `PAYROLL_SCOPE_NOT_ENABLED`;
- `PAYROLL_FINANCE_SCOPE_NOT_ENABLED`;
- `PAYROLL_FILE_STORAGE_SCOPE_NOT_ENABLED`;
- `PAYROLL_WORKFORCE_JOBS_NOT_ENABLED`;
- `PAYROLL_FINANCE_SETUP_REQUIRED`;
- `PAYROLL_PAYMENT_ACCOUNT_REQUIRED`;
- `PAYROLL_OPEN_FINANCE_PERIOD_REQUIRED`.

Ready state requires:

- `payrollLite: true`;
- permission-appropriate `payrollNav`;
- `payrollDependencyState.ready: true`;
- no blocked reasons.

### PAYROLL-02 — Setup, privacy, and fresh calculation

**Status:** `Not Run`

1. Sign in as HR Manager/Payroll Maker.
2. Verify Salary Components, Employee Salary revisions, Tax Profiles, and
   Recurring Deductions.
3. Sign in as Unauthorized Employee and confirm salary setup/data is absent in
   both page and Network responses.
4. Obtain approval for a fresh Payroll test period.
5. Do not create another active August 2026 run.
6. Confirm Attendance Period readiness for every eligible Employee Branch.
7. Confirm salary revisions are effective for the new period.
8. Create a Payroll Draft.
9. Add and edit adjustments.
10. Run the UI preflight and record all blockers/warnings.
11. Calculate the run.
12. Inspect Employee lines, earnings, deductions, attendance snapshots, net
    salary, and aggregate totals.
13. Confirm every eligible Employee appears once.
14. Confirm no partial state exists when a blocker is intentionally encountered.

### PAYROLL-03 — Independent approval and payment

**Status:** `Not Run`

1. As Payroll Maker, attempt approval and confirm self-approval denial.
2. Sign in separately as Finance Manager/Payroll Approver.
3. Inspect the run and immutable calculation snapshot.
4. Approve once.
5. Attempt to change adjustments after approval.
6. Obtain explicit authorization for Mark Paid.
7. Select the approved payment account.
8. Enter a unique UAT payment reference.
9. Mark the run paid.
10. Replay the same operation ID.
11. Open Office Finance Transactions and Reports.
12. Confirm exactly one aggregate approved Payroll Expense.
13. Confirm the Finance Expense does not expose employee salary detail.
14. Confirm Payroll and Finance link to each other once.

Do not use `PR-000004` for this mutation unless explicit approval names that run.
It may be used for read-only detail testing.

### PAYROLL-04 — Payslip generation, access, and recovery

**Status:** `Not Run`

1. Confirm real File Storage and workforce jobs are healthy.
2. Observe one Payslip generation operation per paid Employee.
3. Wait for each operation to reach `AVAILABLE` or an actionable failure.
4. Confirm exactly one Payslip/File Object link for each Employee.
5. Sign in as one Employee.
6. Open My Workspace → My Payslips.
7. Confirm only that Employee's Payslip is listed.
8. Download through the short-lived authorized URL.
9. As another Employee, attempt the Payslip and File Object IDs.
10. As an out-of-scope user, repeat.
11. As Payroll operator, inspect pending, stale, failed, and dead-lettered
    operations.
12. If an approved failed/stale UAT operation exists, retry with expected
    version, a unique operation ID, and mandatory reason.
13. Replay the retry.
14. Confirm no duplicate Payslip or File Object was created.

If real providers are unavailable, record `Blocked`; do not substitute mock
storage or a mock worker.

---

## 11. Execute Onboarding and navigation regression

### NAVIGATION-01 — Onboarding scope

**Status:** `Not Run`

1. With Onboarding enabled for Learn Fresh, sign in as HR Manager.
2. Confirm Employee Onboarding and Onboarding Templates are visible.
3. Open and refresh both routes.
4. Sign in as Employee and open My Workspace → Onboarding.
5. Confirm the Employee cannot access HR monitoring routes.
6. Switch or sign in to the out-of-scope Company/Branch.
7. Confirm menus and direct routes fail closed.
8. For the separate Branch-only test, use:

```env
ONBOARDING_V2_COMPANY_IDS=
ONBOARDING_V2_BRANCH_IDS=5c79da96-64e5-4027-83fc-4c1de736b10c
```

9. Restart, retest Learn Fresh HQ, and retest another Branch.
10. Restore the Company allowlist after the case.

If Learn Fresh still has only one Branch, record the other-Branch check
`Blocked`; do not infer a browser Pass from code tests.

### NAVIGATION-02 — Recruitment and Leave child-only personas

**Status:** `Not Run`

1. Confirm `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false`.
2. Sign in as Recruitment Delivery-only Viewer.
3. Confirm Recruitment parent and Delivery child are visible.
4. Confirm Dashboard, Openings, Applications, Candidates, Interviews, and
   Offers are hidden.
5. Open Delivery, refresh, and confirm live API use.
6. Sign in separately as Calendar-only, Holiday-only, Comp-off-only, and Team
   Viewer personas.
7. For each persona, confirm Leave parent and only the authorized child appear.
8. Open each authorized direct route and one unauthorized sibling route.

Missing isolated personas make the associated browser check `Blocked`, even if
unit tests or navigation configuration are correct.

### NAVIGATION-03 — Highlighting, responsive layout, and keyboard

**Status:** `Not Run`

For every representative route below, repeat in expanded sidebar, collapsed
sidebar, mobile navigation, keyboard-only navigation, and 200% zoom:

- Project detail → Projects only;
- My Project Task → My Projects only;
- My Timesheets → Timesheets only;
- Team Timesheets → Team Timesheets only;
- Payroll Run detail → Payroll only;
- Finance Transaction detail → Transactions only;
- Recruitment Delivery → Delivery only;
- Leave Calendar, Holidays, and Comp-off → exact child only;
- My Workspace Onboarding → Onboarding only.

For each route:

1. Navigate from the menu.
2. Confirm only one item is visually active.
3. Confirm only that item has `aria-current="page"`.
4. Refresh the nested route.
5. Collapse and expand the sidebar.
6. Open and close mobile navigation.
7. Traverse the menu using keyboard only.
8. Verify visible focus and activation.
9. Set browser zoom to 200%.
10. Confirm readable labels and no horizontal page overflow.

---

## 12. Execute manual concurrency and replay checks

### CONCURRENCY-01 — Two-session conflicts

**Status:** `Not Run`

Use two different browser sessions. Before each race, record the entity version
visible in both sessions.

Run these one at a time:

1. Two administrators edit the same Draft Project version.
2. Project Manager completes a Project while another session mutates unfinished
   child work.
3. Project Manager reassigns a Task while the current Employee submits it.
4. Reporting Manager approves a Timesheet while the Employee attempts a
   correction.
5. Finance Approver approves an Expense while the Maker attempts a Draft edit.
6. Two Payroll Approvers attempt approval.
7. Two Finance sessions attempt Mark Paid.
8. Replay a completed command with the same operation ID.
9. Reuse an operation ID with a changed payload.

Expected for each race:

- one valid command succeeds;
- the stale/conflicting command receives a controlled conflict;
- refresh shows authoritative state;
- repeated identical operation replays safely;
- changed payload with reused operation ID is rejected;
- no duplicate Project action, Finance Expense, Payslip, or File Object exists.

Do not intentionally interrupt a real payment or storage provider. Use only
approved UAT actions and data.

---

## 13. How to record and fix a defect

### 13.1 Severity

- `P0`: tenant/data leakage, unauthorized salary/document access, irreversible
  corruption, duplicate payment/Finance/Payslip, public file exposure, or an
  unavailable critical application path.
- `P1`: authorized user blocked, incorrect workflow/financial result, broken
  dependency gate, wrong `allowedActions`, repeatable conflict failure, or a
  major path without a safe workaround.
- `P2`: highlighting, layout, focus, validation message, usability, or minor
  evidence issue that does not compromise security or business correctness.

### 13.2 Immediate response

1. Stop the affected workflow.
2. Do not repeatedly submit the mutation.
3. Preserve the browser tab and Network log.
4. Record entity ID, before/after version, operation ID, actor, Company/Branch,
   route, time, and stable error code.
5. Capture screenshots with sensitive values redacted.
6. Ask the database/operator owner to preserve relevant audit, receipt, outbox,
   notification, Finance, Payroll, and File Object evidence.
7. For P0, stop the entire UAT run until triage confirms safe continuation.

### 13.3 Diagnosis order

Diagnose in this order:

1. Environment and dependency readiness.
2. Active Company and Branch.
3. `/me/module-capabilities` response.
4. Current user authorization snapshot.
5. Server `allowedActions`.
6. Feature/page gate.
7. API request, response, version, and stable error code.
8. Database, receipt, audit, outbox, notification, Finance, Payroll, and file
   evidence when state changed.

### 13.4 Retest after a fix

1. Record the new commit; never reuse old evidence.
2. Recreate the original environment and persona.
3. Retest the exact failed step.
4. Retest an unauthorized actor.
5. Retest an out-of-scope Company/Branch.
6. Retest direct URL and browser refresh.
7. Retest a stale version.
8. Retest identical operation replay.
9. Confirm no duplicate database/file result.
10. Rerun the complete affected lifecycle, not only the corrected screen.
11. Attach fresh evidence and close the defect only after the expected state is
    independently verified.

---

## 14. Execution tracker

| Order | Phase | Initial status | Final status | Evidence/defect |
|---:|---|---|---|---|
| 1 | ENV-01 build and environment | `Not Run` | **Pass** | [phase-0-setup-evidence.md](../../testing/uat-evidence-2026-09-02-5916d45/phase-0-setup-evidence.md) |
| 2 | ENV-02 personas | `Not Run` | **Partial** | 7 accounts; missing specialized personas |
| 3 | ENV-03 enabled backend profile | `Not Run` | **Partial Pass** | Local dev v1 keys added Phases 4–5 |
| 4 | ENV-04 storage and scanning | `Not Run` | **Partial** | S3 partial; ClamAV Blocked |
| 5 | ENV-05 frontend/live API | `Not Run` | **Pass** | Mock off |
| 6 | ENV-06 browser/evidence setup | `Not Run` | **Pass** | Evidence folder |
| 7 | BASE-01 allowed capability | `Not Run` | **Pass** | [phase-1-baseline-evidence.md](../../testing/uat-evidence-2026-09-02-5916d45/phase-1-baseline-evidence.md) |
| 8 | BASE-02 scope switching | `Not Run` | **Blocked** | No multi-company user; Jest Pass |
| 9 | GATE-01 disabled modules | `Not Run` | **Pass** | [phase-2-gate-evidence.md](../../testing/uat-evidence-2026-09-02-5916d45/phase-2-gate-evidence.md) |
| 10 | GATE-02 restore enabled profile | `Not Run` | **Pass** | phase-2 |
| 11 | PROJECT-01 Draft/activation | `Not Run` | **Pass** | PRJ-000015 — [phase-3](../../testing/uat-evidence-2026-09-02-5916d45/phase-3-projects-evidence.md) |
| 12 | PROJECT-02 lifecycle | `Not Run` | **Pass** | phase-3 API |
| 13 | PROJECT-03 Timesheets | `Not Run` | **Pass** | phase-3 API |
| 14 | PROJECT-04 documents | `Not Run` | **Blocked** | No ClamAV |
| 15 | FINANCE-01 setup/Draft | `Not Run` | **Pass** | FT-000009 — [phase-4](../../testing/uat-evidence-2026-09-02-5916d45/phase-4-finance-evidence.md) |
| 16 | FINANCE-02 approval/reversal | `Not Run` | **Pass** | phase-4 API 21/21 |
| 17 | FINANCE-03 scope denial | `Not Run` | **Pass** | phase-4 |
| 18 | PAYROLL-01 dependency gates | `Not Run` | **Pass** | [phase-5](../../testing/uat-evidence-2026-09-02-5916d45/phase-5-payroll-evidence.md) |
| 19 | PAYROLL-02 setup/calculation | `Not Run` | **Pass** | PR-000005 |
| 20 | PAYROLL-03 approval/payment | `Not Run` | **Partial** | Approve Pass; mark-paid **Fail** (P1) |
| 21 | PAYROLL-04 Payslips/recovery | `Not Run` | **Blocked** | No ClamAV |
| 22 | NAVIGATION-01 Onboarding | `Not Run` | **Partial Pass** | [phase-6](../../testing/uat-evidence-2026-09-02-5916d45/phase-6-navigation-evidence.md) |
| 23 | NAVIGATION-02 Recruitment/Leave | `Not Run` | **Partial Pass** | Jest Pass; browser Blocked |
| 24 | NAVIGATION-03 UI/accessibility | `Not Run` | **Partial Pass** | Route tests Pass; manual Blocked |
| 25 | CONCURRENCY-01 races/replay | `Not Run` | **Partial Pass** | [phase-7](../../testing/uat-evidence-2026-09-02-5916d45/phase-7-concurrency-evidence.md) |

Do not mark a phase Pass when any mandatory checkpoint inside it is Fail or
Blocked. A phase with infrastructure/persona dependencies may be `Partial` only
in a progress report; the production gate remains open.

---

## 15. Completion and sign-off

Manual UAT is complete only when all of the following are proven on one recorded
commit:

- Project Administrator → Project Manager → Employee → Timesheet Approver
  lifecycle passes.
- Project document upload, real malware scan, authorization, and download pass.
- Finance Expense maker-checker, report, and reversal pass.
- Payroll Maker → independent Approver → Mark Paid → one Finance Expense passes.
- Real Payslip generation, Employee-only access, private download, and recovery
  pass.
- Onboarding, Recruitment, Leave, and menu permission regressions pass.
- Disabled and direct-route gates fail closed.
- Cross-Company and cross-Branch checks pass.
- Manual concurrency and idempotency checks produce no duplicate business/file
  state.
- Every P0/P1 defect is fixed and retested.
- Remaining P2 defects have an accepted disposition.
- No mock provider is represented as real evidence.
- Business, technical, security, and infrastructure owners sign the evidence.

Required sign-offs:

```text
Project business owner:             Pending
Finance business owner:             Pending
Payroll/HR business owner:          Pending
Security reviewer:                  Pending
Infrastructure/storage owner:       Pending
Technical release owner:            Pending
Final production decision:          NO-GO until all required evidence passes
```

