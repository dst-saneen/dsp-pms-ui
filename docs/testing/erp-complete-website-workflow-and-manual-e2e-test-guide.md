# ERP Complete Website Workflow and Manual End-to-End Test Guide

**Document status:** Ready to use; every result starts as Not Run  
**Audience:** New users, business testers, module owners, and technical reviewers  
**Application:** HRMS/ERP web application  
**Frontend when run locally:** http://localhost:3200  
**Backend when run locally:** http://localhost:4500  
**Required test target:** an explicitly approved non-production database and schema, using a completely new tenant  
**Last read-only status target:** dsp_erp_dev / dsp_pms  
**Last documentation review:** 24 August 2026

---

## 1. Why this guide exists

This document has two purposes:

1. Teach a normal user how the website works from login through the complete
   business lifecycle.
2. Provide a manual end-to-end test that proves each visible workflow works
   with the correct user, status, permission, Company, Branch, and Department.

The guide is intentionally written in business order. It does not begin with
API endpoints or database tables. Every workflow explains:

- who performs the action;
- what must already exist;
- where to click;
- what values to enter;
- what status should appear;
- who must act next;
- where the next person finds the work;
- what evidence to capture;
- when the test is considered passed.

A successful build does not mean these workflows passed. Do not change a test
result from Not Run until the steps were executed against the approved test
environment.

---

## 2. The whole application in one flow

Use this order. Later modules depend on earlier modules.

    Register and verify organization
        ↓
    Company Group → Company → Branch → Department → Designation → Shift
        ↓
    Employees → User invitations → Employee links → Roles and scope
        ↓
    Business Calendar → Work Schedule
        ↓
    Recruitment → Candidate → Interview → Offer → Signed offer
        ↓
    Convert Candidate → Employee invitation → Employee login
        ↓
    Onboarding Template → Department queues → Asset fulfilment
        ↓
    Complete Onboarding → Probation → Active Employee
        ↓
    Attendance → Leave → Overtime → Comp-off
        ↓
    Project → Team → Tasks → Timesheets
        ↓
    Office Finance → Income/Expense/Transfer → Approval → Reports
        ↓
    Payroll → Calculate → Approve → Pay → Finance expense → Payslip
        ↓
    Dashboard → My Workspace → Notifications → Operations monitoring

If a later page is empty, return to the earlier dependency. For example:

| Missing prerequisite                         | What will normally fail or remain empty                   |
| -------------------------------------------- | --------------------------------------------------------- |
| Company or Branch                            | Almost every business module                              |
| Department                                   | Onboarding queues, Asset grants, and reporting            |
| Designation                                  | Recruitment, Onboarding assignment, and Leave policy rows |
| Employee-to-User link                        | My Workspace and personal actions                         |
| Reporting Manager                            | Leave, Project timesheet, and Manager approvals           |
| Published Calendar and Roster                | Attendance and correct working-day rules                  |
| Published Onboarding Template                | Automatic Onboarding start                                |
| Asset Type and available Asset               | Onboarding Asset task fulfilment                          |
| Finance setup                                | Office Finance transactions and Payroll payment           |
| Salary revision and payroll-ready attendance | Payroll calculation                                       |

---

## 3. What is covered

### 3.1 Public and authentication pages

- Login, logout, password change, forgot password, and reset password
- Organization registration and OTP verification
- Invitation inspection and acceptance
- Organization onboarding wizard
- Public Careers pages
- Public Candidate Application
- Candidate Offer response and signed-offer upload

### 3.2 Administration

- Company Groups, Companies, Branches, Departments, Designations, and Shifts
- Business Calendar, versions, events, imports, preview, and impacts
- Users, Roles, Permissions, role scope, and Sessions
- Document retention and file operations

### 3.3 Human Resources

- Employees, profile, career, status, and salary tab
- Recruitment dashboard, Openings, Applications, Candidates, Interviews,
  Offers, Delivery, conversion, invitation, and Probation
- Onboarding Templates and Employee Onboarding
- Employee Document Categories, Types, Documents, verification, and downloads
- Work Schedule, Attendance, exceptions, regularization, and period closing
- Leave Types, Policies, Balances, Requests, Calendar, Holidays, and Comp-off
- Overtime
- Payroll Lite

### 3.4 Assets, Projects, Finance, and Operations

- Asset Categories, Types, Assets, licences, employee custody, Custodian Inbox,
  transfers, Department grants, clearance, and waivers
- Project Lite, Stages, Team, Tasks, secure attachments, employee task work,
  personal timesheets, and team timesheet approval
- Office Finance setup, transactions, attachments, approvals, reversals, and
  operational reports
- Delivery Queue, Delivery detail, dead letters, suppressions, recipient
  exceptions, and File Operations
- Dashboard, My Workspace, notifications, and Manager summaries

### 3.5 Explicitly not treated as usable modules

The following must be displayed as deferred or unavailable, not silently
treated as passed:

- Project resource forecasting at /projects/resources
- General Settings landing page where it remains planned
- Full double-entry accounting and statutory Finance
- Automated bank payments and statutory Payroll filings
- Generic workflow-engine administration without an accepted UI
- CRM, procurement, BIM operations, training, and full analytics
- The internal design-system page as a business workflow

If an API exists but the required normal-user UI is missing, record a product
gap. Do not use an API-only result to claim that the website workflow passed.

---

## 4. Safety rules for the current UAT schema

The test will use the existing approved UAT database and schema but must create
new tenant data.

1. Create a unique execution ID in the form UAT-E2E-YYYYMMDD-NN.
2. Put the execution ID in every new organization name, description, email
   alias, test reference, Project, Finance description, and evidence folder.
3. Never reuse an existing Company, Employee, Candidate, Asset, Project,
   Finance transaction, or Payroll run.
4. Never reset, truncate, delete, or directly edit existing business data.
5. Do not apply or resolve a migration as part of this manual test.
6. Use the UI for business data entry.
7. Use database access only for the read-only reconciliation section.
8. Stop if the configured target is production, contains unapproved customer
   data for testing, or reports a pending migration.
9. Never store passwords, OTP values, tokens, cookies, provider secrets, or
   private download URLs in this document or evidence.

On 24 August 2026, a read-only Prisma status check found 136 migrations and
reported the current schema up to date. This is historical evidence only.
Repeat and record the check at the beginning of the actual run.

---

## 5. Test result format

Record one result for every case ID.

| Field        | What to record                           |
| ------------ | ---------------------------------------- |
| Test case    | Exact case ID                            |
| Execution ID | UAT-E2E-YYYYMMDD-NN                      |
| Tester       | Person executing the steps               |
| Build        | Git commit and deployed build            |
| Date/time    | Actual test time                         |
| Persona      | Exact login role used                    |
| Context      | Company Group, Company, and Branch       |
| Input        | Exact test values entered                |
| Expected     | Result stated in this guide              |
| Actual       | What actually happened                   |
| Status       | Not Run, Pass, Fail, Blocked, or N/A     |
| Request ID   | Visible error/request reference          |
| Evidence     | Screenshot, video, or sanitized log path |
| Defect       | Linked defect ID and severity            |
| Retest       | Retest build and result                  |

For a successful critical workflow capture:

- the page and active organization context;
- the generated business code;
- the final status;
- the next-person queue or notification;
- the resulting linked record.

For a failure capture:

- the values entered;
- the complete visible error;
- the browser network status and request ID;
- the role and active organization context;
- a screenshot or short recording.

---

## 6. Before opening the website

### PRE-001 — Record the release

**Who:** Technical tester

1. Record the Git commit and deployment/build identifier.
2. Confirm the working tree used for the deployment is known.
3. Create the execution evidence folder using the execution ID.
4. Record browser name and version.

**PASS when:** Every result can be tied to one build and one execution ID.

### PRE-002 — Check application health

1. Open http://localhost:4500/health/live.
2. Confirm the response status is healthy.
3. Open http://localhost:4500/health/ready.
4. Confirm database and required dependencies are healthy.
5. If object storage or malware scanning is enabled, it must not be reported
   down.

**PASS when:** The backend is live and ready without a required dependency
failure.

### PRE-003 — Read-only migration status

From the backend working directory run:

    pnpm.cmd exec prisma migrate status

Record:

- database name;
- schema name;
- migration count;
- whether any migration is pending.

**PASS when:** The approved UAT target is confirmed and the schema is up to
date. Do not deploy a pending migration from this guide.

### PRE-004 — Confirm real-mode configuration

The authorized environment operator must confirm, without printing secrets:

- email is enabled and development email bypass is off;
- Recruitment frontend mock mode is off;
- public Careers and Recruitment are enabled for the test;
- Delivery V2 is configured for the test Company/Branches;
- File Storage V2 and the scan worker are configured;
- Onboarding V2 and Asset V2 are enabled for the test scope;
- Project Lite, Office Finance Lite, and Payroll Lite are enabled only for the
  test Company;
- required workers are running;
- Redis/session infrastructure is available.

**PASS when:** A real provider/file/business run can be executed. A mocked
result is not final evidence.

---

## 7. Fresh business dataset

Replace <RUN> with the execution ID everywhere.

### 7.1 Tenant A — main happy-path tenant

| Item           | Test value                   |
| -------------- | ---------------------------- |
| Company Group  | E2E Atlas Group <RUN>        |
| Main Company   | E2E Atlas Services <RUN>     |
| Second Company | E2E Atlas Labs <RUN>         |
| Main Branch    | E2E Kochi HQ <RUN>           |
| Second Branch  | E2E Bengaluru Delivery <RUN> |
| Timezone       | Asia/Kolkata                 |
| Currency       | INR                          |

Departments:

- Human Resources
- Information Technology
- Finance
- Projects
- Engineering
- Administration

Designations:

- HR Manager
- Recruiter
- Hiring Manager
- Interview Panel Member
- Project Manager
- Software Engineer
- IT Support Executive
- Finance Officer
- General Employee

Shifts:

| Shift                 | Time        | Break      | Purpose           |
| --------------------- | ----------- | ---------- | ----------------- |
| E2E Day Shift <RUN>   | 09:00–18:00 | 60 minutes | Normal attendance |
| E2E Night Shift <RUN> | 21:00–06:00 | 60 minutes | Overnight test    |

### 7.2 Tenant B — isolation tenant

| Item          | Test value                       |
| ------------- | -------------------------------- |
| Company Group | E2E Beacon Group <RUN>           |
| Company       | E2E Beacon Services <RUN>        |
| Branch        | E2E Beacon Bengaluru <RUN>       |
| Departments   | Human Resources, Engineering, IT |
| Timezone      | Asia/Kolkata                     |

Tenant B records must never appear in Tenant A lists, lookups, downloads,
notifications, or direct-ID responses.

### 7.3 Required Employees and personas

Use controlled inboxes that the tester can access. Do not use example.test for
cases that require real email delivery.

