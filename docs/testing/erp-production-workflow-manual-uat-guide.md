# Core ERP Production-Workflow Manual UAT Guide

**Document status:** Ready for execution  
**Application:** Group ERP  
**Test type:** Manual, production-style business workflow validation  
**UAT database:** `dsp_erp_uat`  
**Database schema:** `dsp_pms`  
**Frontend:** `http://localhost:3200` when run locally  
**Backend:** `http://localhost:4500` when run locally  
**Updated:** 4 August 2026

---

## 1. Purpose

This guide validates the complete production-style workflow of the currently
implemented Core ERP.

The testing team must:

1. Enter realistic business data through the application.
2. Test every workflow using the correct user role.
3. Confirm that permissions and tenant isolation work.
4. Record actual and expected results.
5. Report every defect with evidence and a request reference.
6. Retest each corrected defect.
7. Repeat the final regression before approving the release.

A successful build is not sufficient for production approval. The business
workflow, permissions, data integrity, error handling and user experience must
all pass.

---

## 2. Release Boundary

### 2.1 Included in this UAT

- Login, logout, password change and password recovery.
- Organization registration and email OTP verification.
- Organization onboarding.
- Company Group, Company and Branch hierarchy.
- Departments, Designations, Shifts and Branch working calendars.
- User invitations, sessions, roles, permissions and organization scope.
- Employee creation, list, preview, detail, editing and deactivation.
- Onboarding templates, versions, tasks and employee onboarding.
- Employee document metadata, expiry and verification.
- Attendance management and employee check-in/check-out.
- Leave Types, Policies, Balances, Requests and approvals.
- Asset Categories, Types, Assets, assignment and return.
- Manager Dashboard.
- Employee My Workspace.
- Tenant isolation.
- Business audits and authentication security events.
- Desktop, tablet and mobile usability.

### 2.2 Accepted limitation

Employee Documents currently manage document metadata, expiry and verification.
Secure file upload, malware scanning, private storage and authorized download
will be implemented later.

The application must not show a false upload success message or a non-functional
download action.

### 2.3 Excluded from release approval

The following are not complete end-to-end production workflows:

- Projects and work management.
- Payroll.
- HR requests and approval engine.
- Generated documents.
- Separation and clearance.
- Resource management.
- CRM.
- Finance and accounting.
- Procurement.
- BIM.
- Training.
- Production hosting and deployment infrastructure.

These exclusions must be included in the final sign-off. They must not be
reported as tested or completed.

---

## 3. UAT Result Recording

Create one result entry for every test case.

| Field | Required information |
| --- | --- |
| Test Case ID | Exact case number from this guide |
| Module | Authentication, Employee, Leave, etc. |
| Tester | Person executing the case |
| Test date | Actual execution date and time |
| Build | Git commit or build identifier |
| User role | Role used to perform the action |
| Company Group | Active tenant |
| Company | Active Company context |
| Branch | Active Branch context |
| Preconditions | Records and statuses required before starting |
| Input data | Exact values entered |
| Expected result | Approved behaviour from this guide |
| Actual result | What happened |
| Status | Not Run, Pass, Fail, Blocked or Not Applicable |
| Request ID | `X-Request-ID` or error reference |
| Evidence | Screenshot, video or sanitized log path |
| Defect ID | Linked defect number when failed |
| Retest result | Pass or Fail after correction |
| Sign-off | Tester and reviewer |

### 3.1 Evidence rules

For successful critical workflows, capture:

- The completed UI state.
- The generated business code.
- The final workflow status.
- The user and active organization context.

For failed workflows, capture:

- The values entered.
- The complete visible error.
- The browser network request and status code.
- The request reference number.
- The active role and organization context.
- A screenshot or short video.

Never include passwords, OTPs, access tokens, refresh cookies or SMTP
credentials in evidence.

---

## 4. UAT Environment Preconditions

Do not begin business testing until every precondition is confirmed.

- [ ] A separate `dsp_erp_uat` PostgreSQL database is available.
- [ ] The application uses schema `dsp_pms`.
- [ ] All existing Prisma migrations are applied.
- [ ] No production customer data exists in UAT.
- [ ] Exactly one approved Global Super Administrator exists.
- [ ] System roles and permissions exist.
- [ ] Redis is enabled for final session testing.
- [ ] SMTP delivery is enabled for final registration, invitation and reset tests.
- [ ] `EMAIL_DEV_BYPASS=false` for final email evidence.
- [ ] SaaS self-registration is enabled during registration testing.
- [ ] Frontend and backend use the same approved UAT URLs.
- [ ] Browser cache and old authentication cookies are cleared.
- [ ] The build identifier is recorded.

Development OTP bypass may be used while preparing UAT. A bypassed OTP is not
accepted as final production-workflow evidence.

### 4.1 Initial read-only counts

Record the starting count for:

- Company Groups.
- Companies.
- Branches.
- Departments.
- Designations.
- Shifts.
- Users.
- Active role assignments.
- Employees.
- Pending registrations.
- Active sessions.
- Onboarding records.
- Leave requests.
- Assets.
- Active asset assignments.

These counts allow the reviewer to identify unexpected duplicate or partial
records after testing.

---

## 5. Test Accounts and Personas

One person may test multiple personas, but the result register must identify the
exact account and role used.

