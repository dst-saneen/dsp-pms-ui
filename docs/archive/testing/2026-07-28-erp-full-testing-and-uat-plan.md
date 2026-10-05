# ERP Full Testing and UAT Data Program

**Status:** Approved plan  
**Environment:** AWS development database `dsp_erp_dev`, schema `dsp_pms`  
**Initial scale:** 18 login users and 20 employees  
**Updated:** 28 July 2026

## 1. Summary

Build a complete testing foundation for the currently implemented ERP code
using:

- Backend Jest and Supertest tests.
- Frontend Vitest, React Testing Library and MSW tests.
- Playwright browser journeys.
- Shared business UAT data inside the existing AWS
  `dsp_erp_dev.dsp_pms` development schema.
- Two isolated UAT Company Groups for tenant-security testing.
- Full coverage of implemented UI modules.
- API characterization and gap reports for incomplete modules.

CRM, procurement, finance, BIM and training remain roadmap gaps. They must not
be represented as completed or covered by fake implementations.

The accidentally supplied `public.assessment_categories` statements are
unrelated to this ERP and are excluded from this plan.

## 2. Test Data Foundation

### 2.1 Data safety

Add guarded UAT seed, verification and cleanup utilities.

Required safeguards:

- Reject execution when `NODE_ENV=production`.
- Require database name `dsp_erp_dev` and schema `dsp_pms`.
- Require `ALLOW_AWS_UAT_AUTOMATION=true`.
- Prefix every seeded code with `UAT-`.
- Stable manual tenants use `UAT-ATLAS` and `UAT-BEACON`.
- Automated tests use `UAT-AUTO-<run-id>`.
- Never run `prisma migrate reset`, `prisma migrate dev`, `TRUNCATE`, schema
  drops or unscoped `deleteMany`.
- Run AWS database suites serially.
- Cleanup may delete only the exact Company Group IDs created by the current
  test run.
- Failed cleanup must report the remaining group code instead of broadening
  deletion.
- Passwords and real test email addresses must come from `.env.uat`, which
  remains excluded from Git.

Provide commands for:

1. UAT preflight.
2. Idempotent baseline seed.
3. Dataset verification.
4. Dry-run cleanup report.
5. Confirmed cleanup.
6. Automated run-tenant creation and disposal.

### 2.2 Organization dataset

| Data | Quantity |
| --- | ---: |
| Company Groups | 2 |
| Companies | 4, including one inactive |
| Branches | 5, including one inactive |
| Departments | 8 |
| Designations | 10 |
| Shifts | 4 |
| Users | 18 |
| Employees | 20 |

Use coherent synthetic organizations:

- **UAT Atlas Group:** two operating companies and one inactive legacy
  company.
- **UAT Beacon Group:** one independent company.
- Branches representing India HQ, Kochi Studio, Dubai Office and Beacon HQ.
- Departments including HR, Architecture, BIM, Projects, Finance and IT.
- Designations including HR Manager, Project Manager, BIM Manager, Senior
  Architect, BIM Coordinator, Revit Modeler, QA/QC Lead and Graduate Trainee.
- General, early, night and flexible shifts.

### 2.3 Accounts and roles

Create 18 test accounts:

- One existing Platform Super Administrator supplied through environment
  configuration. The seed must not create another global administrator.
- Atlas: Organization Owner, Company Administrator, HR Manager, Project
  Manager, Asset Manager, six Employees and one disabled user.
- Beacon: Organization Owner, HR Manager, two Employees and one
  must-change-password user.

Use reserved synthetic addresses such as `uat.atlas.hr@example.test`.
Passwords must be supplied through `UAT_DEFAULT_PASSWORD` and never committed
or logged.

Employee status distribution:

- 14 active.
- 3 probation.
- 1 notice period.
- 1 terminated.
- 1 resigned/inactive.

Include:

- Valid manager hierarchies.
- Recent joiners.
- Employees without login accounts.
- Employee-linked user accounts.
- Internally consistent Company, Branch, Department, Designation and Manager
  references.

### 2.4 Business transaction dataset

Seed coherent records:

- **Leave:** four leave types, applicable policies, approximately 60 balances
  and 14 requests across draft, pending, approved, rejected and cancelled
  states.