| Persona                  | Employee                     | Department             | Main responsibility         |
| ------------------------ | ---------------------------- | ---------------------- | --------------------------- |
| Organization Owner       | Owner <RUN>                  | Administration         | Tenant administration       |
| HR Manager/Recruiter     | Asha HR <RUN>                | Human Resources        | HR and Recruitment          |
| Hiring/Reporting Manager | Arun Manager <RUN>           | Engineering            | Hiring and approvals        |
| Interviewer              | Maya Panel <RUN>             | Engineering            | Interview evaluation        |
| Project Manager          | Priya PM <RUN>               | Projects               | Project and Task management |
| Existing Employee        | Dev Employee <RUN>           | Engineering            | Self-service and Projects   |
| IT Assigner/Custodian    | Ishan IT <RUN>               | Information Technology | Onboarding and Assets       |
| Central Asset Manager    | Tara Asset <RUN>             | Information Technology | Asset administration        |
| Finance Maker            | Fathima Maker <RUN>          | Finance                | Draft Finance work          |
| Finance/Payroll Approver | Faisal Approver <RUN>        | Finance                | Independent approval        |
| Payroll Maker            | Pooja Payroll <RUN>          | Human Resources        | Payroll preparation         |
| Read-only Employee       | Rohan Readonly <RUN>         | Administration         | Permission denial           |
| New Joiner               | Created from Candidate <RUN> | Engineering            | Invitation and Onboarding   |
| Beacon HR                | Beacon HR <RUN>              | Human Resources        | Tenant B validation         |
| Beacon Employee          | Beacon Employee <RUN>        | Engineering            | Tenant B self-service       |

The following pairs must use different User accounts:

- Finance Maker and Finance Approver;
- Payroll Maker and Payroll Approver;
- Employee and Reporting Manager;
- Asset waiver requester and approver where two-person approval is required;
- Candidate public session and HR authenticated session.

### 7.4 Calendar, Leave, Asset, Project, Finance, and Payroll data

Calendar:

- Monday–Friday working
- Saturday and Sunday non-working
- one future weekday holiday
- one future half-day event if supported

Leave:

| Code     | Name               |   Entitlement | Special behavior           |
| -------- | ------------------ | ------------: | -------------------------- |
| AL-<RUN> | Annual Leave <RUN> |       18 days | Half-day and carry-forward |
| SL-<RUN> | Sick Leave <RUN>   |       10 days | No carry-forward           |
| UL-<RUN> | Unpaid Leave <RUN> | As configured | Payroll deduction          |
| CO-<RUN> | Comp-off <RUN>     |  Credit based | Uses overtime credit       |

Assets:

| Asset                          | Kind/tracking               | Test purpose          |
| ------------------------------ | --------------------------- | --------------------- |
| E2E Laptop 1 <RUN>             | Hardware / Individual       | Normal assignment     |
| E2E Laptop 2 <RUN>             | Hardware / Individual       | Onboarding fulfilment |
| E2E Access Card <RUN>          | Card / Individual           | Sensitive identifier  |
| E2E Office Location Item <RUN> | General / Location          | Non-employee tracking |
| E2E Design Licence <RUN>       | Software / Pool, capacity 2 | Licence allocation    |

Project:

- E2E Internal Project <RUN>
- E2E Client Project <RUN> when Client Projects are enabled
- Stage: Discovery
- Stage: Delivery
- Task: Prepare requirements
- Task: Build prototype
- Planned task hours: 16
- Employee approved time target: 8 hours

Office Finance:

| Record                   | Test value                               |
| ------------------------ | ---------------------------------------- |
| Customer                 | E2E Client <RUN>                         |
| Vendor                   | E2E Vendor <RUN>                         |
| Income category          | Service Income <RUN>                     |
| Expense category         | Office Expense <RUN>                     |
| Payroll expense category | Payroll Expense <RUN>                    |
| Cash account             | Petty Cash <RUN>, opening 100000 INR     |
| Bank account             | Operating Bank <RUN>, opening 500000 INR |
| Income transaction       | 50000 INR                                |
| Expense transaction      | 12500 INR                                |
| Transfer                 | 20000 INR                                |

Payroll:

| Component                | Direction | Monthly amount |
| ------------------------ | --------- | -------------: |
| Basic Salary <RUN>       | Earning   |      50000 INR |
| Housing Allowance <RUN>  | Earning   |      10000 INR |
| Standard Deduction <RUN> | Deduction |       5000 INR |

### 7.5 Controlled test files

Prepare:

- a clean PDF CV;
- a clean supporting document;
- a clean signed-offer PDF;
- a clean Employee identity document;
- a clean Project attachment;
- a clean Finance receipt;
- a deliberately oversized file;
- a file whose extension does not match its content;
- the standard harmless malware-scanner test signature, only with security-team
  approval and only inside the approved UAT storage path.

Never use real employee, customer, bank, tax, or identity documents.

---

## 8. How a normal user operates the website

### 8.1 Active organization context

Always check the active Company Group, Company, and Branch before creating or
editing data. A correct role in the wrong context may show an empty page or no
action button.

### 8.2 Employee versus User

| Record   | Meaning                                                     |
| -------- | ----------------------------------------------------------- |
| Employee | HR record containing employment and organization details    |
| User     | Login account                                               |
| Role     | Permission set granted to the User                          |
| Scope    | Company Group, Company, or Branch where the Role applies    |
| Link     | Connection from User to Employee, required for My Workspace |

The usual order is:

    Create Employee
        → Invite User
        → Link User to Employee
        → Assign Role and scope
        → User accepts invitation
        → User signs in

### 8.3 Why an action button may be missing

The application uses the current record status and server-provided allowed
actions. Do not expect every role to see the same buttons.

If a button is missing, check:

1. Is the correct Company/Branch active?
2. Does the User have the required scoped role?
3. Is the record in the correct status?
4. Is the User the assigned actor or approver?
5. Is the module enabled for this Company?
6. Did another user already change the record?

After a state-changed or version-conflict error, refresh the record. Do not
repeat the action blindly.

### 8.4 Standard page pattern

- Use the left sidebar to open a module.
- Use search and filters before assuming a record is missing.
- Click the generated code or row to open detail.
- Use tabs for child workflows such as Interviews, Offer, Tasks, or History.
- Use Save for a draft.
- Use Submit or Publish to hand work to the next actor.
- Use the displayed allowed action rather than editing the URL.
- Record the final status before logging out for the next persona.

---

## 9. Foundation workflow — registration to working organization

### AUTH-001 — Login and logout

**Who:** Any invited active User  
**Open:** /login

1. Enter the controlled test email and password.
2. Select Sign in.
3. Confirm the Dashboard or the permitted landing page opens.
4. Confirm the active organization context belongs to the User.
5. Open the User menu and sign out.
6. Use the browser Back button.

**Expected:**

- Login succeeds only with valid credentials.
- The sidebar contains only permitted modules.
- Logout clears the authenticated session.
- Back does not reopen protected data.

**PASS when:** The User can sign in, see only permitted navigation, and cannot
reuse the logged-out session.

### AUTH-002 — Forgot and reset password

**Who:** Active User  
**Open:** /forgot-password

1. Enter the controlled User email.
2. Submit the request.
3. Confirm the page does not disclose whether an unrelated email exists.
4. Open the real reset email.
5. Follow the link to /reset-password.
6. Enter and confirm a valid new password.
7. Sign in with the new password.
8. Attempt to reuse the reset link.

**Expected:** The new password works, the old password fails, and the reset
link cannot be reused.

### AUTH-003 — Change password and sessions

**Who:** Active User  
**Open:** /change-password and the account Sessions view

1. Sign in on two browsers or browser profiles.
2. Change the password from browser A.
3. Review active Sessions.
4. Revoke browser B or use logout-all.
5. Try a protected action in browser B.

**Expected:** Revoked sessions cannot continue to call protected APIs.

### REG-001 — Register a new organization

**Who:** New Organization Owner  
**Open:** /register

1. Enter E2E Atlas Group <RUN> as the organization name.
2. Enter the Owner name and a real controlled inbox.
3. Enter a strong test password kept outside this guide.
4. Submit the registration.
5. Open the received OTP email.
6. Enter the current OTP.

**Expected:** Verification succeeds once and opens /onboarding.

**Negative checks:**

- wrong OTP is rejected;
- expired OTP is rejected;
- resend invalidates the previous OTP;
- the same OTP cannot create a second organization;
- repeated Submit does not create duplicate pending registrations.

### ORG-001 — Complete organization onboarding

**Who:** New Organization Owner  
**Open:** /onboarding

Complete the wizard in order:

1. Confirm Company Group: E2E Atlas Group <RUN>.
2. Set first Company: E2E Atlas Services <RUN>.
3. Set first Branch: E2E Kochi HQ <RUN>.
4. Add Human Resources as the first Department.
5. Add a starting Designation and Shift when offered.
6. Review the summary.
7. Select Finish setup.

**Expected:** The Dashboard opens and the new organization is the active
context.

**Write down:** Generated Group, Company, Branch, Department, Designation, and
Shift codes/IDs where visible.

### ORG-002 — Complete organization master data

**Who:** Organization Owner or Company Administrator

1. Open Administration → Company Groups.
2. Confirm only the new Group is selected for this run.
3. Open Administration → Companies.
4. Create E2E Atlas Labs <RUN> under the same Group.
5. Open Administration → Branches.
6. Edit E2E Kochi HQ <RUN> and set Asia/Kolkata.
7. Create E2E Bengaluru Delivery <RUN>.
8. Open Administration → Departments.
9. Create every Department listed in section 7.1.
10. Open Administration → Designations.
11. Create every Designation listed in section 7.1.
12. Open Administration → Shifts.
13. Create Day Shift and Night Shift using the section 7.1 values.

**Expected:**

- every child record belongs to the selected Company;
- Branch timezone is stored;
- generated codes are unique;
- changing to the second Company does not show first-Company-only records as
  selectable children.

### ORG-003 — Create Tenant B

Use a separate controlled registration/User session.

1. Register E2E Beacon Group <RUN>.
2. Complete E2E Beacon Services <RUN>.
3. Complete E2E Beacon Bengaluru <RUN>.
4. Add Beacon HR and Engineering Departments.
5. Do not assign the Tenant A Owner to Tenant B.

**Expected:** Tenant B has separate codes, Users, and records.

### CFG-001 — Enable pilot modules for the new test scope

**Who:** Authorized environment operator

This is an operational handoff, not a normal business-user action.

1. Capture the generated Tenant A Company and Branch IDs.
2. Add only those IDs to the configured Recruitment shortlist, Delivery,
   File Storage, Onboarding, Asset, Project, Finance, and Payroll pilot
   allowlists.
3. Keep Tenant B disabled for feature-gate negative cases unless a specific
   Tenant B module test requires temporary enablement.