| Persona | Main testing responsibility |
| --- | --- |
| Platform Super Administrator | Platform scope and tenant-isolation validation |
| Atlas Organization Owner | Complete Tenant administration |
| Atlas Company Administrator | Company and Branch administration |
| Atlas HR Manager | Employees, onboarding, documents, attendance and leave |
| Atlas Project Manager | Current read-only HR access and self-service |
| Atlas Asset Manager | Asset master data, assignment and return |
| Atlas Employee 1 | Normal employee self-service |
| Atlas Employee 2 | Leave and attendance negative cases |
| Atlas Disabled User | Disabled-login and session-revocation checks |
| Beacon Organization Owner | Second-tenant isolation |
| Beacon HR Manager | Second-tenant HR testing |
| Beacon Employee | Second-tenant self-service |

Use controlled UAT email inboxes. Do not store test passwords in this document.

---

## 6. Manual Business Data

All business data must be entered through the normal application screens unless
a test case explicitly requires read-only database verification.

Internal codes must be generated by the backend. Testers record generated
codes; they do not invent or manually enter them.

### 6.1 Date notation

- `T0`: chosen UAT working date.
- `T-1`: previous working day.
- `T+1`: next working day.
- `T+5`: fifth future working day.
- `T+6`: sixth future working day.

Use appropriate actual dates during execution.

### 6.2 Atlas tenant

Company Group:

- Name: `Atlas Engineering Group`
- Description: `Engineering, architecture and BIM services`

Companies:

1. `Atlas Design Consultants`
2. `Atlas BIM Solutions`

Branches:

| Branch | Country | Timezone |
| --- | --- | --- |
| Dubai Head Office | AE | Asia/Dubai |
| Kochi Delivery Centre | IN | Asia/Kolkata |
| Bengaluru BIM Studio | IN | Asia/Kolkata |

Departments:

- Human Resources.
- Projects.
- BIM.
- Information Technology.
- Finance.
- Administration.

Designations:

- HR Manager.
- Project Manager.
- Asset Manager.
- BIM Coordinator.
- Revit Modeler.
- IT Support Executive.
- General Employee.

Shifts:

| Shift | Start | End | Break | Grace | Other |
| --- | --- | --- | ---: | ---: | --- |
| General Shift | 09:00 | 18:00 | 60 min | 15 min | Default |
| Early Shift | 07:00 | 16:00 | 60 min | 10 min | Active |
| Night Shift | 21:00 | 06:00 | 60 min | 15 min | Night shift |

Working calendar:

- Monday to Friday: working.
- Saturday and Sunday: non-working.

### 6.3 Beacon tenant

Company Group:

- `Beacon Engineering Group`

Company:

- `Beacon Engineering Services`

Branch:

- `Bengaluru Head Office`
- Country: IN
- Timezone: Asia/Kolkata

Departments:

- Human Resources.
- Engineering.
- Information Technology.

### 6.4 Employees

Create at least the following ten employee records:

| Employee | Tenant | Branch | Department | Designation | Status |
| --- | --- | --- | --- | --- | --- |
| Asha Nair | Atlas | Dubai | Human Resources | HR Manager | Active |
| Rahul Menon | Atlas | Kochi | Projects | Project Manager | Active |
| Neha Thomas | Atlas | Kochi | BIM | BIM Coordinator | Active |
| Fathima Ali | Atlas | Dubai | Information Technology | IT Support Executive | Active |
| Arjun Kumar | Atlas | Kochi | BIM | Revit Modeler | Probation |
| Maya Joseph | Atlas | Kochi | BIM | Revit Modeler | Active |
| David Roy | Atlas | Dubai | Administration | General Employee | Notice |
| Employee Without Login | Atlas | Kochi | Projects | General Employee | Active |
| Beacon HR User | Beacon | Bengaluru | Human Resources | HR Manager | Active |
| Beacon Employee | Beacon | Bengaluru | Engineering | General Employee | Active |

Use Rahul Menon as the manager for applicable Atlas project and BIM employees.

### 6.5 Leave data

| Code | Name | Paid | Approval | Half-day | Carry forward |
| --- | --- | ---: | ---: | ---: | ---: |
| AL | Annual Leave | Yes | Yes | Yes | Yes |
| SL | Sick Leave | Yes | Yes | Yes | No |
| UL | Unpaid Leave | No | Yes | No | No |
| CO | Compensatory Off | Yes | Yes | Yes | No |

Annual Leave policy:

- Entitlement: 18 days.
- Carry-forward limit: 5 days.
- Maximum consecutive days: 10.
- Negative balance: blocked.

Sick Leave policy:

- Entitlement: 10 days.
- Carry-forward limit: 0.
- Maximum consecutive days: 3.
- Negative balance: blocked.

### 6.6 Document data

Categories:

- Identity.
- Employment.
- Qualification.

Document Types:

| Type | Number | Expiry | Verification | Lifetime |
| --- | ---: | ---: | ---: | ---: |
| Passport | Required | Required | Required | No |
| National ID | Required | Optional where supported | Required | Conditional |
| Employment Contract | Optional | Optional | Required | No |
| Degree Certificate | Optional | Not required | Required | Yes |
| Experience Certificate | Optional | Not required | Required | Yes |
| Profile Document | Optional | Optional | Optional | Conditional |

### 6.7 Onboarding data

Template:

`Standard Employee Onboarding`