- **Attendance:** approximately 20 working days containing present, absent,
  half-day, leave, holiday, late check-in and missing checkout cases.
- **Documents:** four categories, eight document types and 30 employee
  documents covering verified, pending, rejected, expiring and expired cases.
- **Onboarding:** three templates, task groups, requirements, contributions,
  approximately 15 tasks and five employee onboarding instances.
- **Assets:** four categories, eight types and 24 assets covering available,
  assigned, returned, damaged and lost states.
- **Resources:** three resource types, eight resources and six employee
  assignments.
- **Projects:** four projects, approximately 12 stages, 24 tasks and
  representative team allocations.
- **Work management:** schedules, work items, sessions, submissions, reviews
  and work logs for two working weeks.
- **HR requests and approvals:** six requests covering submitted, pending,
  approved and rejected paths.
- **Payroll:** eight salary components, 12 employee salary records, tax
  profiles, deductions, one draft run and one processed run.
- **Separations and clearance:** one completed resignation and one pending
  separation.

Audit and security events must be produced by actual test actions rather than
inserted directly.

The manager dashboard remains explicitly demo-sourced. Dashboard sample totals
must not be used to validate database totals until a real aggregation API
replaces the fixture.

## 3. Automation Foundation

### 3.1 Backend

- Retain Jest and Supertest.
- Replace scaffold-only `toBeDefined()` tests with validation, service policy,
  error mapping, authorization and transaction tests.
- Run integration tests through the real Nest application.
- Exercise PostgreSQL and Redis behavior through guarded, run-specific UAT
  tenants.
- Run RDS integration suites serially.
- Mock only external boundaries such as SMTP where deterministic behavior is
  required.

### 3.2 Frontend

Add:

- Vitest.
- React Testing Library.
- `@testing-library/user-event`.
- MSW for typed API responses and failures.
- Coverage reporting for changed shared and feature components.

Test:

- Loading, success, empty and error states.
- Form validation.
- Drawers, dialogs and focus restoration.
- Tables, sorting, filtering and pagination.
- Permission-based navigation.
- Session expiration and normalized API errors.

### 3.3 Browser automation

Add Playwright with:

- Separate authenticated storage states for each role.
- Desktop and mobile projects.
- Serial AWS state-changing tests.
- API-assisted setup only within the current `UAT-AUTO-<run-id>` tenant.
- Cleanup restricted to the exact generated tenant IDs.
- HTML, screenshot, trace and JUnit evidence on failure.

### 3.4 Email verification

- Repeatable automation uses mocked SMTP or development bypass.
- Run one controlled SMTP delivery test through `UAT_REAL_EMAIL`.
- Never commit or print the real test address, OTP, SMTP token or email body.
- Verify resend cooldown, expiry, attempt limits and failed-delivery recovery
  independently from the real-delivery smoke test.

## 4. Module Test Matrix

### 4.1 Health, configuration and logging

Test:

- Environment validation and fail-fast startup.
- Liveness and readiness endpoints.
- PostgreSQL and Redis degradation.
- Request-ID propagation.
- Structured production logs.
- Secret, OTP and email-content redaction.
- Graceful shutdown.

### 4.2 Registration and authentication

Test:

- Public capability discovery.
- Organization registration.
- OTP generation, hashing, expiry and maximum attempts.
- Resend cooldown and previous-code invalidation.
- Concurrent OTP verification.
- Failed SMTP delivery and resumable registration.
- Login success and failure.
- Account lockout.
- Mandatory password change.
- Access-token expiry.
- Refresh-token rotation and reuse detection.
- Logout, sign-out-all and individual session revocation.

### 4.3 Platform setup

- Execute one controlled first-owner acceptance before the setup is closed.
- Verify the supplied setup token is required.
- Verify only one global Platform Super Administrator can win a concurrent
  first-owner setup.
- After creation, confirm capability discovery and setup endpoints remain
  unavailable.
- Cover repeatable first-owner conditions at service level because the shared
  development schema cannot safely recreate first-time global state.

### 4.4 Users, roles and permissions

Test:

- User creation and employee linking.
- Temporary password and forced change.
- Activation and disable.
- Role assignment and replacement.
- Scope validation.
- Forbidden global-role grants by tenant administrators.
- Security-version/session invalidation.
- Navigation and API permission consistency.