4. Restart the backend/frontend/workers using the approved deployment process.
5. Sign in as a linked Tenant A Employee.
6. Check /me/module-capabilities through the browser network panel.

**Expected:** Enabled modules appear for Tenant A with the correct permission.
They remain unavailable for a non-allowlisted Company.

---

## 10. People, Users, Roles, and security

### EMP-001 — Create Employees in dependency order

**Who:** HR Manager  
**Open:** Human Resources → Employees → New

Create Employees in this order:

1. Hiring/Reporting Manager.
2. HR Manager/Recruiter.
3. Interviewer.
4. Project Manager.
5. IT Assigner/Custodian.
6. Central Asset Manager.
7. Finance Maker.
8. Finance/Payroll Approver.
9. Payroll Maker.
10. Existing Employee.
11. Read-only Employee.

For every Employee:

1. Confirm E2E Atlas Services <RUN> is selected.
2. Choose the correct Branch.
3. Choose the correct Department and Designation.
4. Enter controlled contact data.
5. Set the Reporting Manager where required.
6. Save.
7. Record the generated Employee code.

**Expected:** The list, preview, and detail page show the same organization
relationships.

### EMP-002 — Employee validation

1. Try selecting a Department from another Company through a stale or direct
   request.
2. Try a duplicate Employee identity that the product prevents.
3. Omit mandatory names or organization fields.
4. Open the saved Employee detail.
5. Edit an allowed field and save.

**Expected:** Invalid relationships are rejected and the valid update appears
in list, preview, detail, and audit/career history where applicable.

### SEC-001 — Invite and link Users

**Who:** Organization Owner or User Administrator  
**Open:** Administration & Security → Users

For each persona:

1. Select Invite/Create User.
2. Enter the controlled inbox.
3. Link the matching Employee.
4. Select the required system or custom Role.
5. Set Company or Branch scope.
6. Send the invitation.
7. Record the delivery status without copying the token.

The recipient then:

1. Opens the real invitation email.
2. Follows /accept-invitation.
3. Sets a password.
4. Signs in.
5. Opens My Workspace.

**Expected:** My Workspace identifies the linked Employee. The invitation is
single-use.

### SEC-002 — Assign roles for the complete workflow

Use system roles where they supply the required permissions. Create a scoped
custom role only when separation of duties requires it.

Minimum responsibilities:

| Persona          | Required capability                                      |
| ---------------- | -------------------------------------------------------- |
| HR Manager       | Employees, Recruitment, Onboarding, Documents, Workforce |
| Hiring Manager   | Team/hiring decision and reporting-manager actions       |
| Interviewer      | Own interview evaluation                                 |
| IT Assigner      | Department Onboarding queue and Asset Department work    |
| Asset Manager    | Asset taxonomy/inventory/custody                         |
| Project Manager  | Project manage, task work, timesheet approve             |
| Project Employee | Project task work and timesheet submit                   |
| Finance Maker    | Finance read/manage without approval                     |
| Finance Approver | Finance approve/reverse                                  |
| Payroll Maker    | Payroll read/manage without approval                     |
| Payroll Approver | Payroll approve and payment                              |
| Employee         | Self-service and own payslips                            |

After each assignment:

1. Log out and sign back in.
2. Confirm permitted navigation appears.
3. Confirm prohibited navigation and actions do not appear.
4. Attempt one prohibited direct URL.

**Expected:** Hiding the menu is not the only protection; the API denies the
unauthorized request.

### SEC-003 — User status and owner protection

1. Disable the Read-only User.
2. Try its existing session and a new login.
3. Re-enable only if needed for later tests.
4. Attempt to remove or disable the final Organization Owner.

**Expected:** Disabled access stops, and the last Owner cannot be removed.

---

## 11. Business Calendar, Shifts, and Work Schedule

### CAL-001 — Create and publish the Company calendar

**Who:** HR/Calendar Manager  
**Open:** Administration → Business Calendar

1. Select E2E Atlas Services <RUN>.
2. Open or ensure the Company calendar.
3. Create a new Draft version.
4. Open the version.
5. Set Monday–Friday working.
6. Set Saturday and Sunday non-working.
7. Add the future weekday holiday from section 7.4.
8. Save.
9. Submit for review if the action is available.
10. Publish using an authorized different reviewer where required.

**Expected:** The version becomes Published/current and is read-only.

### CAL-002 — Preview and runtime use

**Open:** Administration → Business Calendar → Preview

1. Select E2E Kochi HQ <RUN>.
2. Preview the holiday date.
3. Preview a normal weekday.
4. Preview a weekend.

**Expected:** Each day resolves to the correct working/non-working result and
Branch timezone.

### CAL-003 — Import and impact handling

**Open:** Business Calendar → Imports

1. Download the import template.
2. Add one valid future event and one invalid row.
3. Upload.
4. Validate the batch.
5. Confirm the invalid row is explained.
6. Select only valid rows.
7. Apply them to a Draft.
8. Review the resulting events before publishing.

After publishing an amendment:

1. Open Business Calendar → Impacts.
2. Review affected Attendance, Leave, or Roster records.
3. Resolve/acknowledge only after checking the affected business record.

**Expected:** Invalid rows are not silently published and impacts remain
traceable.

### SCH-001 — Create and publish Work Schedule

**Who:** HR Schedule Manager  
**Open:** Human Resources → Work Schedule

1. Confirm E2E Day Shift <RUN> exists.
2. Select E2E Atlas Services and E2E Kochi HQ.
3. Create or open a Draft roster for a short future period.
4. Run generation as a dry run.
5. Confirm the planned Employee/date count is greater than zero.
6. Commit generation.
7. Review the generated Employee entries.
8. Apply one authorized shift override if supported.
9. Publish the roster.

**Expected:** The roster becomes live, Employees see the schedule, and later
Attendance uses it.

**Common issue:** Zero generated entries normally means no eligible active
Employees, no resolvable shift, wrong Branch, or missing calendar coverage.

---

## 12. Recruitment — vacancy to accepted offer

### REC-001 — Create a Job Opening Draft

**Who:** HR Recruiter  
**Open:** Human Resources → Recruitment → Dashboard, then Openings  
**Direct page:** /hr/recruitment/openings

1. Select New Opening.
2. Enter title: Software Engineer <RUN>.
3. Select E2E Atlas Services, E2E Kochi HQ, Engineering, and Software Engineer.
4. Select Arun Manager <RUN> as Hiring Manager.
5. Set approved headcount to 1.
6. Enter employment type, location, target joining date, and future
   application deadline.
7. Add at least one required evaluation criterion.
8. Save.

**Expected:** A generated Opening code appears with status Draft.

### REC-002 — Publish the Opening

1. Open the Draft.
2. Open Publication Checklist.
3. Confirm every blocker is resolved.
4. Select Publish.
5. Open the Recruitment dashboard.

**Expected:** Status changes to Open, dashboard Open Positions increases, and
the opening becomes public.

Negative checks:

- publish without Hiring Manager;
- publish without valid future deadline;
- publish with invalid headcount;
- publish using another Company’s Department/Designation ID.

### REC-003 — Public Candidate applies

**Who:** External Candidate in a signed-out browser  
**Open:** /careers/[companyCode]

1. Confirm only E2E Atlas public Openings appear for the Company code.
2. Open Software Engineer <RUN>.
3. Select Apply.
4. Enter Candidate first/last name, controlled email, phone, and cover note.
5. Upload the clean PDF CV.
6. Add the clean supporting document if the form supports it.
7. Wait for upload/finalization status.
8. Submit once.

**Expected:**

- one Candidate and one Application are created;
- the Application has a generated number and Applied status;
- the CV is initially pending scan and later Clean;
- the Candidate receives the configured acknowledgement;
- no private storage URL is exposed.

### REC-004 — Public Application file failures

Repeat with separate controlled Candidate aliases:

1. Try submitting without a required CV.
2. Try the oversized file.
3. Try a mismatched extension/content file.
4. With security approval, upload the malware-scanner test signature.
5. Refresh the upload state.

**Expected:**

- missing/invalid uploads block submission;
- infected content becomes quarantined/unavailable;
- HR cannot download or use a non-Clean file;
- no partial public Application survives when required file finalization fails.

### REC-005 — HR reviews Candidate and Application

**Who:** HR Recruiter  
**Open:** Recruitment → Applications

1. Search by Candidate email or Application number.
2. Open the Application.
3. Review Overview, Documents, Interviews, Evaluations, Offer, and Timeline
   tabs.
4. Open View candidate profile.
5. Return to the Application.
6. Select Shortlist.
7. Confirm status Shortlisted.
8. Select Start screening.
9. Confirm status Screening.
10. Select Advance to interview.

**Expected:** Every transition appears once in Timeline and only currently
authorized buttons remain.

### REC-006 — Schedule and evaluate Interview

**Who starts:** HR Recruiter  
**Where:** Application detail → Interviews tab

1. Add an Interview round.
2. Select mode, future date/time, duration, and meeting/location details.
3. Add Maya Panel <RUN> to the panel.
4. Save.
5. Confirm the Interview notification/email delivery.

**Who acts next:** Interview Panel Member

1. Sign in as Maya Panel.
2. Open the Interview from the notification/deep link or the available
   Recruitment work surface.
3. Save an evaluation Draft.
4. Confirm HR cannot treat the Draft as submitted.
5. Submit the evaluation.

**Who acts next:** HR Recruiter

1. Open the Application Interviews/Evaluations tabs.
2. Confirm Submitted evaluation.
3. Mark the Interview complete.
4. Select Advance to manager review.

**Expected:** Manager Review remains blocked until required evaluation and
Interview completion exist.

Additional cases:

- reschedule produces history and notification;
- cancel records a reason and prevents completion;
- another Employee cannot submit the panel member’s evaluation;
- a submitted evaluation is not silently overwritten.

### REC-007 — Hiring Manager selects the Candidate

**Who:** Hiring Manager  
**Open:** Recruitment/Application or hiring-comparison deep link

1. Review Manager Review candidates.
2. Open comparison/readiness information.
3. Select the Candidate.
4. Confirm the Application becomes Selected.
5. Confirm headcount reservation/remaining values are correct.

**Expected:** Only an eligible Hiring Manager can select; HR monitor access
alone does not replace Manager authority where the workflow requires it.

### REC-008 — Prepare and send the Offer

**Who:** Authorized HR Offer user  
**Open:** Application detail → Offer

1. Select Prepare offer.
2. Enter role title, Reporting Manager, employment type, joining date,
   compensation, currency, period, probation days, expiry date, and terms.
3. Save Draft.
4. Select Preview and inspect the generated content.
5. Correct any incorrect organization snapshot.
6. Select Send offer and confirm.

**Expected:**

- Offer changes from Draft to Sent;
- Application changes to Offer Sent;
- one versioned Offer is visible;
- delivery state begins Queued/Sent according to worker progress;
- the Candidate receives one usable Offer link.