| Order | Task | Owner | Mandatory |
| ---: | --- | --- | ---: |
| 1 | Verify employee profile | HR | Yes |
| 2 | Verify identity document | HR | Yes |
| 3 | Create business email | IT | Yes |
| 4 | Assign laptop | IT/Asset | Yes |
| 5 | Manager welcome meeting | Manager | Yes |
| 6 | Policy acknowledgement | Employee | Yes |
| 7 | Office introduction | HR | No |

Dependencies:

- Business email creation follows profile verification.
- Laptop assignment follows profile verification.
- Manager welcome follows email creation.
- Final completion requires all mandatory tasks.

### 6.8 Asset data

Categories:

- IT Equipment.
- Accessories.
- Mobile Devices.

Types:

- Laptop.
- Monitor.
- Mobile Phone.
- Keyboard and Mouse Set.

Assets:

| Asset | Serial |
| --- | --- |
| Dell Latitude Laptop | UAT-LT-001 |
| Lenovo ThinkPad | UAT-LT-002 |
| Dell Monitor | UAT-MN-001 |
| Samsung Mobile | UAT-PH-001 |

---

## 7. Common Testing Rules

### 7.1 Every form

Test:

1. Valid save.
2. Required-field validation.
3. Invalid format.
4. Cancel without saving.
5. Close and reopen.
6. Optional field clearing.
7. Duplicate-click protection.
8. API error behaviour.

### 7.2 Every list

Test:

1. Initial loading.
2. Search.
3. Sorting.
4. Filtering.
5. Pagination where available.
6. Empty search.
7. Clear search.
8. Refresh.
9. Row action.
10. Error and retry.

### 7.3 Every drawer and dialog

Test:

1. Open with mouse.
2. Open using keyboard.
3. Correct initial focus.
4. Logical Tab order.
5. Escape/Close.
6. Unsaved data behaviour.
7. Focus restoration.
8. Mobile layout.

### 7.4 Every workflow transition

Record:

- Previous status.
- Action.
- New status.
- Actor.
- Timestamp.
- Request ID.
- Related audit entry.

---

## 8. Gate 1 - Startup and Public Pages

### PRE-001 - Backend liveness

- [ ] Open `GET /health/live`.

Expected:

- HTTP 200.
- Status is `ok`.
- Timestamp and uptime are valid.
- No database or secret information is exposed.

### PRE-002 - Backend readiness

- [ ] Open `GET /health/ready`.

Expected:

- Database is `up`.
- Redis is `up` for the final session pass.
- No database password, certificate content or Redis credential is returned.

### PRE-003 - Login page

- [ ] Open `/login`.
- [ ] Submit the empty form.

Expected:

- Identifier and password fields render.
- Sign-in, Forgot Password and Create Organization actions render when allowed.
- Empty submit shows local validation.
- Empty submit does not call the login API.

### PRE-004 - Registration page

- [ ] Open `/register`.
- [ ] Test invalid email.
- [ ] Test password mismatch.
- [ ] Test empty submit.

Expected:

- Organization, owner, email, password and confirmation fields render.
- Local validation prevents invalid submission.
- No pending registration is created for invalid input.

### PRE-005 - Platform setup exposure

- [ ] Confirm no public page requests a Platform Setup Token.
- [ ] Confirm `/setup/platform-owner` is unavailable.
- [ ] Confirm public capabilities report platform setup unavailable.

Any public platform-token form is a release blocker.

---

## 9. Gate 2 - Registration and OTP

### REG-001 - Successful Atlas registration

Actor: New Atlas Organization Owner.

1. Enter `Atlas Engineering Group`.
2. Enter the approved owner name and controlled email.
3. Enter a valid password and confirmation.
4. Submit registration.
5. Confirm the OTP page shows a masked email.
6. Confirm expiry and resend information.
7. Retrieve the OTP from the configured test mailbox.
8. Submit the OTP.

Expected:

- Registration is pending before OTP verification.
- Company Group, Company and User are not partially provisioned.
- Verification creates one Company Group, one first Company and one Owner.
- The email is verified.
- Codes and username are generated by the backend.
- The Owner receives Company Group scope, not Global scope.
- The Owner is signed in and redirected to organization onboarding.
- The OTP cannot be reused.

### REG-002 - Incorrect OTP

1. Start a separate pending registration.
2. Enter an incorrect six-digit OTP.

Expected:

- A safe invalid-code error appears.
- No tenant records are created.
- The OTP is not returned in the error or log.

### REG-003 - Maximum OTP attempts

1. Enter five incorrect codes against one challenge.
2. Enter the correct code after the fifth failure.

Expected:

- The challenge is unusable after the maximum attempts.
- The correct code cannot provision the tenant after lockout.
- No partial tenant data exists.

### REG-004 - Resend cooldown and invalidation

1. Click Resend immediately.
2. Wait for the 60-second cooldown.
3. Resend.
4. Enter the previous OTP.
5. Enter the new OTP.

Expected:

- Immediate resend is blocked.
- The previous code fails after resend.
- The new code succeeds.

### REG-005 - Expired OTP

Use an approved shortened UAT expiry or wait for expiry.

Expected:

- Expired OTP cannot provision a tenant.
- Resend produces a new valid challenge.

### REG-006 - Concurrent verification

1. Open the same pending challenge in two browser profiles.
2. Submit the correct OTP in both as closely as possible.