### 4.5 Tenant security

Test that Atlas users cannot read or mutate Beacon:

- Companies.
- Branches.
- Departments.
- Employees.
- Assets.
- Users.
- Sessions.

Explicit foreign Company Group, Company and Branch IDs must return not-found
without exposing that the foreign record exists. Permissions from different
organizations must never be combined.

### 4.6 Company hierarchy

Cover Company Group, Company, Branch, Department, Designation and Shift:

- Create, read, update and allowed status changes.
- Unique codes.
- Active/inactive states.
- Search, sorting, filtering and pagination.
- Loading, empty and error UI states.
- Invalid parent relationships.
- Organization switching.
- Cross-tenant denial.

### 4.7 Employees and lifecycle

Test:

- Employee creation and server-side code generation.
- Concurrent employee creation.
- Search, filters, sorting and pagination.
- Preview-sheet lazy loading.
- Detail and edit flows.
- Manager and designation validation.
- Branch/department/company consistency.
- Employee profile tabs.
- Company assignments.
- Deactivation.
- Separation approval and completion.
- Clearance.
- Linked-user disabling.

### 4.8 Employee documents

Test:

- Category and type dependencies.
- Required document numbers.
- Required expiry dates.
- Lifetime documents.
- Verification states.
- Expired and expiring documents.
- Employee-detail integration.
- Missing-file behavior.
- Cross-tenant document denial.

### 4.9 Onboarding

Test:

- Template and version CRUD.
- Department/designation scope.
- Task groups.
- Requirements and contributions.
- Employee onboarding assignment.
- Progress calculation.
- Mandatory-task completion.
- Cancellation.
- Completed onboarding.

The explicitly unimplemented workflow engine must be documented as a release
blocker and must not be hidden with fake test behavior.

### 4.10 Leave and attendance

Test:

- Leave types and policies.
- Employee balances.
- Half-day requests.
- Overlapping-date prevention.
- Insufficient balance.
- Draft, submit, approve, reject and cancel.
- Concurrent approval.
- Balance and pending-value consistency.
- Shift assignments.
- Check-in and checkout.
- Late attendance.
- Half-day calculation.
- Missing checkout.
- Attendance summaries.

Verify the current frontend permission versus backend `platform.admin`
fallback mismatch and record it as a blocking defect.

### 4.11 Assets, resources and clearance

Test:

- Category/type dependencies.
- Asset CRUD and duplicate codes.
- Branch-specific assets.
- Assignment and return.
- Damaged and lost states.
- Availability restoration.
- Resource types and resources.
- Employee resource assignment.
- Employee-clearance linkage.
- Tenant isolation.

### 4.12 Projects and work management

API-level testing must cover:

- Projects.
- Stages.
- Team members.
- Tasks and valid status transitions.
- Participants.
- Submissions and reviews.
- Work schedules and items.
- Work sessions.
- Work logs.

Project Manager must remain denied until project scope adapters and permission
activation are completed. Record missing UI and security adapters as release
gaps.

### 4.13 HR requests, approvals and generated documents

Test:

- Request types and templates.
- Workflow configuration.
- Approval steps.
- Requester and approver rules.
- Approval and rejection.
- Missing or invalid workflow configuration.
- Generated-document failures.
- Transaction rollback.
- Audit attribution.

### 4.14 Payroll

Test:

- Salary components.
- Employee salary lines.
- Tax profiles.
- Deductions.
- Duplicate monthly runs.
- Calculation consistency.
- Draft-to-processed transition.
- Tenant isolation.

Payroll UI remains planned and is excluded from browser-pass requirements.

### 4.15 Dashboard and design system

Test:

- Dashboard sample-data marker.
- Responsive card and table layouts.
- Loading, empty and error specimens.
- No horizontal overflow.
- No application console or hydration errors.
- Production `404` for `/design-system`.
- No accidental UAT or cross-tenant data leakage.

### 4.16 Audit

For business mutations verify:

- Actor.
- Request ID.
- Timestamp.
- Action.
- Entity.
- Company/tenant context.
- Sensitive before/after values are excluded.

### 4.17 Roadmap-only domains