Do not use a mock response link as final evidence.

### REC-009 — Candidate reviews and signs the Offer

**Who:** Candidate in a signed-out browser  
**Open:** Real Offer email link to /offer-response

1. Open the Offer link.
2. Confirm Company, role, joining date, compensation, expiry, and terms.
3. Confirm another Candidate’s details are not visible.
4. Upload the clean signed-offer PDF.
5. Wait for Clean scan status.
6. Accept the Offer.
7. Attempt to submit again with the same link.

**Expected:** Acceptance succeeds once, the signed file remains private, and
replay/tampered/expired links are rejected safely.

### REC-010 — HR verifies signed Offer

**Who:** Authorized HR verifier  
**Open:** Application detail → Offer → Signature submissions

1. Open the pending clean submission.
2. Inspect through the authorized short-lived download.
3. Test Reject with a reason on a separate submission if needed.
4. Request resubmission and confirm a new single-use Candidate link.
5. For the happy path, select Verify.

**Expected:** The verified signed Offer satisfies Ready-to-Hire preflight.

---

## 13. Email, notifications, and Delivery monitoring

### DEL-001 — Confirm Candidate delivery

**Who:** HR Recruiter  
**Open:** Recruitment → Delivery

1. Filter by the Candidate email or related Application/Offer.
2. Open the Delivery record.
3. Review message status and attempt timeline.
4. Confirm the template/event relates to the correct Company and Branch.
5. Confirm the Candidate inbox received the message.
6. If provider webhooks are configured, wait for the final Delivered,
   Bounced, or Complaint status.

**Expected:** The UI, provider evidence, and inbox result agree. Provider
acceptance alone must not be described as inbox delivery.

### DEL-002 — Delivery retry and deduplication

Use a controlled failure condition approved by the environment operator.

1. Produce one retryable Delivery failure.
2. Confirm status enters Retry Wait or the equivalent retryable state.
3. Use Retry only when the server offers the action.
4. Double-click or repeat the same retry operation.
5. Review attempts.

**Expected:** Attempts are durable, one logical command is applied, and no
duplicate business email is created by repeated input.

### DEL-003 — Suppression, bounce, and complaint

**Who:** Platform Operations  
**Open:** Operations → Suppressions and Delivery Queue

1. Locate a controlled suppressed/bounced recipient.
2. Confirm ordinary HR cannot see private platform-only details.
3. Release a suppression only with the required authority and reason.
4. Confirm subsequent delivery follows the new suppression state.
5. Verify no cross-Company recipient data is exposed.

### DEL-004 — Dead letter and recipient exception

**Open:** Operations → Dead Letters

1. Locate a deliberately exhausted Delivery item.
2. Open its detail and attempts.
3. Confirm the failure is safe and does not reveal full private content.
4. Review any recipient exception.
5. Resolve/dismiss only with a recorded operational reason.
6. Retry only if the underlying recipient/configuration issue was corrected.

**PASS when:** Failed delivery is observable and recoverable without manually
editing business tables.

---

## 14. Recruitment conversion, Employee invitation, and career

### HIRE-001 — Run Ready-to-Hire preflight

**Who:** HR Manager  
**Open:** Application detail → Offer → Ready to Hire

1. Confirm the Application is Offer Accepted.
2. Confirm the signed Offer is verified.
3. Open conversion preflight.
4. Review Company, Branch, Department, Designation, Reporting Manager,
   joining date, headcount, duplicate Employee, and Onboarding readiness.
5. Correct every blocker through the owning screen.
6. Refresh preflight.

**Expected:** Convert becomes available only when mandatory preconditions pass.
Warnings remain visible without being mistaken for blockers.

### HIRE-002 — Convert Candidate

1. Select Convert/Create Employee.
2. Confirm the operation once.
3. Wait for the final result; do not refresh during the active request.
4. Open the resulting Employee detail.
5. Search the Employee list using generated Employee code.
6. Open the Application Timeline.

**Expected:**

- exactly one Employee is created;
- creation source is Recruitment;
- the Application becomes Hired;
- headcount used/reserved values reconcile;
- Recruitment documents are mapped according to the approved rules;
- Employee career events include Application/Offer/Employee creation;
- Onboarding starts or is ready to start according to the resolved template;
- invitation delivery is queued without rolling back the Employee if provider
  delivery later fails.

### HIRE-003 — Conversion replay and conflict

1. Repeat Convert using the original browser state.
2. Try converting the same Application from a second session.
3. Search Employees and active Onboardings.

**Expected:** The original safe result is replayed or a stable already-converted
response is returned. No duplicate Employee, source conversion, active
Onboarding, invitation, or headcount consumption is created.

### HIRE-004 — New Employee accepts invitation

**Who:** New Joiner

1. Open the real invitation email.
2. Select the invitation link.
3. Inspect the invited email/organization.
4. Set a test password.
5. Sign in.
6. Open My Workspace.
7. Open My Workspace → Onboarding.

**Expected:** The User is linked to the converted Employee and can see only
personal data and assigned work.

If invitation delivery failed:

1. HR opens the conversion/Employee delivery status.
2. Use the supported Retry/Resend action.
3. Confirm a new invitation is delivered.
4. Confirm an old/superseded token is rejected.

### CAR-001 — Review career timeline

**Who:** HR Manager  
**Open:** Employee detail → Career

Confirm the timeline includes, in order:

- Application submitted;
- interviews completed;
- selected;
- Offer accepted;
- Employee created;
- Onboarding started when applicable.

Later chapters will add Onboarding completed, Probation started, and Probation
confirmed.

---

## 15. Onboarding Template authoring

### ONT-001 — Create or open the Designation Template

**Who:** HR Onboarding administrator  
**Open:** Human Resources → Onboarding Templates

1. Select E2E Atlas Services and E2E Kochi HQ.
2. Locate Software Engineer.
3. Create/open its current Draft Template.
4. Confirm the Template is Company-safe and tied to the concrete Branch when
   Department work is used.
5. Record Template code and Draft version.

**Expected:** Published history and current Draft are distinguishable.

### ONT-002 — Add Department slices and Task Groups

Use the Templates list and Department designer:

1. Select Add Department.
2. Add Human Resources.
3. Add Information Technology.
4. Open Human Resources.
5. Select Add Task Group and create Pre-joining.
6. Create Day 1.
7. Open Information Technology and create Equipment.

**Expected:** Department ownership is inherited from the enclosing Department;
the user is not asked to select a named Employee in the Template.

### ONT-003 — Add the execution tasks

Create this test Template:

| Order | Department/group | Task                    | Owner      | Type      | Mandatory |
| ----: | ---------------- | ----------------------- | ---------- | --------- | --------: |
|     1 | HR / Pre-joining | Verify Employee profile | Department | Checklist |       Yes |
|     2 | HR / Day 1       | Policy acknowledgement  | Employee   | Checklist |       Yes |
|     3 | HR / Day 1       | Manager welcome meeting | Manager    | Checklist |       Yes |
|     4 | IT / Equipment   | Create business email   | Department | Checklist |       Yes |
|     5 | IT / Equipment   | Assign laptop           | Department | Asset     |       Yes |
|     6 | HR / Day 1       | Office introduction     | Department | Checklist |        No |

For Assign laptop:

1. Select Asset as work type.
2. Select the Laptop Asset Type.
3. Confirm its tracking mode is Individual.

Configure dependencies:

- Create business email depends on Verify Employee profile.
- Assign laptop depends on Verify Employee profile.
- Manager welcome depends on Create business email.

Allow skip only for Office introduction. Do not make a skippable task a
prerequisite.

### ONT-004 — Validate and publish

1. Select Validate.
2. Review every field-level error.
3. Correct unsupported owner, missing Asset Type, dependency, or Branch errors.
4. Run Validate again.
5. Select Publish.
6. Confirm the publish dialog.
7. Refresh.

**Expected:** Version becomes Published and cannot be edited directly. Create a
new Draft version for later changes.

### ONT-005 — Configure automatic resolution

Configure:

1. Software Engineer Designation default → published Template.
2. E2E Kochi HQ Branch override only if testing override precedence.
3. Effective dates covering the New Joiner start date.

**Expected:** Normal Onboarding start resolves Branch override first, otherwise
Designation default. A normal HR start form does not ask the user to choose an
arbitrary Template.

Negative checks:

- named Employee or Designation task owner is rejected;
- Asset task using Location tracking is rejected;
- Department from another Branch/Company is rejected;
- dependency cycle is rejected;
- published hierarchy cannot be edited;
- two overlapping effective assignments cannot both become valid.

---

## 16. Employee Onboarding execution

### ONB-001 — Preflight and start

**Who:** HR Manager  
**Open:** Human Resources → Employee Onboarding

If Recruitment conversion already started Onboarding, open that record and
confirm the resolution. Otherwise:

1. Select Start Onboarding.
2. Choose the New Joiner.
3. Enter the start date.
4. Wait for preflight.
5. Review resolved Template, Version, resolution source, Department summary,
   blockers, and warnings.
6. Select Start Onboarding.

**Expected:**

- one active Onboarding is created;
- Employee and Manager tasks are assigned automatically;
- Department tasks enter their Department queues unassigned;
- task dependencies and organization snapshots are visible;
- no named Template assignee is used.

### ONB-002 — HR monitoring

**Who:** HR Manager  
**Open:** Employee Onboarding → New Joiner detail

Review:

- Template snapshot and resolution source;
- overall progress;
- Department progress;
- mandatory remaining;
- unassigned tasks;
- due soon/overdue tasks;
- blocked reasons;
- available Onboarding actions.

Normal HR monitor access must not give buttons to complete another Department’s
task.

### ONB-003 — Department queue assignment

**Who:** IT Department assigner  
**Open:** My Workspace → Onboarding → Department Queue

1. Filter Unassigned.
2. Open Create business email.
3. Select Assign.
4. Choose Ishan IT <RUN>.
5. Confirm.
6. Assign the laptop task to an eligible IT/Asset worker.
7. Try selecting an Employee from another Department or Branch.

**Expected:** Only active, User-linked Employees in the same Company, Branch,
and executor Department are selectable.

### ONB-004 — Complete normal assigned tasks

**Who:** Current assignee  
**Open:** My Workspace → Onboarding → My Tasks

For Verify Employee profile and Create business email:

1. Open the task.
2. Review dependency and due state.
3. Select Start.
4. Enter remarks if available.
5. Select Complete.

For the New Joiner:

1. Sign in as New Joiner.
2. Open Policy acknowledgement.
3. Start and complete it.

For the Reporting Manager:

1. Sign in as Arun Manager.
2. Open Manager welcome meeting.
3. Confirm it is blocked until Create business email is complete.
4. Start and complete after the dependency passes.

**Expected:** Only the current assignee can perform normal Start/Complete.

### ONB-005 — Fulfil the Asset task