Expected:

- Exactly one succeeds.
- Only one tenant, Company and Owner are created.
- The second receives a safe consumed/conflict response.

### REG-007 - SMTP failure

Use a controlled invalid UAT SMTP token for this test only.

Expected:

- A safe delivery error appears.
- Pending registration remains resumable.
- No Company Group or User is provisioned.
- SMTP credentials are not logged.

Restore valid SMTP configuration before continuing.

---

## 10. Gate 3 - Organization Onboarding

### ORG-001 - Organization

1. Verify the registered Company Group name.
2. Add the approved description.
3. Continue.

Expected:

- Name is required.
- Group code is displayed and read-only.
- The saved step survives refresh.

### ORG-002 - First Company

Enter:

- `Atlas Design Consultants`.
- Registration number.
- Tax number.

Expected:

- Company code is generated.
- Code cannot be edited.
- Double save does not create duplicate Companies.

### ORG-003 - First Branch

Enter Dubai Head Office details.

Expected:

- Branch code is generated.
- Country code and timezone persist.
- Branch belongs to the first Company.

### ORG-004 - Starting structure

Create:

- Human Resources Department.
- HR Manager Designation.
- General Shift.

Expected:

- Department is mandatory.
- Designation and Shift are optional.
- Created records appear on their Administration pages.

### ORG-005 - Team step

Expected:

- The page explains that user accounts are created after setup.
- No user or role is silently created.

### ORG-006 - Review and finish

1. Confirm names and counts.
2. Finish setup.

Expected:

- Status becomes Completed.
- Owner is redirected to `/dashboard`.
- A later login does not reopen onboarding.

### ORG-007 - Resume Beacon onboarding

1. Register Beacon tenant.
2. Stop after the Branch step.
3. Sign out and sign back in.

Expected:

- Beacon Owner resumes at the correct step.
- Saved records remain unchanged.

---

## 11. Gate 4 - Organization Administration

### ADM-001 - Company Group

Test:

- View and edit Atlas Group.
- Required Group name.
- Search and sorting.
- Access as Atlas HR Manager.
- Access as Beacon Owner.

Expected:

- Atlas Owner can manage Atlas.
- HR Manager cannot perform Owner-only changes.
- Beacon cannot see Atlas.
- Generated code remains unchanged.

### ADM-002 - Companies

Create `Atlas BIM Solutions`.

Test:

- Optional Parent Company.
- Clear Parent Company.
- Registration and tax data.
- Active/inactive status.
- Search and sorting.
- Cancel create.
- Delete an unused Company.
- Delete a referenced Company.

Expected:

- Optional Parent can be cleared.
- Referenced Company cannot leave orphan records.
- Inactive Company remains available through the correct filter.
- Company code remains unique and generated.

### ADM-003 - Branches and working calendar

Create Kochi and Bengaluru Branches.

Test:

- Company filter.
- Address.
- Country and timezone.
- Working-days drawer.
- Inactive status.
- Foreign Company identifier.

Expected:

- Only Branches of the selected Company appear.
- Working calendar reloads correctly.
- Foreign Company relationship is rejected.

### ADM-004 - Departments

Create all Atlas Departments.

Test:

- Company.
- Optional Branch.
- Clear optional Branch.
- Search.
- Inactive status.
- Branch from another Company.

Expected:

- Empty optional Branch is saved as empty, not an invalid placeholder.
- Foreign Company/Branch relationship is rejected.

### ADM-005 - Designations

Create all Atlas Designations.

Test:

- Company.
- Name.
- Level.
- Edit.
- Inactive status.
- Department onboarding link.
- Foreign Department link.

Expected:

- Designation remains inside its Company.
- Cross-company Department links are rejected.

### ADM-006 - Shifts

Create General, Early and Night Shifts.

Test:

- Start/end time.
- Break.
- Grace in/out.
- Night Shift.
- Default Shift.
- Negative numeric values.
- Search and status.

Expected:

- Negative values fail validation.
- Saved time and flags reload correctly.
- Night Shift remains correctly marked.

---

## 12. Gate 5 - Roles, Users and Sessions

### SEC-001 - System role matrix

Verify UI navigation and direct API behaviour.

| Role | Expected access |
| --- | --- |
| Organization Owner | Tenant administration, security, HR, attendance, leave and assets |
| Company Administrator | Assigned Company/Branch administration, HR and assets |
| HR Manager | Employee, onboarding, documents, attendance and leave; asset read |
| Project Manager | Dashboard, organization read, employee read and self-service |
| Asset Manager | Asset management, assignment, employee read and self-service |
| Employee | Dashboard and own self-service |
| Super Administrator | Global platform authorization |

Expected:

- Hidden menu and backend permission agree.
- Direct URLs cannot bypass permission.
- No tenant role receives `platform.admin`.

### SEC-002 - Invite HR Manager

Create Atlas HR Manager:

- Display name.
- Controlled email.
- Link to Asha Nair.
- HR Manager role.
- Company scope.

Expected:

- User becomes Invited.
- Invitation email is delivered.
- Password is never displayed to the administrator.

### SEC-003 - Accept invitation

1. Open invitation in a signed-out browser.
2. Create password.
3. Sign in.
4. Reuse the link.

Expected:

- Correct user and organization are displayed.
- First acceptance succeeds.
- Invitation becomes consumed.
- Reuse fails safely.

### SEC-004 - Expired invitation

Expected:

- Expired invitation cannot set a password.
- Admin can resend.
- Old link becomes invalid.

### SEC-005 - Custom read-only role

Create `Atlas HR Viewer` with:

- Company read.
- Branch read.
- Employee read.
- Document read.

Expected:

- User can view permitted records.
- Create/edit/delete controls are hidden.
- Direct manage requests return Forbidden.
- Role can be cloned and deactivated.
- System roles cannot be modified as custom roles.

### SEC-006 - Attempt Global role assignment

As Organization Owner, attempt to assign Super Administrator.

Expected:

- Role is unavailable or rejected.
- No Global assignment is created.

### SEC-007 - Multiple device sessions

Sign in using:

- Normal browser.
- Private browser.
- A second browser.

Expected:

- All sessions are listed.
- Revoking one session affects only that session.
- Logout All revokes every session.

### SEC-008 - Change password

Expected:

- Old password fails afterward.
- New password works.
- Other sessions are revoked.
- Current user receives a valid replacement session.

### SEC-009 - Login lockout

1. Enter wrong password five times.
2. Attempt correct password.

Expected:

- Account becomes Locked for 15 minutes.
- Correct password does not bypass lock.
- Error does not reveal whether a username exists.
- An authorized administrator can restore Active status.

Run the more-than-ten-attempt rate-limit case last.

### SEC-010 - Disabled user

Disable Atlas Disabled User while signed in on another device.

Expected:

- Existing session stops working.
- New login fails.
- User remains in history.
- Employee record is not deleted.

### SEC-011 - Last Owner protection

Attempt to disable/remove the only Organization Owner.

Expected:

- Operation is rejected.
- Tenant retains one active Owner.

---

## 13. Gate 6 - Employee Lifecycle

### EMP-001 - Create Employee

Create Arjun Kumar using:

- Company.
- Branch.
- Department.
- First and last name.
- Email and mobile.
- Designation.
- Manager.
- Employee type.
- Joining date.

Expected:

- Employee code is generated.
- Code is unique.
- Employee appears in list, preview and detail.
- Company, Branch and Department are consistent.

### EMP-002 - Form validation and foreign relationships

Test:

- Missing Company.
- Missing Branch.
- Missing Department.
- Missing first name.
- Invalid email.
- Branch from another Company.
- Department from another Company.
- Beacon Manager on Atlas Employee.

Expected:

- Invalid inputs are blocked.
- Foreign related IDs return safe Not Found.

### EMP-003 - Employee list

Test:

- Search name and code.
- Sort.
- Pagination.
- Status filter.
- Empty search.
- Clear search.
- Refresh.

Expected:

- Correct rows and counts.
- No raw API JSON or database error.

### EMP-004 - Preview drawer

Expected:

- Opens from row selection.
- Loads the selected Employee only while open.
- Identity, contact and organization summary are correct.
- Focus remains contained.
- Closing restores focus.
- View Full Details opens the correct record.

### EMP-005 - Employee detail

Verify functional tabs:

- Overview.
- Employment.
- Documents.
- Onboarding.
- Leave.

Expected:

- Assets and Activity remain hidden if not backed by the detail data source.
- No fake communication actions appear.

### EMP-006 - Edit Employee

Move an Employee between valid Atlas Departments/Designations.

Expected:

- List, preview and detail update.
- Employee code remains unchanged.
- Foreign relationships fail.

### EMP-007 - Employment statuses

Test:

- Active.
- Probation.
- Notice.
- Resigned/inactive.
- Terminated/inactive where supported.

Expected:

- Status and active flag remain consistent.
- Inactive Employee does not count as active on Dashboard.

### EMP-008 - Deactivate linked Employee

Open two sessions for the linked user, then deactivate the Employee.

Expected:

- Employee becomes inactive.
- Linked User becomes Disabled.
- Security version increments.
- All durable sessions are revoked.
- Both browsers lose access.
- Employee and User history remain.
- One complete audit exists.
- No partial deactivation occurs.

### EMP-009 - Concurrent creation

Save two Employee creates at nearly the same time.

Expected:

- Generated Employee codes remain unique.
- No database error detail leaks to the UI.

---

## 14. Gate 7 - Onboarding Templates

### ONT-001 - Create Draft

Create `Standard Employee Onboarding`.

Expected:

- Initial version is Draft.
- Draft is editable.

### ONT-002 - Department scope

Add Atlas HR, BIM and IT Departments.

Expected:

- Only Atlas Departments can be linked.
- Beacon Department is rejected.

### ONT-003 - Task design

Add approved task groups and tasks.

Verify:

- Title.
- Owner.
- Mandatory flag.
- Due timing.
- Dependency.
- Requirement/contribution where used.

### ONT-004 - Validate

Test missing Owner, missing required setup and invalid dependency.

Expected:

- Validation identifies the exact invalid task/section.
- Invalid configuration cannot be published.

### ONT-005 - Publish

Expected:

- Version becomes Published.
- Published version is assignable.
- Published content cannot silently change.

### ONT-006 - Create new Draft version

Expected:

- Running onboarding continues with its original version.
- Draft edits do not change an active instance.

### ONT-007 - Archive

Expected:

- Archived version cannot be newly assigned.
- Historical onboarding remains readable.