CRM, clients, vendors, procurement, finance, BIM and training receive gap
entries listing their missing schema, API and UI dependencies. They are
excluded from the passing functional-test denominator.

## 5. Browser and UX Coverage

Run critical pages at:

- 1440px.
- 1024px.
- 768px.
- 390px.

Cover:

- Login and password change.
- Organization registration and OTP.
- Dashboard.
- Company Groups, Companies, Branches, Departments, Designations and Shifts.
- Users and Roles.
- Employee list, preview, detail, create and edit.
- Employee documents.
- Onboarding templates and employee onboarding.
- Leave.
- Asset categories, types and assets.

Validate:

- Keyboard order.
- Visible focus.
- Focus containment and restoration.
- Drawers, dialogs and tabs.
- Clearable selects.
- Form errors.
- Table sorting, filters and pagination.
- Loading, empty, error and retry states.
- Responsive layout and body overflow.

## 6. Non-Functional Gates

### Accessibility

- Zero critical or serious automated accessibility violations.
- WCAG 2.2 AA contrast.
- Complete manual keyboard journey.
- Screen-reader labels for forms, tables, dialogs and OTP controls.

### Performance

Initial target: 20 concurrent users.

- Read API p95 below 750 ms.
- Write API p95 below 1.5 seconds.
- Error rate below 1%.
- No database-pool exhaustion.
- No query timeout.
- No lock timeout.

### Security

Test:

- IDOR and tenant isolation.
- Mass assignment.
- Malformed identifiers.
- Injection payloads.
- Registration/login rate limiting.
- CORS.
- Secure cookie behavior.
- JWT validation.
- Refresh-token reuse.
- File metadata validation.
- Sensitive-data logging.

### Resilience

Test:

- Redis unavailable with PostgreSQL fallback.
- SMTP timeout.
- Database readiness failure.
- Duplicate submissions.
- Retry behavior.
- Graceful process termination.

### Data integrity

Verify:

- Unique constraints.
- Foreign keys.
- Leave and monetary precision.
- Valid status transitions.
- Transaction rollback.
- No orphan records.
- No cross-company references.

### Operational readiness

Verify:

- Prisma migration status.
- Health probes.
- Structured logs.
- Request correlation.
- Backup confirmation.
- Sanitized test evidence.

## 7. Execution Waves

### Wave 1 — Harness and safety

- Add backend, frontend and browser test tooling.
- Add AWS safety guards.
- Add seed manifest and UAT commands.
- Verify dry-run behavior.

### Wave 2 — Data foundation

- Create Atlas and Beacon UAT tenants.
- Create 18 users and 20 employees.
- Add master and transactional data.
- Run relationship and count verification.

### Wave 3 — Security foundation

- Complete authentication and session automation.
- Complete RBAC tests.
- Complete tenant-isolation tests.
- Complete registration and OTP tests.

### Wave 4 — Business modules

- Cover organization structure.
- Cover employees and lifecycle.
- Cover documents and onboarding.
- Cover leave and attendance.
- Cover assets and resources.

### Wave 5 — Incomplete-domain characterization

- Characterize project and work APIs.
- Characterize approval and document-generation APIs.
- Characterize payroll APIs.
- Create blocker tickets for missing security adapters, workflows and UI.

### Wave 6 — Release gates

- Run accessibility.
- Run performance and concurrency.
- Run resilience and security.
- Complete business UAT.
- Fix defects.
- Run full regression.

## 8. Acceptance Criteria

Release acceptance requires:

- Backend build, Prisma validation, lint and meaningful tests pass.
- Frontend TypeScript, lint, production build, Vitest and Playwright pass.
- Critical authentication, tenancy, employee, leave and asset journeys pass
  100%.
- No cross-tenant data exposure.
- No P0 or P1 defects.
- P2 defects require documented acceptance.
- Security-sensitive services achieve at least 90% branch coverage.
- Implemented business services achieve at least 80% line and 70% branch
  coverage.
- Changed frontend features achieve at least 80% line coverage.
- Browser runs contain no application console errors, hydration errors or
  horizontal overflow.
- UAT seed verification reports exactly the expected counts and relationships.
- Automated cleanup affects only the current `UAT-AUTO-<run-id>` tenant.
- Every incomplete or roadmap-only domain appears in a signed gap report
  instead of being reported as tested.