**Who:** Assigned IT/Asset custodian  
**Open:** My Workspace → Onboarding → Assign laptop

1. Select Fulfil Asset.
2. Review eligible Assets.
3. Confirm E2E Laptop 2 <RUN> is available and correct Company/Branch.
4. Select the Asset and effective date.
5. Confirm fulfilment.
6. Open Asset Management → Assigned to employees.

**Expected:**

- the task completes only after Asset assignment succeeds;
- the task shows a real Employee Asset result;
- Asset custody shows the New Joiner;
- the same physical Asset cannot be assigned twice;
- audit and notification evidence exists.

### ONB-006 — Optional skip, reopen, and waiver

1. As assigned actor, skip Office introduction with a reason.
2. As permitted Department assigner, reopen a completed/skipped Department
   task when allowed.
3. Confirm completed dependents are handled by reopen preflight.
4. As HR Override user, waive a controlled mandatory task with a mandatory
   reason.
5. Confirm an ordinary HR monitor cannot waive it.

**Expected:** History records actor, authority mode, reason, prior status, new
status, and attempt.

### ONB-007 — Complete Onboarding

**Who:** HR final completer

1. Open completion preflight.
2. Attempt completion while one mandatory task remains.
3. Confirm it is blocked and identifies the task.
4. Complete or waive every mandatory task.
5. Leave one optional task unfinished for the auto-skip case.
6. Open completion preflight again.
7. Confirm Probation will start.
8. Select Complete.

**Expected:**

- unfinished optional work is auto-skipped with system evidence;
- progress becomes 100%;
- Onboarding becomes Completed;
- Recruitment-created Employee enters Probation;
- career events show Onboarding Completed and Probation Started;
- audit and notifications are produced together.

### ONB-008 — Confirm Probation to Active

**Who:** Authorized HR user  
**Open:** Recruitment dashboard/probation-due or Employee detail

1. Locate the probation Employee when eligible.
2. Review the required decision/evidence.
3. Select Confirm Active.
4. Open Employee detail and career timeline.

**Expected:** Employment status becomes Active and Probation Confirmed is
recorded once.

---

## 17. Employee Documents and secure downloads

### DOC-001 — Configure Categories and Types

**Who:** HR Document administrator

1. Open HR → Employee Documents → Categories.
2. Create Identity <RUN>, Employment <RUN>, and Qualification <RUN>.
3. Open Document Types.
4. Create Passport <RUN> requiring number, expiry, and verification.
5. Create Degree Certificate <RUN> as lifetime/no expiry.

**Expected:** Types appear only in the correct Company.

### DOC-002 — Upload and verify an Employee document

1. Open HR → Employee Documents.
2. Create a Passport record for the New Joiner.
3. Enter controlled fake number, issue date, and future expiry.
4. Upload the clean Employee identity PDF.
5. Wait for Clean scan status.
6. Open the document.
7. Verify as an authorized HR user.
8. Request download and open it.
9. Wait beyond or simulate expiry of the short-lived grant and retry the same
   link.

**Expected:** Verified metadata and file remain Company/Employee scoped; the
expired download link fails.

### DOC-003 — Reject and reset

1. Create another controlled document.
2. Reject it with a reason.
3. Confirm history and status.
4. Reset/re-submit only when the supported action appears.
5. Confirm a User from Tenant B cannot open the record or download the file.

### DOC-004 — Recruitment-to-Employee mapping

Open the New Joiner’s Employee Documents and compare with Recruitment files.

**Expected:** Only approved/mapped Recruitment documents appear. There is no
duplicate File Object and no access to quarantined or unsuccessful-candidate
files.

---

## 18. Attendance

### ATT-001 — Employee check-in and check-out

**Who:** Existing Employee  
**Before:** Published roster for today  
**Open:** My Workspace

1. Review Today’s schedule.
2. Select Check in.
3. Refresh and confirm time/status.
4. Attempt a second Check in.
5. Select Check out when appropriate.
6. Attempt a second Check out.

**Expected:** One valid attendance record exists and duplicate punches are
rejected safely.

### ATT-002 — HR daily view and exceptions

**Who:** HR Attendance user  
**Open:** HR → Attendance

1. Filter to E2E Kochi HQ and today.
2. Open the Existing Employee record.
3. Compare scheduled and actual times.
4. Open Attendance → Exceptions.
5. Review late, missing punch, insufficient-hours, or shift-mismatch items
   produced by controlled data.

**Expected:** Exception reason matches the published schedule, Calendar, and
Branch timezone.

### ATT-003 — Regularization

**Who starts:** Employee

1. Submit a regularization for a controlled missing punch.
2. Enter requested times and reason.

**Who acts next:** Reporting Manager/HR approver

1. Open the regularization queue.
2. Review source punches and requested correction.
3. Approve one case.
4. Reject another with a reason.
5. Confirm Employee cannot approve own request.

### ATT-004 — HR correction and permission denial

1. As authorized HR, correct a controlled Attendance record with a reason.
2. As Read-only Employee, attempt the direct correction URL/request.

**Expected:** Correction is audited and unauthorized mutation is denied.

### ATT-005 — Attendance period lifecycle

**Open:** HR → Attendance → Period Closing

For the Payroll test month:

1. Create/open the period.
2. Move Open to Review.
3. Resolve required exceptions.
4. Lock.
5. Mark Payroll Pending/payroll-ready.
6. Do not Close until Payroll source requirements are captured.
7. After Payroll testing, Close.
8. Test authorized Reopen with reason where allowed.

**Expected:** Locked/payroll-ready periods prevent unauthorized source changes.

### ATT-006 — Night Shift

Assign one controlled Employee to E2E Night Shift <RUN> and test a punch across
midnight.

**Expected:** Work date, duration, late/early calculations, and Branch timezone
are correct.

---

## 19. Leave

### LEV-001 — Configure Leave Types and Policies

**Who:** HR Leave administrator

1. Open Leave → Types.
2. Create the four test Leave Types from section 7.4.
3. Open Leave → Policies.
4. Select E2E Atlas Services and E2E Kochi HQ.
5. Configure Software Engineer and other needed Designation rows.
6. Set entitlement, half-day, carry-forward, maximum consecutive days, and
   negative-balance rules.
7. Save with a reason.

**Expected:** Invalid enabled zero entitlement or unsupported combinations are
rejected.

### LEV-002 — Generate Employee balances

**Open:** Leave → Employee Leave Balance

1. Select current year and E2E Atlas Services.
2. Run a dry run.
3. Review To create, To update, and warnings.
4. Apply only after the dry run is correct.
5. Refresh and open Existing Employee.

**Expected:** Entitlements match the published policy and no duplicate balance
is created by rerun.

### LEV-003 — Employee request and two-stage approval

**Who starts:** Existing Employee  
**Open:** My Workspace → Leave/Apply Leave

1. Create a Draft Annual Leave request on working days.
2. Save.
3. Edit the Draft.
4. Submit.
5. Confirm pending balance increases.

**Who acts next:** Reporting Manager

1. Open HR → Leave → Requests/Manager review.
2. Approve once.
3. Confirm a repeated decision fails or no longer appears.

**Who acts next:** HR final approver

1. Open HR review.
2. Approve.
3. Confirm status Approved.
4. Confirm pending decreases and used balance increases.

### LEV-004 — Leave negative cases

Run separate controlled requests:

- half-day valid request;
- overlapping request;
- insufficient balance;
- request entirely on weekend/holiday;
- too many consecutive days;
- Employee self-approval attempt;
- foreign Employee/Leave Type direct ID;
- cancellation before and after approval according to allowed actions;
- rejection with a reason.

### LEV-005 — Calendar and Attendance reconciliation

1. Open Leave → Calendar.
2. Confirm Approved Leave appears for the correct Employee/team.
3. Confirm Tenant B records do not appear.
4. Confirm Attendance treats approved Leave according to policy.

---

## 20. Overtime and Comp-off

### OVT-001 — Calculate and submit Overtime

**Who:** Employee or HR according to configured workflow  
**Open:** HR → Overtime

1. Select an eligible completed Attendance day with extra time.
2. Calculate Overtime.
3. Review raw time, rounding, eligible minutes/hours, and warnings.
4. Submit.

**Expected:** Status moves through Calculated to Submitted without duplicate
requests for the same source.

### OVT-002 — Approve and settle

**Who:** Manager/HR Overtime approver

1. Open the submitted request.
2. Approve one case.
3. Reject another with reason.
4. Settle the approved case to Comp-off.
5. Create another approved case settled to Payroll Pending.

**Expected:** Settlement occurs once and the source is immutable afterward.

### CO-001 — Use Comp-off credit

**Open:** HR → Leave → Comp-off and Employee Leave request

1. Confirm the settled Comp-off credit is Available.
2. Create a Comp-off Leave request.
3. Submit.
4. Confirm credit becomes Reserved.
5. Approve the Leave.
6. Confirm credit becomes Used/Consumed.

Additional checks:

- rejected/cancelled Leave releases reservation;
- expired credit cannot be used;
- authorized revocation records a reason;
- another Employee cannot use the credit.

---

## 21. Asset V2

### AST-001 — Create Categories and Types

**Who:** Central Asset Manager

1. Open Asset Management → Categories.
2. Create IT Equipment <RUN>, Access <RUN>, and Software <RUN>.
3. Open Types.
4. Create Laptop as Hardware/Individual.
5. Create Access Card as Card/Individual.
6. Create Office Location Item as General/Location.
7. Create Design Licence as Software Licence/Pool.
8. Set licence seat capacity to 2 where requested.

**Expected:** Kind and tracking-mode combinations are valid and Company scoped.

### AST-002 — Create Department grants

**Open:** Asset Management → Department grants

1. Grant the IT Department read/manage and assignment capability required for
   the Department Custodian.
2. Sign in as Ishan IT and confirm Department-scoped visibility.
3. Revoke the grant.
4. Refresh the Custodian session and retry access.
5. Reactivate/regrant only for later tests.

**Expected:** Revocation removes record access/actions; cached UI does not
override backend denial.

### AST-003 — Create inventory

**Open:** Asset Management → Assets

Create the Assets listed in section 7.4:

1. Select New Asset.
2. Select Company, Department, and Asset Type.
3. Enter safe serial/identifier, manufacturer, model, purchase data, location,
   and remarks as applicable.
4. Save and record generated Asset code/version.

For the Access Card, verify sensitive identifier display is restricted.

For the Licence, open Asset Management → Licences and confirm capacity.

### AST-004 — Assign physical Asset

1. Open E2E Laptop 1 <RUN>.
2. Select Assign.
3. Choose Existing Employee.
4. Set effective date.
5. Confirm.
6. Open Assigned to employees.
7. Sign in as Employee and open My Workspace/Assets.

**Expected:** Both views show one active custody record.

### AST-005 — Concurrent assignment