---

## 15. Gate 8 - Employee Onboarding

### EON-001 - Start

Start onboarding for Arjun Kumar.

Expected:

- One instance is created.
- Tasks are generated once.
- Status is In Progress.
- Progress begins correctly.

### EON-002 - Dependency control

Attempt Manager Welcome before Email Creation.

Expected:

- Invalid completion is blocked.

Then complete the tasks in the approved sequence.

Expected:

- Progress updates after each completion.
- Actor and timestamp are recorded.

### EON-003 - Skip optional task

Skip Office Introduction with a reason.

Expected:

- Optional task becomes Skipped.
- Mandatory tasks cannot be skipped unless business rules permit it.
- Optional skipped task does not block completion.

### EON-004 - Premature completion

Attempt to complete onboarding with a mandatory task open.

Expected:

- Completion is rejected.
- Status stays In Progress.

### EON-005 - Complete

Complete all mandatory tasks.

Expected:

- Status becomes Completed.
- Completion date is set.
- Dashboard active-onboarding count decreases.
- Employee detail reflects completion.

### EON-006 - Cancel

Start another instance and cancel with a reason.

Expected:

- Status becomes Cancelled.
- Open tasks do not continue as active tasks.
- Cancellation is audited.

### EON-007 - Concurrent completion

Two HR sessions complete the same onboarding together.

Expected:

- One succeeds.
- The stale request receives Conflict.
- Final state remains consistent.

---

## 16. Gate 9 - Employee Documents

### DOC-001 - Categories and Types

Create the approved categories and types.

Expected:

- Category and Type remain in the selected Company.
- Rules reload correctly.
- Inactive Type cannot be used for new records.

### DOC-002 - Passport metadata

Create Passport metadata for Arjun Kumar.

Test:

- Missing Document Number.
- Missing Expiry.
- Expiry before Issue Date.
- Valid metadata.

Expected:

- Invalid cases fail.
- Valid record begins Pending.

### DOC-003 - Lifetime document

Create Degree Certificate as Lifetime.

Expected:

- Expiry is not required.
- Lifetime label/filter is correct.

### DOC-004 - Verify

Expected:

- Status becomes Verified.
- Verifier and date are retained.
- Employee detail updates.

### DOC-005 - Reject

Reject with remarks.

Expected:

- Rejection reason is required.
- Status becomes Rejected.

### DOC-006 - Reset

Reset verification where supported.

Expected:

- Status returns to Pending.
- Previous action remains auditable.

### DOC-007 - Expiry classification

Create:

- Valid.
- Expiring.
- Expired.
- Lifetime.

Expected:

- Filters and labels classify each correctly.

### DOC-008 - File limitation

Expected:

- UI clearly represents metadata only.
- No fake upload success.
- No broken Download action.

---

## 17. Gate 10 - Attendance

### ATT-001 - Normal workday

As Atlas Employee 1:

1. Open My Workspace on `T0`.
2. Check in.
3. Check out.

Expected:

- One Attendance record.
- Correct Employee and Branch timezone.
- Present status calculated correctly.

### ATT-002 - Duplicate check-in

Check in from two tabs simultaneously.

Expected:

- One succeeds.
- Second returns safe Conflict.
- No duplicate record.

### ATT-003 - Duplicate checkout

Check out from two tabs simultaneously.

Expected:

- One succeeds.
- Second reports already checked out/conflict.
- One checkout time remains.

### ATT-004 - Late check-in

Check in after Shift start plus grace.

Expected:

- Attendance is marked late.

### ATT-005 - Night Shift

Check in before midnight and out after midnight.

Expected:

- Attendance belongs to the correct work period.

### ATT-006 - Missing checkout

Leave `T-1` without checkout.

Expected:

- HR page identifies missing checkout.
- It is not silently counted as a complete day.

### ATT-007 - HR correction

Correct missing checkout with remarks.

Expected:

- Corrected values display.
- Actor, action and request ID are audited.

### ATT-008 - Unauthorized correction

Attempt correction as Employee.

Expected:

- UI action is unavailable.
- Direct API action is Forbidden.

---

## 18. Gate 11 - Leave

### LEV-001 - Types and Policies

Create approved Types and Policies.

Expected:

- Company/Branch/Department/Designation relationships are valid.
- Optional Department and Designation can be cleared.
- Foreign scope is rejected.

### LEV-002 - Generate Balances

Expected:

- Eligible Employees receive correct entitlement.
- Repeat generation does not duplicate balances.
- Ineligible Employees do not receive the wrong Policy.

### LEV-003 - Draft request

Create Annual Leave for `T+5` through `T+6`.

Expected:

- Working-day quantity is correct.
- Draft appears in My Workspace.
- Balance is not consumed prematurely.

### LEV-004 - Edit Draft

Expected:

- Dates/reason update.
- Quantity recalculates.

### LEV-005 - Submit

Expected:

- Status becomes Pending.
- Editing follows state rules.
- Pending amount updates.

### LEV-006 - Approve

Expected:

- Status becomes Approved.
- Available balance decreases once.
- Dashboard on-leave count changes only when approved dates cover today.

### LEV-007 - Reject

Expected:

- Rejection remarks are required.
- Balance is not consumed.
- Employee can see the permitted status/reason.

### LEV-008 - Cancel

Expected:

- Status becomes Cancelled.
- Pending reservation is released.
- Balance follows approved cancellation rules.

### LEV-009 - Half-day

Expected:

- Only Types allowing half-day permit it.
- Quantity is `0.5`.

### LEV-010 - Overlap

Expected:

- Overlapping pending/approved request is rejected.
- Existing request remains unchanged.

### LEV-011 - Insufficient balance

Expected:

- Request beyond balance is rejected.
- No partial balance mutation occurs.

### LEV-012 - Non-working days

Expected:

- Quantity follows the Branch working calendar.

### LEV-013 - Concurrent approval

Two HR sessions approve one request together.

Expected:

- One succeeds.
- Second receives Conflict.
- Balance deducts once.

### LEV-014 - Foreign Tenant data

Attempt Atlas request using Beacon Employee/Leave Type.

Expected:

- Safe Not Found.
- No Beacon information is exposed.

---

## 19. Gate 12 - Assets

### AST-001 - Categories and Types

Expected:

- Type belongs to the selected Company and Category.
- Foreign Category is rejected.

### AST-002 - Create Asset

Create Dell Latitude Laptop with approved master data.

Expected:

- Status starts Available.
- All values reload correctly.

### AST-003 - Assign

Assign `UAT-LT-001` to Arjun Kumar.

Expected:

- Assignment becomes Assigned.
- Asset becomes Assigned.
- Asset is removed from available selection.
- Employee assignment view updates.

### AST-004 - Concurrent assignment

Assign `UAT-LT-002` to two Employees from two sessions.

Expected:

- One succeeds.
- Second receives Conflict.
- Only one active assignment exists.

### AST-005 - Normal return

Expected:

- Return date is saved.
- Outcome is Returned.
- Asset becomes Available.

### AST-006 - Duplicate return

Expected:

- `409 ASSET_ALREADY_RETURNED` or safe equivalent.
- Existing return remains unchanged.

### AST-007 - Damaged

Expected:

- Outcome is Damaged.
- Asset is not freely available unless explicitly allowed.

### AST-008 - Lost

Expected:

- Outcome/status is Lost.
- Asset cannot be assigned again.

### AST-009 - Move assigned Asset

Attempt to change Company/Branch while assigned.

Expected:

- Operation is rejected.
- Existing assignment remains unchanged.

### AST-010 - Foreign Employee

Assign Atlas Asset to Beacon Employee.

Expected:

- Safe Not Found.
- No assignment is created.

---

## 20. Gate 13 - Dashboard and My Workspace

### DSH-001 - Dashboard reconciliation

Compare:

- Total Employees against active Employee list.
- Present Today against Attendance.
- On Leave Today against approved Leave.
- Active Onboardings against In Progress onboarding.
- Recent Joiners against Joining Dates.
- Pending Tasks against onboarding tasks.
- Pending Leave Approvals against Leave requests.

Any mismatch is a defect.

### DSH-002 - Context switching

Switch Company and Branch.

Expected:

- Dashboard reloads.
- Values reflect the new context.
- Old context data is not left in the UI cache.

### DSH-003 - My Workspace

Verify the signed-in Employee's:

- Identity.
- Attendance.
- Leave balances.
- Leave requests.
- Documents.
- Assets.
- Onboarding.

Expected:

- URL/filter manipulation cannot show another Employee.

### DSH-004 - User without Employee link

Expected:

- Clear `EMPLOYEE_LINK_REQUIRED` experience.
- No Employee data is shown.

---

## 21. Gate 14 - Tenant Isolation

Use Atlas and Beacon in separate browser profiles.

For each entity:

1. Copy an Atlas record ID from the browser network request.
2. Sign in as Beacon.
3. Replace the Beacon request/filter ID with the Atlas ID.
4. Attempt list, detail, update and delete where applicable.

Repeat for:

- Company.
- Branch.
- Department.
- Designation.
- Employee.
- User.
- Session.
- Onboarding Template.
- Employee Onboarding.
- Document Type.
- Employee Document.
- Leave Type.
- Leave Policy.
- Leave Request.
- Asset Category.
- Asset Type.
- Asset.
- Employee Asset.

Expected:

- HTTP 404 or safe Not Found.
- No foreign name, code, status or metadata.
- No mutation.
- Client filters cannot widen scope.
- Tenant permissions are not combined.

Any Tenant exposure is P0. Stop testing immediately and report it.

---

## 22. Gate 15 - Responsive, Keyboard and Error Testing

Test every included page at:

- 1440px.
- 1024px.
- 768px.
- 390px.

Verify:

- No body-level horizontal overflow.
- Sidebar does not show an ugly visible scrollbar.
- Mobile navigation opens and closes.
- Sidebar does not stretch page content.
- Buttons do not overlap.
- Tables remain usable.
- Drawers fit within the viewport.
- Labels remain visible.
- Validation is readable.
- Keyboard focus is visible.
- Escape closes supported overlays.
- Focus returns after closing.
- Loading states appear.
- Empty states explain the next action.
- Errors show a safe message and request reference.
- No raw JSON, stack trace or database error.
- No console or hydration error.

Temporarily stop the backend while a page is open.

Expected:

- Recoverable network error is shown.
- Retry works after backend restart.
- No false success message appears.

---

## 23. Gate 16 - Audit and Data Integrity

A technical reviewer performs read-only verification.