1. Open E2E Laptop 1 in two authorized sessions.
2. Prepare assignment to two different Employees.
3. Submit both as closely as possible.

**Expected:** One wins, one receives a stable conflict, and only one active
custody/audit/outbox result exists.

### AST-006 — Employee custody request

**Who starts:** Assigned Employee

1. Open own Asset in My Workspace.
2. Request Return with a note.

**Who acts next:** Custodian

1. Open Asset Management → Custodian Inbox.
2. Open the request.
3. Complete the return.
4. Confirm Asset becomes available.

Repeat separate cases for Report Damaged, Report Lost, rejection, and Employee
cancellation before review.

### AST-007 — Licence allocation and capacity

1. Open E2E Design Licence <RUN>.
2. Allocate seat 1 to Existing Employee.
3. Allocate seat 2 to New Joiner.
4. Attempt a third allocation.
5. Revoke one allocation with reason.
6. Allocate the released seat.

**Expected:** Capacity cannot be exceeded, and active/revoked allocations are
audited.

### AST-008 — Asset transfer

**Open:** Asset Management → Transfers

1. Request transfer of an eligible Asset from IT to another Department.
2. Confirm source/destination context and reason.
3. As destination authorized user, Accept one transfer.
4. Create another and Reject with reason.
5. Create another and Cancel as permitted participant.
6. Test Force Complete only with protected authority and reason.

**Expected:** Only offered server actions work; notifications reach active
authorized participants without leaking private reason text.

### AST-009 — Asset lifecycle

On separate Assets test:

- Send to repair → Complete repair;
- Mark lost;
- Suspend → Resume;
- Retire;
- Dispose;
- Archive/reactivate taxonomy where allowed.

**Expected:** Invalid transitions are unavailable/rejected and history remains
immutable.

### AST-010 — Clearance and waiver

1. Start or open clearance for a controlled Employee with active Asset/licence.
2. Confirm physical and licence items appear only within the authorized scope.
3. Resolve one through return/revocation.
4. Request a waiver for another with reason code and explanation.
5. Use a different authorized approver to Approve or Reject.

**Expected:** Clearance cannot silently complete while an unresolved item
remains; another Department’s Asset details are not exposed.

---

## 22. Project Lite

### PRJ-001 — Confirm Project capability

**Who:** Project Manager  
**Open:** Project Management → Projects

1. Activate E2E Atlas Services <RUN> as Company context.
2. Confirm Projects navigation is visible.
3. Change to a non-allowlisted Company.
4. Confirm Project capability is unavailable or safely denied.
5. Return to E2E Atlas Services.

**Expected:** Feature scope and permission must both pass.

### PRJ-002 — Create an Internal Project

1. Select New project.
2. Enter E2E Internal Project <RUN>.
3. Enter description, start date, and end date.
4. Select Priya PM <RUN> as Project Manager.
5. Confirm Type is Internal.
6. Select Create.

**Expected:** A generated Project code opens in Draft status.

### PRJ-003 — Configure the Project

On Project detail:

1. Review Overview.
2. Open Stages → Add stage.
3. Add Discovery with sequence 1.
4. Add Delivery with sequence 2.
5. Open Team → Add member.
6. Add Dev Employee <RUN> with role Engineer and a valid allocation.
7. Add the Project Manager if required by the activation contract.
8. Open Tasks → Add task.
9. Create Prepare requirements under Discovery.
10. Assign Dev Employee.
11. Set planned hours to 16 and a future due date if shown.
12. Create Build prototype under Delivery.
13. Review Documents, Time, and Finance Summary tabs.

**Expected:** Only eligible active Project Team members appear as assignees.

### PRJ-004 — Activation preflight and Project lifecycle

1. Select Activate.
2. Review activation blockers.
3. Correct missing Manager, Stage, Team, Task, or date prerequisites.
4. Activate again.
5. Confirm status Active.
6. Test Hold with reason.
7. Confirm Task actions are restricted while On Hold.
8. Resume.

**Expected:** Project lifecycle changes only through currently allowed actions.

### PRJ-005 — Employee performs assigned Task

**Who:** Dev Employee  
**Open:** My Workspace → Projects

1. Locate Prepare requirements.
2. Confirm status Assigned/Open as applicable.
3. Select Start.
4. Confirm status In Progress.
5. If Attach Document is offered, upload the clean Project attachment.
6. Wait for Clean status and link it.
7. Select Submit.

**Expected:** Status becomes Waiting Review and the Project Manager receives
the work/notification.

### PRJ-006 — Manager returns and completes Task

**Who:** Project Manager  
**Open:** Project detail → Tasks

1. Open the Waiting Review task.
2. Select Return and enter a reason.
3. Sign in as Employee and confirm the Task is actionable again.
4. Start/resubmit as required.
5. Sign in as Manager.
6. Select Complete.

**Expected:** Submission/review history preserves every round and final Task
status becomes Completed.

### PRJ-007 — Weekly Employee timesheet

**Who:** Project Employee  
**Open:** My Workspace → Timesheets

1. Select New timesheet.
2. Choose the applicable week.
3. Select Add timesheet line.
4. Choose Prepare requirements or an eligible Work Category.
5. Choose a working date.
6. Enter 8 hours and remarks.
7. Save the line.
8. Confirm total hours.
9. Submit.

**Expected:** Reporting Manager snapshot is shown and status becomes Submitted.

Negative checks:

- date outside week;
- non-eligible Task;
- more than allowed daily/weekly hours;
- duplicate line/source;
- another Employee’s Task;
- editing after approval.

### PRJ-008 — Manager approves or returns timesheet

**Who:** Snapshotted Reporting Manager  
**Open:** Project Management → Team timesheets

1. Find the submitted week.
2. Open and compare lines with Project Tasks.
3. Return one controlled timesheet with a reason.
4. Let Employee correct and resubmit.
5. Approve.
6. Attempt self-approval and foreign-team approval separately.

**Expected:** Only the snapshotted eligible Manager can decide, and approved
time becomes immutable.

### PRJ-009 — Project summaries and completion

1. Open Project → Time.
2. Confirm Approved hours equals approved timesheet hours only.
3. Open Finance Summary.
4. Before Finance integration data, confirm the empty/disabled explanation is
   honest.
5. After approved Finance transactions are linked, confirm approved income and
   expenses only.
6. Complete Stages according to Task state.
7. Complete the Project.
8. Archive when offered.

### PRJ-010 — Current Client Project and Resource boundaries

1. When Client Projects are enabled, open New project and select Client.
2. Check whether Business Party, currency, expected income, and expense budget
   can be configured through the tested UI.
3. Open /projects/resources.

**Expected:**

- Resource planning redirects or states it is deferred.
- If required Client Project commercial controls are absent, record a UI gap;
  do not claim the Client Project workflow passed using API-only setup.

---

## 23. Office Finance Lite

Office Finance records operational income, expenses, transfers, and cash/bank
balances. It is not full double-entry or statutory accounting.

### FIN-001 — Financial Profile

**Who:** Finance Setup administrator  
**Open:** Office Finance → Setup → Financial Profile

1. Activate E2E Atlas Services <RUN>.
2. Set base currency INR.
3. Set reporting start date before the test transactions.
4. Save.

**Expected:** The Company has one current Financial Profile.

### FIN-002 — Business Parties

**Open:** Setup → Business Parties

1. Select New business party.
2. Create E2E Client <RUN> as Customer.
3. Create E2E Vendor <RUN> as Vendor.
4. Enter controlled contact/tax reference data.
5. Test Archive and Reactivate on a separate unused Party.

**Expected:** Generated Party codes are unique within the Company.

### FIN-003 — Categories

**Open:** Setup → Categories

1. Create Service Income <RUN> as Income.
2. Create Office Expense <RUN> as Expense.
3. Create Payroll Expense <RUN> as Expense.
4. Set Payroll Expense in the Financial Profile if the UI offers it.

### FIN-004 — Payment Accounts

**Open:** Setup → Payment Accounts

1. Select New payment account.
2. Create Petty Cash <RUN> with 100000 INR opening balance.
3. Create Operating Bank <RUN> with 500000 INR opening balance.
4. Enter controlled bank name/reference information.
5. Confirm the UI displays only safe last-four information.

**Expected:** Sensitive bank reference is not returned or displayed as plain
full text.

### FIN-005 — Monthly Period

**Open:** Setup → Periods

1. Create the test month.
2. Confirm status Open.
3. Do not lock it until transaction tests are complete.

### FIN-006 — Finance Maker creates transactions

**Who:** Finance Maker  
**Open:** Office Finance → Transactions

Create an Income:

1. Select New transaction.
2. Type Income.
3. Enter date and 50000 INR.
4. Choose Service Income and E2E Client.
5. Choose Operating Bank as destination.
6. Enter description containing <RUN>.
7. Save Draft.

Create an Expense:

1. Type Expense.
2. Enter 12500 INR.
3. Choose Office Expense and E2E Vendor.
4. Choose Operating Bank or Petty Cash as source.
5. Link the Internal Project if the selector supports it.
6. Save Draft.

Create a Transfer:

1. Type Transfer.
2. Enter 20000 INR.
3. Source Operating Bank.
4. Destination Petty Cash.
5. Save Draft.

**Expected:** Each receives a generated transaction number and Draft status.

### FIN-007 — Attach a private Finance document

1. Open the Draft Expense.
2. Select Attach document.
3. Upload the clean Finance receipt.
4. Wait for Clean.
5. Link it with a safe title.
6. Request download.

**Expected:** Only a Clean Company-safe File Object can be linked; download is
short-lived and audited.

### FIN-008 — Maker submits; different approver decides

**Who starts:** Finance Maker

1. Open each Draft.
2. Select Submit.
3. Confirm status Submitted.
4. Confirm Maker does not receive Approve if maker-checker applies.

**Who acts next:** Finance Approver

1. Open Submitted list.
2. Return one controlled transaction with a reason.
3. Let Maker edit and resubmit.
4. Approve Income, Expense, and Transfer.

**Expected:** Approved movements affect the correct account balances and
reports exactly once.

### FIN-009 — Approved immutability and reversal

1. Open an Approved Expense.
2. Confirm Edit is unavailable.
3. Attempt direct update with stale browser state.
4. Select Reverse.
5. Enter a mandatory reason.
6. Confirm one linked reversal.
7. Attempt a second reversal.

**Expected:** Approved history is immutable and correction uses one audited
reversal, not an edit/delete.

### FIN-010 — Period lock

1. Lock the test Finance period.
2. Attempt to create/submit/approve a transaction dated inside it.
3. Reopen only with authorized action/reason when business testing requires it.

**Expected:** Locked period prevents new approved movement.

### FIN-011 — Reports

**Open:** Office Finance → Reports

1. Filter by test date range.
2. Review Income, Expense, and Net.
3. Review grouping by Category, Party, Department, Project, and Account where
   available.
4. Review account running balance.
5. Export CSV.
6. Open CSV safely and confirm values beginning with spreadsheet formula
   characters are neutralized.

**Expected:** Reports use Approved movements only and reconcile with accounts.

---

## 24. Payroll Lite

### PAY-001 — Confirm the current Payroll UI boundary

**Who:** Payroll Maker  
**Open:** Human Resources → Payroll

Confirm these tabs:

- Runs
- Salary Components
- Employee Salaries
- Reports

The current reviewed UI exposes salary revisions. If Tax Profile and Recurring
Deduction controls are not present in the tested build, record those as
implemented API/database capabilities without a normal-user UI. Do not use
manual API calls to claim the website setup flow passed.

### PAY-002 — Configure Salary Components

**Open:** Payroll → Salary Components

1. Select New salary component.
2. Create Basic Salary <RUN> as Earning.
3. Create Housing Allowance <RUN> as Earning.
4. Create Standard Deduction <RUN> as Deduction.
5. Confirm generated component codes.

### PAY-003 — Configure Employee Salary

**Open:** Payroll → Employee Salaries, or Employee detail → Salary

For Existing Employee and New Joiner:

1. Select the Employee.
2. Select Create salary revision.
3. Enter effective date before the Payroll month.
4. Add Basic 50000.
5. Add Housing 10000.
6. Add Standard Deduction 5000.
7. Save.
8. Confirm Current revision totals.

**Expected:** Effective ranges do not overlap and history remains visible.

### PAY-004 — Payroll preflight

**Before:**

- Employee is active/eligible;
- salary revision is effective;
- Attendance period is Locked/Payroll Pending as required;
- Finance profile, Payroll Expense category, and payment account exist.

1. Open Payroll → Runs.
2. Select Create run.
3. Choose year and month.
4. Review preflight.
5. Record eligible Employee count, blockers, and warnings.
6. Correct blockers in their owning modules.
7. Refresh preflight.

**Expected:** Create remains blocked while a mandatory source is missing.

### PAY-005 — Create Draft and adjustment

1. Create the Run.
2. Open generated Run detail.
3. Confirm status Draft.
4. Select Add adjustment.
5. Choose Existing Employee.
6. Add a controlled Earning or Deduction with amount and reason.
7. Save.

**Expected:** Adjustment appears once and totals are not finalized until
Calculate.

### PAY-006 — Calculate Payroll

1. Select Calculate.
2. Confirm.
3. Open Employee rows.
4. Review Earnings, Deductions, adjustments, and Net.
5. Compare expected amounts with the configured salary data.
6. Change a source salary record after calculation as a controlled test.
7. Refresh the calculated Run.

**Expected:** Status becomes Calculated and the Run retains its immutable
calculation snapshot.

### PAY-007 — Return to Draft and recalculate

1. As authorized Maker/reviewer, select Return to Draft with reason.
2. Edit the controlled adjustment.
3. Calculate again.
4. Confirm new version and totals.

**Expected:** Prior history is retained and current calculated snapshot matches
the corrected source.

### PAY-008 — Different approver approves

**Who:** Payroll Approver, not the calculating Maker

1. Open the Calculated Run.
2. Review totals and Employee breakdown.
3. Select Approve.
4. Attempt approval again from stale session.

**Expected:** Status becomes Approved once and calculated rows cannot be
edited.

### PAY-009 — Mark Paid and Finance integration

1. Select Mark Paid.
2. Choose Operating Bank <RUN>.
3. Enter paid date.
4. Enter a controlled payment reference.
5. Confirm.
6. Open the linked Office Finance transaction.

**Expected:**

- Payroll status becomes Paid;
- one aggregate approved Payroll Expense Finance transaction is linked;
- payment reference is safely protected;
- replay does not create a second Finance transaction.

### PAY-010 — Payslip generation and Employee download

**Who starts:** Background worker after Paid status

1. Wait for Payslip status to move Pending → Generating → Available.
2. Confirm failures are retried/observable rather than left permanently
   Generating.

**Who acts next:** Employee

1. Sign in as Existing Employee.
2. Open My Workspace.
3. Find My Payslips.
4. Confirm the test month, Run number, Net amount, and Available status.
5. Select Download.
6. Open the private PDF.
7. Try another Employee’s Payslip ID through a direct request.
8. Retry the original URL after grant expiry.

**Expected:** Employee can download only their own available Payslip through a
short-lived grant.

### PAY-011 — Payroll negative and concurrency cases

Test:

- duplicate active Run for the same Company/month;
- replacement after a cancelled Run according to allowed behavior;
- two sessions Calculate simultaneously;
- stale Approve versus Return to Draft;
- simultaneous Approve decisions;
- simultaneous Mark Paid;
- repeated operation ID with different payload;
- cross-Company Employee or account ID;
- CSV register formula protection;
- Mark Paid while Finance is disabled or Period locked.

**Expected:** One deterministic outcome, no duplicate payment/Finance/Payslip,
and no partial audit/outbox state.

---

## 25. Dashboard, My Workspace, and notifications

### WRK-001 — Employee My Workspace

**Who:** Existing Employee  
**Open:** Dashboard → My Workspace

Confirm:

- name, Employee code, Company, Branch, Department, and Designation;
- Today’s schedule and Attendance action;
- Leave balance/request summaries;
- assigned Onboarding tasks;
- Project tasks and Timesheets through their child pages;
- own Assets/licences;
- recent activity;
- notifications and deep links;
- My Payslips after Payroll.

No HR, Manager, Finance, Payroll approval, or another Employee’s private data
must appear.

### WRK-002 — Manager scope

**Who:** Reporting/Project Manager

1. Open Dashboard.
2. Review team summaries.
3. Open Leave, Interview, Project, and Timesheet pending work through
   notifications/links.
4. Change to a Company/Branch where the Manager has no assignment.

**Expected:** Only reporting/project team scope appears; organization-wide
pending work is not exposed.

### WRK-003 — Context switching

For a User legitimately assigned to two Companies:

1. Record Dashboard counts in Company A.
2. Switch to Company B.
3. Confirm list data and counts change.
4. Use browser Back to a Company A detail URL.

**Expected:** Old direct detail is denied/not found under Company B context.

### WRK-004 — Notification deep links

Open notifications for:

- Interview scheduled/rescheduled;
- Offer/Recruitment delivery status where user-facing;
- Onboarding task assigned/reassigned/due;
- Asset transfer/custody request;
- Project task/timesheet;
- Payroll Payslip availability.

**Expected:** Link opens the correct authorized record. Revoked-role Users do
not gain access through an old notification.

---

## 26. Platform Delivery, file, and retention operations

### OPS-001 — Platform Delivery Queue

**Who:** Platform Delivery operator  
**Open:** Operations → Delivery Queue

1. Filter by status, channel, event/template, Company, and date where
   available.
2. Open a message.
3. Review safe recipient projection, attempts, provider events, version, and
   allowed actions.
4. Retry a retryable item.
5. Cancel a queued item with reason.
6. Confirm ordinary HR cannot access platform-wide records.

### OPS-002 — Dead Letters and Suppressions

1. Open Dead Letters.
2. Review exhausted failures and next operational action.
3. Open Suppressions.
4. Review safe hashed/masked recipient information.
5. Release only with authority and reason.

**Expected:** Operations can recover failures without exposing plaintext
recipient data across tenants.

### OPS-003 — File Operations

**Open:** Administration → Operations → Files

1. Review counts by upload/scan/storage/compensation state.
2. Locate the controlled Clean, quarantined, and failed files.
3. Run only the supported reconciliation command with a unique operation ID.
4. Confirm no valid linked object is deleted.
5. Confirm an orphan/failed object is reported for compensation.

### OPS-004 — Document retention

**Open:** Administration & Security → Document Retention

1. Review policy classes for Recruitment unsuccessful/hired, Employee
   documents, signed Offers, Projects, Finance, and Payslips where configured.
2. Change one test policy only with retention-manage authority.
3. Confirm audit/version evidence.
4. Verify a normal HR/Employee cannot edit retention.
5. Test dry-run/reporting before any destructive purge.

No real purge of existing shared data is authorized by this manual test.

---

## 27. Tenant isolation and permission suite

### ISO-001 — Cross-tenant lists

Sign in as Tenant A HR and inspect every list:

- Employees;
- Recruitment Applications/Candidates/Delivery;
- Onboarding;
- Documents;
- Attendance/Leave/Overtime;
- Assets/licences/transfers/waivers;
- Projects/Timesheets;
- Finance;
- Payroll.

**Expected:** No Tenant B record, name, count, filter option, or notification
appears.

### ISO-002 — Direct-ID denial

For one record from every module:

1. Copy a Tenant B ID using the authorized Tenant B session.
2. Return to Tenant A session.
3. Replace the detail URL ID or issue the normal detail request.

**Expected:** The response is the same safe not-found behavior as a nonexistent
ID. It must not reveal owner, status, or organization information.

### ISO-003 — Cross-Company/Branch/Department

Within Tenant A test:

- Company A User requests Company B record;
- Branch-scoped User requests another Branch;
- Department Asset/Onboarding user requests another Department;
- assignee picker is given foreign Employee ID;
- attachment/upload session is linked to a foreign aggregate.

**Expected:** Every server mutation and read independently enforces scope.

### ISO-004 — Direct URL and stale permissions

1. Open an authorized page.
2. Revoke the User role/grant in another session.
3. Without logging out, refresh and perform the old action.
4. Open an old notification/deep link.

**Expected:** Backend denial occurs immediately according to session
invalidation rules; cached UI does not grant authority.

---

## 28. Manual concurrency and idempotency suite

Use two browsers or two authenticated profiles. Record both request IDs and
timestamps.

| Case    | Competing operations                     | Required outcome              |
| ------- | ---------------------------------------- | ----------------------------- |
| CON-001 | Two organization verification submits    | One organization              |
| CON-002 | Two Recruitment transitions              | One valid state change        |
| CON-003 | Two Candidate conversions                | One Employee/Onboarding       |
| CON-004 | Two Onboarding task assignments          | One current assignee          |
| CON-005 | Task completion vs Onboarding completion | Consistent terminal state     |
| CON-006 | Same physical Asset assignment           | One active custody            |
| CON-007 | Last licence seat allocation             | Capacity never exceeded       |
| CON-008 | Transfer accept vs reject/cancel         | One terminal decision         |
| CON-009 | Leave approval twice                     | One workflow decision         |
| CON-010 | Timesheet approve vs return              | One terminal/current decision |
| CON-011 | Finance approve vs return                | One state change/movement     |
| CON-012 | Payroll calculate/approve/pay twice      | One snapshot/payment          |

For every case verify:

- one committed winner where applicable;
- deterministic error/replay for the other request;
- no duplicate business row;
- no partial audit/action/outbox evidence;
- totals and progress remain correct.

---