For critical actions verify:

- Actor.
- Request ID.
- Action.
- Entity type and ID.
- Company Group/Company/Branch.
- Timestamp.
- No password, OTP, token, sensitive document content or database credential.

Critical audited workflows:

- User create/status/role changes.
- Employee create/update/deactivate.
- Onboarding start/task/cancel/complete.
- Document create/verify/reject/reset/delete.
- Attendance check-in/check-out/correction.
- Leave create/submit/approve/reject/cancel.
- Asset assignment/return.

Final integrity checks:

- [ ] One active Global Super Administrator remains.
- [ ] Every active User has an active role assignment.
- [ ] No tenant role has `platform.admin`.
- [ ] No active cross-company onboarding relationship exists.
- [ ] No assigned Asset has two active assignments.
- [ ] No approved Leave is deducted twice.
- [ ] No Employee has a foreign organization relationship.
- [ ] No active Session belongs to a Disabled User.
- [ ] Generated codes are unique.
- [ ] Prisma migration status is current.

---

## 24. Defect Handling

### 24.1 Severity

| Severity | Meaning |
| --- | --- |
| P0 | Tenant exposure, credential exposure or unrecoverable corruption |
| P1 | Login, registration or critical business workflow unusable |
| P2 | Major incorrect behaviour with a workaround |
| P3 | Minor UI, wording or non-blocking usability issue |

### 24.2 Required defect content

- Test Case ID.
- Build commit.
- User role.
- Active Company Group/Company/Branch.
- Exact input.
- Expected result.
- Actual result.
- Screenshot/video.
- Request ID.
- Browser console/network evidence.
- Severity.
- Related record IDs.

### 24.3 Fix and retest sequence

1. Reproduce on UAT.
2. Identify UI, API, permission, transaction or data failure.
3. Fix source code.
4. Use Prisma migration for schema changes.
5. Do not patch UAT data to hide a defect.
6. Run existing backend tests, lint and build.
7. Run frontend lint, type-check and clean build.
8. Restart applications.
9. Retest the original case.
10. Retest the preceding and following workflow.
11. Repeat the foreign-tenant test for the same action.
12. Update the result register.
13. Obtain tester and reviewer sign-off.

A defect is not closed only because the code builds.

---

## 25. Final Regression Order

Repeat the final regression in this order:

1. Health and public pages.
2. Login and sessions.
3. Registration and OTP.
4. Organization onboarding.
5. Organization hierarchy.
6. Users and permissions.
7. Employees.
8. Onboarding Templates.
9. Employee Onboarding.
10. Documents.
11. Attendance.
12. Leave.
13. Assets.
14. Dashboard.
15. My Workspace.
16. Tenant isolation.
17. Responsive and keyboard testing.
18. Audit and database integrity.

---

## 26. Release Acceptance

The Core ERP manual workflow is approved only when:

- [ ] Every critical happy-path workflow passes.
- [ ] Required validation cases pass.
- [ ] Permission cases pass.
- [ ] Every Tenant-isolation case passes.
- [ ] Dashboard values match live records.
- [ ] No unresolved P0 or P1 defect remains.
- [ ] Every P2 is fixed or formally accepted.
- [ ] Disabled Users retain no working Session.
- [ ] Employee deactivation disables the linked User.
- [ ] Concurrent Leave and Asset cases have one successful transition.
- [ ] Critical business mutations have audit evidence.
- [ ] No fake document-upload behaviour appears.
- [ ] Desktop, tablet and mobile passes have no blocking issue.
- [ ] No console, hydration or horizontal-overflow failure remains.
- [ ] Backend tests, Prisma validation, lint and build pass after fixes.
- [ ] Frontend lint, TypeScript and clean build pass after fixes.
- [ ] Known limitations are signed by the Product Owner.
- [ ] Organization Owner signs Tenant administration.
- [ ] HR Manager signs HR workflows.
- [ ] Asset Manager signs Asset workflows.
- [ ] Employee signs My Workspace.
- [ ] Technical reviewer signs security, audit and integrity.

---

## 27. Final Sign-Off

| Area | Owner | Result | Signature/Date |
| --- | --- | --- | --- |
| Tenant administration | Organization Owner |  |  |
| Users and permissions | Organization Owner / Security reviewer |  |  |
| Employee lifecycle | HR Manager |  |  |
| Onboarding | HR Manager |  |  |
| Documents metadata | HR Manager |  |  |
| Attendance | HR Manager / Employee |  |  |
| Leave | HR Manager / Employee |  |  |
| Assets | Asset Manager |  |  |
| Dashboard and My Workspace | HR Manager / Employee |  |  |
| Tenant isolation | Technical reviewer |  |  |
| Audit and integrity | Technical reviewer |  |  |
| Known limitations | Product Owner |  |  |
| Final Core ERP approval | Product Owner |  |  |

---

## 28. Assumptions

- Testing is performed manually through the application.
- Browser network inspection is used only when required.
- No new frontend test framework is added for this work.
- UAT uses a separate `dsp_erp_uat.dsp_pms` database.
- Actual test dates replace `T0`, `T+1`, `T+5` and similar examples.
- Actual controlled email addresses replace example addresses.
- Passwords remain outside this document.
- Internal codes remain server-generated.
- Hosting and deployment operations are a separate future plan.
- Secure document file upload/download is a future enhancement.