## 29. Responsive, keyboard, and error behavior

### UX-001 — Screen sizes

Run critical happy paths at:

- desktop;
- tablet width;
- narrow mobile width.

Check sidebar, tables, tabs, forms, dialogs, drawers, and action buttons. No
critical control may be unreachable or require horizontal scrolling without an
intentional responsive table container.

### UX-002 — Keyboard and focus

For representative forms/dialogs:

1. Navigate using Tab and Shift+Tab.
2. Activate controls with keyboard.
3. Confirm focus enters an opened dialog.
4. Confirm focus returns to the trigger after close.
5. Confirm validation errors are announced/visible.
6. Confirm a skip link works where supplied.

### UX-003 — Loading, empty, denied, and retry

For each major module confirm:

- loading state;
- empty state with useful next action;
- permission-denied state;
- provider/network failure;
- retry/refetch;
- stale-version message;
- successful mutation feedback.

### UX-004 — Browser console and network

During the golden path record:

- no uncaught runtime exception;
- no hydration error;
- no repeated failing request loop;
- no secret/token/private URL in console;
- API status matches visible result;
- request ID is available for failures.

---

## 30. Read-only database and business reconciliation

**Who:** Technical reviewer

Use only parameterized, read-only queries filtered by the generated run IDs.
Do not paste personal fields or secrets into evidence.

Verify:

### Organization and security

- expected two Company Groups and their Companies/Branches;
- User-to-Employee links;
- scoped active role assignments;
- invitation/session terminal states.

### Recruitment and Onboarding

- one Candidate/Application/accepted Offer/Employee source chain;
- one source conversion;
- one active or completed Onboarding;
- correct Template Version and organization snapshots;
- mandatory task terminal states;
- Asset task result points to real custody/allocation;
- career and Probation event order.

### Workforce

- published Calendar/roster coverage;
- Attendance source and correction evidence;
- Leave pending/used totals;
- Overtime settlement and Comp-off allocation.

### Assets

- one open physical custody per Asset;
- licence active allocations do not exceed capacity;
- transfer/request/clearance terminal evidence;
- command receipt, action, audit, and outbox consistency.

### Projects

- active Team/Task relationships stay in one Company/Project;
- immutable submission/review rounds;
- Timesheet total equals lines;
- Project approved hours use Approved timesheets only.

### Finance and Payroll

- approved movements reconcile to account balances;
- reversal pairing is one-to-one;
- locked-period rules;
- Payroll Employee totals equal line snapshots;
- Paid Run has one linked Finance transaction;
- one Payslip per included Employee;
- file links are Clean and Company/Employee safe.

### Delivery and files

- one logical Delivery Message per dedupe key;
- attempts/provider events are durable;
- dead-letter/suppression state matches UI;
- linked File Objects are Clean;
- failed uploads have compensation evidence;
- download access audits exist without storing tokens.

**PASS when:** UI results, API responses, and read-only database invariants
agree for the same execution ID.

---

## 31. Defect handling

### 31.1 Severity

| Severity | Meaning                                                                                  |
| -------- | ---------------------------------------------------------------------------------------- |
| P0       | Tenant/private-data exposure, credential exposure, or unrecoverable corruption           |
| P1       | Critical business lifecycle cannot complete or produces wrong financial/employment state |
| P2       | Major incorrect behavior with a documented workaround                                    |
| P3       | Minor usability, wording, or visual issue                                                |

### 31.2 Required defect content

- Test case ID
- Build/commit
- Persona and active context
- Exact input and generated record IDs
- Expected result
- Actual result
- Screenshot/video
- Request ID and sanitized network status
- Severity and business impact

### 31.3 Retest rule

After a fix:

1. Run the relevant automated gates separately.
2. Restart/redeploy the fixed build.
3. Retest the failed case.
4. Retest the preceding and following workflow step.
5. Repeat the matching foreign-tenant/permission test.
6. Update defect and result records.

A build or unit-test result alone does not close a manual workflow defect.

---

## 32. Final golden-thread regression

Repeat this shortened critical path on the final candidate build:

1. Login and active Company context.
2. Create/publish one Opening.
3. Public Candidate applies with Clean CV.
4. Shortlist, Interview, evaluation, Manager selection.
5. Send and accept signed Offer through real Delivery.
6. Verify and convert to one Employee.
7. Accept Employee invitation.
8. Resolve published Onboarding Template.
9. Assign Department work and fulfil real Asset task.
10. Complete Onboarding and start Probation.
11. Confirm Attendance and one approved Leave.
12. Complete one Project Task and approved Timesheet.
13. Approve one Finance Expense.
14. Calculate, independently approve, and pay Payroll.
15. Confirm linked Finance Payroll expense.
16. Employee downloads own Payslip.
17. Reconcile Dashboard, My Workspace, Delivery, files, audit, and database.
18. Repeat critical direct-ID denial using Tenant B.

---

## 33. Release acceptance and sign-off

The manual run passes only when:

- every critical happy path passes on the same recorded build;
- all required negative, permission, and Tenant-isolation cases pass;
- there is no unresolved P0 or P1;
- every P2 is fixed or formally accepted;
- real email/inbox, provider webhook, storage, scan, and worker evidence exists;
- no mock/bypass result is counted as final evidence;
- Finance and Payroll maker-checker separation passes;
- all concurrency cases have one consistent outcome;
- UI, API, audit/outbox, and read-only database results reconcile;
- every feature-gated module passes only in its allowlisted scope;
- missing UI capabilities are listed as product gaps;
- technical and business owners sign the recorded build.

| Area                          | Required signer                        | Result/signature/date |
| ----------------------------- | -------------------------------------- | --------------------- |
| Organization and Security     | Organization Owner / Security reviewer |                       |
| Employee and Workforce        | HR Manager                             |                       |
| Recruitment and Delivery      | Recruitment owner / Operations         |                       |
| Files and retention           | Security/Operations owner              |                       |
| Onboarding and Probation      | HR Onboarding owner                    |                       |
| Assets and clearance          | Asset owner                            |                       |
| Projects and Timesheets       | Project owner                          |                       |
| Office Finance                | Finance owner                          |                       |
| Payroll and Payslips          | Payroll owner                          |                       |
| Employee self-service         | Employee representative                |                       |
| Tenant isolation and database | Technical reviewer                     |                       |
| Final release                 | Product Owner                          |                       |

---

## 34. Route-to-workflow coverage

This table prevents implemented pages from being silently omitted.

| Route group                                                 | Covered by                                         |
| ----------------------------------------------------------- | -------------------------------------------------- |
| /                                                           | Redirect behavior to /dashboard; AUTH-001, WRK-002 |
| /login, /forgot-password, /reset-password, /change-password | AUTH-001 to AUTH-003                               |
| /register, /onboarding                                      | REG-001, ORG-001                                   |
| /accept-invitation                                          | SEC-001, HIRE-004                                  |
| /dashboard                                                  | AUTH-001, WRK-002                                  |
| /administration/company-groups                              | ORG-002                                            |
| /administration/companies                                   | ORG-002                                            |
| /administration/branches                                    | ORG-002                                            |
| /administration/departments                                 | ORG-002                                            |
| /administration/designations                                | ORG-002                                            |
| /administration/shifts                                      | ORG-002, SCH-001                                   |
| /administration/users                                       | SEC-001 to SEC-003                                 |
| /administration/security                                    | SEC-002 to SEC-003                                 |
| /administration/business-calendar and detail/version pages  | CAL-001                                            |
| /administration/business-calendar/preview                   | CAL-002                                            |
| /administration/business-calendar/imports and /impacts      | CAL-003                                            |
| /hr/employees and new/detail/edit                           | EMP-001, EMP-002, CAR-001                          |
| /hr/recruitment dashboard/openings                          | REC-001, REC-002                                   |
| /careers/[companyCode] and job detail                       | REC-003, REC-004                                   |
| /hr/recruitment/applications and detail                     | REC-005 to REC-010                                 |
| /hr/recruitment/candidates and detail                       | REC-005                                            |
| /hr/recruitment/interviews and /offers                      | REC-006 to REC-010                                 |
| /offer-response                                             | REC-009                                            |
| /hr/recruitment/delivery and detail                         | DEL-001 to DEL-004                                 |
| /hr/onboarding-templates and Department editor              | ONT-001 to ONT-005                                 |
| /hr/employee-onboarding and detail                          | ONB-001 to ONB-008                                 |
| /my-workspace/onboarding                                    | ONB-003 to ONB-005                                 |
| /hr/employee-document-categories and types                  | DOC-001                                            |
| /hr/employee-documents                                      | DOC-002 to DOC-004                                 |
| /hr/work-schedule                                           | SCH-001                                            |
| /hr/attendance, /exceptions, /periods                       | ATT-001 to ATT-006                                 |
| /hr/leave/types, /policies, /balances                       | LEV-001, LEV-002                                   |
| /hr/leave requests/calendar/holidays                        | LEV-003 to LEV-005                                 |
| /hr/overtime and /hr/leave/comp-off                         | OVT-001, OVT-002, CO-001                           |
| Asset Categories, Types, Assets                             | AST-001, AST-003, AST-009                          |
| Asset Department grants                                     | AST-002                                            |
| Asset assigned-to-employees and inbox                       | AST-004 to AST-006                                 |
| Asset licences                                              | AST-007                                            |
| Asset transfers and waivers                                 | AST-008, AST-010                                   |
| /projects/projects and detail                               | PRJ-001 to PRJ-004, PRJ-009                        |
| /my-workspace/projects                                      | PRJ-005                                            |
| /my-workspace/timesheets                                    | PRJ-007                                            |
| /team/timesheets                                            | PRJ-008                                            |
| /projects/resources                                         | PRJ-010, intentionally deferred                    |
| /office-finance and Setup                                   | FIN-001 to FIN-005                                 |
| /office-finance/transactions and detail                     | FIN-006 to FIN-010                                 |
| /office-finance/reports                                     | FIN-011                                            |
| /hr/payroll and Run detail                                  | PAY-001 to PAY-009, PAY-011                        |
| /my-workspace Payslip card                                  | PAY-010                                            |
| /my-workspace                                               | WRK-001 to WRK-004                                 |
| /admin/operations/delivery and detail                       | OPS-001                                            |
| /admin/operations/delivery/dead-letters                     | OPS-002                                            |
| /admin/operations/delivery/suppressions                     | OPS-002                                            |
| /administration/operations/files                            | OPS-003                                            |
| /settings/security/document-retention                       | OPS-004                                            |
| /design-system                                              | Internal reference; not business UAT               |

---

## 35. One sentence to remember

Create the organization first, connect Employees to User logins, publish the
calendar and schedules, hire through Recruitment, complete Department-owned
Onboarding with real Asset custody, operate workforce and Projects, approve
Finance and Payroll with different people, and finally reconcile everything
from the Employee workspace through operations and the database.
