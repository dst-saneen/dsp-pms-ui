# ERP Production-Readiness Remediation — Detailed Engineering Work Order

**Repository:** `C:\DataScape\HRMS\ERP`

**Database:** PostgreSQL `dsp_erp_dev`, schema `dsp_pms`

**Starting commit:** `fdee75f922c27444f7c2a86f163ca6fc3ec6e919`

## 1. Objective and Current Baseline

Bring the merged three-developer implementation to a release-candidate state without redesigning the UI or changing established authentication contracts.

The remediation is complete only when:

- Merged code and deployed database schema match.
- Tenant users can access approved modules according to their roles.
- No Company Group, Company or Branch can read or modify another tenant’s records.
- Backend and frontend builds, lint and full automated test suites pass.
- Leave, attendance, onboarding, documents and asset-assignment workflows pass role-based UAT.
- No fake actions or reachable `Not implemented` methods remain in released routes.
- Deployment and rollback evidence is recorded.

### Confirmed starting failures

- One unapplied migration:
  - `20260731190000_security_tenant_roles_and_account_recovery`
- Live database lacks invitation/reset tables and new role/audit columns.
- Workforce routes fall back to `platform.admin`.
- Attendance and leave administrative queries are not consistently tenant-scoped.
- Leave responses are wrapped twice.
- Frontend TypeScript and production build fail.
- Frontend lint: 43 errors and 20 warnings.
- Backend lint: 813 errors.
- Full backend tests: 107 failed suites, 15 passed.
- Workflow runtime and some UI actions remain placeholders.
- UAT data is insufficient for end-to-end testing.
- 51 live foreign-key relationships lack a matching leading index.

## 2. Non-Negotiable Engineering Rules

- Do not modify, rename, squash or delete an applied migration.
- Do not mark a migration applied unless its SQL completed successfully.
- Do not use `prisma db push` against shared or AWS databases.
- Do not run destructive automated tests against AWS RDS.
- Successful API responses remain:

```json
{
  "success": true,
  "data": {}
}
```

- Return exactly one response envelope.
- Missing permission returns `403`.
- Missing or out-of-scope records return `404`.
- Invalid state transitions return `409` with a stable code.
- All tenant scope comes from the authenticated server-side session.
- Client IDs may narrow the active scope but must never expand it.
- Business mutations and their audit records must commit or roll back together.
- No passwords, tokens, OTPs, SMTP secrets, document content, HR personal data, payroll content or complete request bodies may enter logs.
- Preserve existing authentication cookies, RS256 access tokens, refresh-session rotation, OTP registration and API routes.

## 3. Delivery Sequence and Dependencies

### Phase A — Stabilize the branch

1. Create a remediation branch from the current merged `master`.
2. Confirm the worktree is clean.
3. Install dependencies using the existing lockfiles.
4. Generate Prisma Client.
5. Record the initial build, lint, test and migration-status results.
6. Do not apply database migrations yet.
7. Freeze new feature development until the release gates pass.

### Phase B — Backend tenant security and API correctness

Complete tenant scoping, permission routing, response correction and audit transactions before activating tenant permissions.

### Phase C — Frontend integration and quality gates

Fix TypeScript, navigation permissions, lint and fake actions after backend contracts are stable.

### Phase D — Test repair and dormant-code isolation

Make the standard test and lint commands meaningful and remove released paths to unfinished code.

### Phase E — Final database migration

Create the new activation/index migration only after backend and frontend work is rebased and stable.

### Phase F — Staging migration, UAT and release

Validate both pending migrations in a disposable database and staging before AWS deployment.

## 4. Work Package A — Database Compatibility

### A1. Validate the existing pending migration

Validate:

`20260731190000_security_tenant_roles_and_account_recovery`

It must create or change:

- `user_invitations`
- `password_reset_challenges`
- Nullable `users.passwordHash` for invited users
- User invitation lifecycle constraint
- Role Company Group ownership and normalized name
- Tenant-assignable permission flag
- Audit request and organization context
- Attendance, self-service and asset-assignment permissions
- Existing system-role mappings included in the migration

### A2. Disposable database migration test

Create an empty disposable PostgreSQL database and run all migrations from zero.

Then test an upgrade database representing the current AWS migration level:

1. Restore a sanitized copy of the current schema.
2. Confirm the current migration status.
3. Run `prisma migrate deploy`.
4. Validate constraints and backfills.
5. Run backend foundation and workforce tests.
6. Run account invitation and password-reset tests.
7. Drop only the disposable database after evidence is saved.

### A3. Migration preflight checks

Before migration, record:

- Migration history and pending migrations.
- Counts for Company Groups, Companies, Branches and Employees.
- Counts for Users, Roles, Permissions and Role Assignments.
- Counts for Sessions, Pending Registrations and Audit Logs.
- User status and null-password distribution.
- Duplicate role names inside a Company Group.
- Invalid or orphaned role assignments.
- Unvalidated constraints.
- Tables without primary keys.

### A4. Migration post-checks

After migration, verify:

- No pending migrations.
- Both new security tables exist.
- `passwordHash` is nullable.
- INVITED users may have no password; active users must have a password.
- All new audit columns exist.
- All role Company Group fields and constraints exist.
- Permission codes are unique.
- Role assignments still reference valid users, roles and scopes.
- Existing Users and Sessions have not been deleted.
- Registration, invitation and password-reset flows build and test successfully.

## 5. Work Package B — Explicit Permission Contract

### B1. Standard route-family mappings

Add reviewed mappings for:

| Backend route family | Read permission | Manage permission |
| --- | --- | --- |
| `/dashboard/manager` | `dashboard.read` | Not applicable |
| `/attendance` | `hr.attendance.read` | `hr.attendance.manage` |
| `/leave-types` | `hr.leave.read` | `hr.leave.manage` |
| `/leave-policies` | `hr.leave.read` | `hr.leave.manage` |
| `/leave-requests` | `hr.leave.read` | `hr.leave.manage` |
| `/employee-leave-balances` | `hr.leave.read` | `hr.leave.manage` |
| `/holidays` | `hr.leave.read` | `hr.leave.manage` |
| `/employee-leave` | `hr.leave.read` | `hr.leave.manage` |
| `/me/*` GET | `hr.self.read` | Not applicable |
| `/me/*` POST/PATCH | Not applicable | `hr.self.manage` |
| `/employee-onboarding` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/employee-onboarding-task` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-template*` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-workspace` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-department-template` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-task-group` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-contributions` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-requirements` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-execution-profiles` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/onboarding-execution-rules` | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/employee-documents` | `hr.documents.read` | `hr.documents.manage` |
| `/employee-document-types` | `hr.documents.read` | `hr.documents.manage` |
| `/employee-document-categories` | `hr.documents.read` | `hr.documents.manage` |
| `/employee-assets` | `assets.assignments.read` | `assets.assignments.manage` |

Keep these platform-only:

- Generic workflow runtime
- Approval engine administration
- Payroll
- Project/task execution until project-derived scope is implemented
- Generic document generator
- Other controllers without a reviewed scope adapter

### B2. Permission implementation rules

- Use route-policy inference for conventional GET versus mutation CRUD.
- Use `@RequirePermissions` for:
  - Manager dashboard
  - Self-service routes
  - Approval/rejection operations
  - Balance generation
  - Attendance correction
  - Document verification/rejection/reset
  - Asset return and reassignment
  - Onboarding publish/archive/complete/reopen operations
- Place the `employee-assets` rule before the generic asset rule.
- Never depend only on a route name for record ownership.
- Update `docs/architecture/security-route-matrix.md` to match actual runtime behavior.

### B3. Final system-role matrix

Legend: `R` = read, `M` = manage, `S` = self-service.

| Permission area | Org Owner | Company Admin | HR Manager | Project Manager | Asset Manager | Employee |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dashboard | R | R | R | R | R | R |
| Tenant users | R/M | R/M | — | — | — | — |
| Tenant custom roles | R/M | R/M | — | — | — | — |
| Company Group | R/M | — | — | — | — | — |
| Companies | R/M | R/M | R | R | R | — |
| Branches | R/M | R/M | R | R | R | — |
| Structure | R/M | R/M | R | R | R | — |
| Employees | R/M | R/M | R/M | R | R | — |
| Onboarding | R/M | R/M | R/M | — | — | — |
| Employee documents | R/M | R/M | R/M | — | — | — |
| Leave | R/M | R/M | R/M | — | — | — |
| Attendance | R/M | R/M | R/M | — | — | — |
| Assets | R/M | R/M | R | — | R/M | — |
| Asset assignments | R/M | R/M | R | — | R/M | — |
| Own workspace | S | S | S | S | S | S |
| Global platform | — | — | — | — | — | — |

Super Administrator continues to use only `platform.admin`.

### B4. Tenant-assignable permissions

Set `isTenantAssignable=true` only for accepted tenant domains:

- Dashboard
- Security users and roles
- Organization hierarchy
- Employees
- Onboarding
- Employee documents
- Leave
- Attendance
- Employee self-service
- Assets
- Asset assignments

Keep projects, payroll, workflow, approval and audit administration non-assignable until their scope adapters and acceptance tests are complete.

## 6. Work Package C — Record-Level Tenant Isolation

### C1. Shared scope architecture

Extend the existing employee-domain scope service instead of creating another independent scope implementation.

Add reusable filters for:

- Attendance through Employee
- Leave Request through Employee
- Leave Balance through Employee
- Leave Type through Company
- Leave Policy through Company and optional Branch
- Holiday through Company and optional Branch
- Employee Asset through Employee and Asset
- Onboarding configuration through owning Company
- Dashboard aggregates through Company Group, Company or Branch

### C2. Scope semantics

#### Global

- Super Administrator may access all records.

#### Company Group

- May access records whose Company belongs to the active Company Group.
- Cannot access another Company Group even when a valid ID is supplied.

#### Company

- May access only records belonging to the active Company.
- Branch-neutral Company records are allowed only inside that Company.

#### Branch

- Employee-derived records must belong to the active Branch.
- Company-wide configuration may be readable only where business rules require it.
- Branch-specific mutations must use the active Branch.
- An employee in another Branch of the same Company is still out of scope.

### C3. Attendance changes

Harden:

- `create`
- `findAll`
- `findOne`
- `checkIn`
- `checkOut`
- `correct`

Rules:

- Resolve the Employee using `EmployeeDomainScopeService.assertEmployeeInScope`.
- Never validate only `companyId` for a Branch-scoped user.
- `findAll` must include `employee: employeeWhere()`.
- `findOne` must use `findFirst` with record ID, active status and Employee scope.
- Correction requires `hr.attendance.manage`.
- Self check-in/check-out derives Employee ID from the authenticated User link.
- Administrative check-in/check-out may accept Employee ID only after scope validation.
- Return `404` for cross-tenant Employee or Attendance IDs.

### C4. Leave changes

Harden:

- Leave Type CRUD
- Leave Policy CRUD
- Leave Balance CRUD and generation
- Holiday CRUD
- Leave Request CRUD
- Submit, approve, reject and cancel
- Pending approvals

Rules:

- Leave Type Company must be inside active scope.
- Leave Policy Company, Branch, Department, Designation and Leave Type must belong to one valid hierarchy.
- Leave Balance Employee and Leave Type must belong to the same Company.
- Leave Request Employee and Leave Type must belong to the same Company.
- List queries always apply Employee/Company scope before user filters.
- Balance generation processes only Employees inside the active scope.
- Approvers must be authorized and inside the same permitted tenant boundary.
- A manager cannot approve their own request unless an explicit approved rule exists; default is reject.
- All state transitions retain existing serializable retry and conflict handling.
- Out-of-scope records return `404`, not `403`.

### C5. Onboarding, document and asset verification

Re-audit existing Developer 2 scope adapters:

- Every list, summary, count and expiry query uses the same scope.
- Every child lookup inherits scope through Employee, Company, Template or Asset.
- Template publishing verifies all scopes and task dependencies belong to the same tenant.
- Document verification checks Employee, Document Type and verifier scope.
- Asset assignment checks Employee and Asset scope in the same transaction.
- Branch-scoped Asset Managers cannot assign assets to another Branch.
- Company-level unassigned assets may be assigned only inside the same Company.

## 7. Work Package D — Response and Transaction Integrity

### D1. Leave response correction

Remove manual success envelopes from the Leave Request controller.

Controller methods return only domain data:

```ts
return this.leaveRequestService.findAll(filters);
```

The global interceptor remains the only success-envelope owner.

Add an HTTP test asserting:

```json
{
  "success": true,
  "data": []
}
```

Explicitly reject:

```json
{
  "success": true,
  "data": {
    "success": true,
    "data": []
  }
}
```

### D2. Transactional audits

Change the audit interface to support an existing Prisma transaction:

```ts
interface AuditWriteOptions {
  userId?: string;
  tx?: Prisma.TransactionClient;
}
```

Required behavior:

- When `tx` exists, write the audit using that transaction.
- Otherwise use the shared Prisma service.
- Mutation and audit either both commit or both roll back.
- Audit metadata comes from request context.
- Audit payload includes safe field changes only.

Apply transactional audits to:

- User status and role changes
- Invitation lifecycle
- Custom-role lifecycle
- Employee create/update/deactivate
- Onboarding start/task transition/completion
- Document create/verify/reject/reset
- Asset assign/return/reassign
- Leave create/submit/approve/reject/cancel
- Attendance create/check-in/check-out/correct

### D3. Concurrency protections

Verify conditional mutation predicates for:

- Single-use invitation acceptance
- Single-use password reset
- Refresh-token rotation
- Leave submit/approve/reject/cancel
- Leave balance deduction/restoration
- Attendance check-in/check-out
- Asset active assignment uniqueness
- Onboarding task completion/reopen
- Onboarding final completion

A stale state must return `409` and must not partially update related records.

## 8. Work Package E — New Database Migration

Create only after all earlier code changes are rebased:

`20260803120000_activate_tenant_workforce_permissions_and_core_fk_indexes`

### E1. Permission changes

The migration will:

- Set accepted permission codes tenant assignable.
- Insert missing role-permission mappings.
- Use deterministic IDs consistent with existing migrations.
- Use `ON CONFLICT DO NOTHING` for mappings.
- Not remove historical role assignments.
- Not grant `platform.admin` to a tenant role.

### E2. Core indexes

Add missing leading indexes for:

- `companies(companyGroupId)`
- `departments(companyId)`
- `employees(companyId)`
- `employees(branchId)`
- `employees(departmentId)`
- `employees(designationId)`
- `employees(managerId)`
- `auth_sessions(activeCompanyGroupId)`
- `auth_sessions(activeCompanyId)`
- `auth_sessions(activeBranchId)`
- `user_role_assignments(roleId)`
- `users(defaultCompanyId)`
- `users(defaultBranchId)`
- `leave_requests(leaveBalanceId)`
- `attendances(shiftId)`

Review the remaining missing foreign-key indexes individually. Add them only where the relationship is used for joins, cascading deletes, tenant filters or operational reporting.

Do not add duplicate indexes where a unique or composite index already has the same leading columns.

### E3. Index validation

For each new index:

- Confirm no equivalent index already exists.
- Confirm migration works with current row counts.
- Use `EXPLAIN` for important Company, Employee, Session, Leave and Attendance queries.
- Confirm foreign-key deletes and updates do not require full child-table scans.
- Record final index names and query plans in the closure report.

## 9. Work Package F — Frontend Corrections

### F1. TypeScript build blocker

Change the Users employee lookup from a direct function reference to a zero-argument query function:

```ts
queryFn: () => LookupService.getManagers()
```

Verify:

- Query data is inferred as the Employee option array.
- `.map()` is type-safe.
- No implicit `any` remains.
- Optional company filtering still works through an explicitly supplied string.

### F2. Navigation permissions

Require:

- Dashboard → `dashboard.read`
- My Workspace → `hr.self.read`
- Attendance → `hr.attendance.read`
- Onboarding → `hr.onboarding.read`
- Documents → `hr.documents.read`
- Leave → `hr.leave.read`
- Asset assignment UI → `assets.assignments.read`
- Users → `security.users.read`
- Roles → `security.roles.read`

Rules:

- A parent group is hidden when all children are unavailable.
- Buttons use manage permissions independently from page-read permissions.
- Hidden buttons cannot be recovered merely through CSS or client state.
- Backend authorization remains authoritative.

### F3. React and lint corrections

Resolve state-in-effect errors:

- Dashboard data loading moves to TanStack Query.
- Attendance correction form uses keyed/default form state or React Hook Form reset.
- Branch working-days editor uses query data as form defaults without synchronous local-state copying.

Resolve:

- Explicit `any` in Employee Workspace and onboarding types.
- Empty interface aliases.
- Unused imports and variables.
- Unstable `useMemo` dependencies.
- React Hook Form watch warnings using `useWatch` where appropriate.
- Onboarding mapper and table row types.
- Service response types.
- Formatting errors.

Do not disable lint rules globally to obtain a passing result.

### F4. Fake and placeholder actions

- Remove fake Asset, Asset Category and Asset Type delete handlers.
- Hide Delete until a backend delete/deactivate workflow and confirmation dialog exist.
- Remove production `console.log`.
- Keep only actions with a real handler.
- Remove unreachable demo dashboard indicator unless a development-only provider sets `source="demo"`.

### F5. Generated Next.js cache

Before validation:

```powershell
Remove-Item -Recurse -Force .next
```

Then run TypeScript and production build from clean generated output.

Do not commit `.next`.

## 10. Work Package G — Test-Suite Rehabilitation

### G1. Focused tests to retain

Keep and extend:

- Foundation authentication/security tests
- Employee-domain scope tests
- Onboarding/document/asset tests
- Workforce leave/attendance/self-service/dashboard tests

### G2. Generated scaffold tests

For the 107 failing generic suites:

- Remove tests that only instantiate a controller/service without dependencies and provide no business assertion.
- Do not mark them skipped.
- For released modules, replace them with meaningful service/controller behavior tests.
- For planned modules, remove nonfunctional smoke specs from the released test set.
- Do not hide failures by changing Jest to ignore active released modules.

### G3. Required new backend tests

#### Permission routing

- Every approved route family maps to the expected permission.
- GET uses read.
- POST/PATCH/PUT/DELETE uses manage.
- Self-service GET and mutation permissions differ.
- Unknown routes remain `platform.admin`.

#### Tenant isolation

For Company Group, Company and Branch scopes:

- List excludes foreign records.
- Detail returns `404`.
- Create with foreign IDs returns `404`.
- Update/delete foreign record returns `404`.
- Global Super Administrator succeeds.
- Client filters cannot widen scope.

Cover:

- Attendance
- Leave Type
- Leave Policy
- Leave Balance
- Leave Request
- Holiday
- Onboarding
- Documents
- Asset assignments
- Manager dashboard

#### API contract

- Exactly one success envelope.
- Validation error structure remains compatible.
- Unexpected error contains request ID.
- No raw Prisma error reaches the client.

#### Transactions

- Audit failure rolls back the business mutation.
- Business failure writes no audit.
- Concurrent state transitions allow exactly one winner.
- Duplicate active Asset assignment is rejected.
- Duplicate attendance for Employee/date is rejected.

### G4. Frontend validation

No new frontend test framework is introduced in this remediation.

Use:

- ESLint
- TypeScript
- Next production build
- Browser smoke testing
- Keyboard and responsive verification

## 11. Work Package H — Dormant and Incomplete Code

### H1. Workflow runtime

The generic workflow engine remains planned.

- Do not implement it during this remediation.
- Remove its unimplemented repositories/providers from active module registration.
- Remove the unused `EmployeeOnboardingWorkflowService` provider.
- Verify no released controller calls a method that throws `Not implemented`.
- Keep source only when clearly documented as inactive architecture scaffolding.
- Keep workflow navigation hidden.

### H2. Planned modules

The following remain platform-only or hidden unless independently accepted:

- Generic workflow runtime
- Generic approvals configuration
- Payroll
- Projects/task execution
- HR requests
- Document generator
- Other unfinished scaffold modules

Update module metadata and documentation to distinguish:

- Available
- Available with restricted role
- Planned
- Internal scaffold

## 12. UAT Data Specification

Use a disposable or dedicated UAT database.

Do not seed AWS shared development or production databases without explicit approval.

### UAT personas

Create 17 users:

- 1 Platform Super Administrator
- Tenant A:
  - 1 Organization Owner
  - 1 Company Administrator
  - 1 HR Manager
  - 1 Project Manager
  - 1 Asset Manager
  - 3 Employees
- Tenant B:
  - Same eight tenant users

Each non-owner operational user must be linked to an Employee where self-service is tested.

### Organization data

For each tenant:

- 1 Company Group
- 2 Companies
- 2 Branches per Company
- Departments including HR, Operations and Projects
- Designations for each test persona
- At least one Branch in `Asia/Kolkata`
- One second Branch using another valid timezone for multi-timezone dashboard testing

### Workforce data

Create:

- Two Shifts, including one overnight Shift
- Branch working days
- Two Holidays
- Annual and sick Leave Types
- Company and Branch Leave Policies
- Leave Balances for every Employee
- Draft, submitted, approved, rejected and cancelled Leave Requests
- Present, absent, half-day and leave Attendance examples

### Onboarding data

Create:

- One active Template
- One published current Version
- Company/Branch/Department/Designation scope
- Two Task Groups
- At least five Tasks
- One dependency chain
- Mandatory and optional tasks
- One active Employee onboarding
- One completed onboarding

### Documents and assets

Create:

- Document Category and Types
- Valid, expiring, expired, rejected and verified Documents
- Asset Category and Type
- Available, assigned and maintenance Assets
- Active and returned Employee Asset assignments

## 13. Manual UAT Workflow

### Platform administrator

- Log in.
- View all tenants.
- Create/view system configuration.
- Confirm tenant roles cannot receive `platform.admin`.

### Organization Owner

- Invite a User.
- Link the User to an Employee.
- Assign Company Group/Company/Branch roles.
- Create a custom role from tenant-assignable permissions.
- Revoke a Session.
- Confirm another Company Group is invisible.

### HR Manager

- View and manage scoped Employees.
- Create and publish an onboarding Template.
- Start Employee onboarding.
- Complete and reopen Tasks.
- Verify Documents.
- Generate Leave Balances.
- Approve and reject Leave.
- View and correct Attendance.
- Confirm another tenant returns `404`.

### Employee

- Open My Workspace.
- Check in and out.
- View only own Attendance.
- View own Leave Balance.
- Create, edit, submit and cancel own Leave Request.
- View own Onboarding, Documents and Assets.
- Confirm administrative HR URLs return `403`.

### Asset Manager

- View Assets inside scope.
- Assign an Asset to a scoped Employee.
- Return the Asset.
- Confirm cross-Branch assignment fails.

## 14. Automated Validation Commands

### Backend

```powershell
cd C:\DataScape\HRMS\ERP\backend

npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run prisma:validate
npx.cmd prisma migrate status
npm.cmd run build
npm.cmd run lint:check
npm.cmd run test:foundation
corepack pnpm run test
npm.cmd test -- --runInBand
```

Expected:

- Prisma validation passes.
- No pending migration after deployment.
- Build passes.
- Lint returns zero errors.
- Foundation tests pass.
- Workforce tests pass.
- Full suite passes with zero skipped release-critical tests.

### Frontend

```powershell
cd C:\DataScape\HRMS\ERP\frontend

npm.cmd ci
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

Expected:

- Zero lint errors and warnings.
- Zero TypeScript errors.
- Production build passes.

## 15. Responsive and Accessibility Acceptance

Verify at:

- 1440px
- 1024px
- 768px
- 390px

Check:

- No body-level horizontal overflow.
- Sidebar and content scroll independently.
- Mobile drawer traps and restores focus.
- Keyboard focus is visible.
- Tables remain usable on small screens.
- Sheets and dialogs close with Escape.
- Confirmation dialogs restore focus.
- Forms expose labels and validation.
- Status is not communicated by colour alone.
- Loading, empty, error and retry states render correctly.
- Permission-hidden actions are absent, not disabled placeholders.

## 16. Deployment Procedure

1. Freeze merges.
2. Record master commit and clean status.
3. Back up the target database.
4. Record pre-deployment migration status and counts.
5. Deploy migrations with `prisma migrate deploy`.
6. Verify invitation/reset tables and audit columns.
7. Deploy backend.
8. Verify `/health/live` and `/health/ready`.
9. Smoke-test login, refresh, logout and organization switching.
10. Deploy frontend.
11. Revoke sessions affected by permission changes.
12. Test one user from every system role.
13. Test cross-tenant denial.
14. Check structured logs using request IDs.
15. Record post-deployment counts and migration status.
16. Obtain technical and business UAT sign-off.

## 17. Rollback Procedure

### Application failure

- Roll back frontend and backend to the previous release.
- Leave additive database structures intact.
- Previous code continues denying new routes through `platform.admin`.

### Permission issue

- Disable affected role mappings through a new corrective migration.
- Revoke affected sessions.
- Do not manually delete permission rows used by audit history.

### Migration failure

- Stop deployment.
- Preserve Prisma error output.
- Inspect database and `_prisma_migrations`.
- Restore the snapshot if the migration partially changed critical data.
- Use `prisma migrate resolve` only after verifying the actual SQL state.
- Never mark the migration applied merely to clear Prisma status.

### Data-scope incident

- Disable affected route or permission.
- Revoke tenant sessions.
- Preserve request and audit logs.
- Identify affected tenant IDs.
- Correct scope code and add a regression test before re-enabling.

## 18. Definition of Done

The remediation is complete only when all are true:

- [ ] Repository is clean.
- [ ] Existing pending migration validated.
- [ ] New activation/index migration validated.
- [ ] Target migration status reports no pending migrations.
- [ ] Backend build passes.
- [ ] Backend lint passes.
- [ ] Foundation tests pass.
- [ ] Workforce tests pass.
- [ ] Full backend tests pass.
- [ ] Frontend lint passes.
- [ ] Frontend TypeScript passes.
- [ ] Frontend production build passes.
- [ ] Approved routes have explicit permissions.
- [ ] All released workforce operations enforce tenant scope.
- [ ] Leave APIs use one envelope.
- [ ] Mutations and audits are transactional.
- [ ] No fake production actions remain.
- [ ] No released path reaches unimplemented workflow code.
- [ ] Role matrix is verified with real sessions.
- [ ] Cross-tenant tests pass.
- [ ] UAT data covers the required workflows.
- [ ] Responsive and keyboard checks pass.
- [ ] RDS snapshot and migration evidence are recorded.
- [ ] Technical sign-off completed.
- [ ] Business UAT sign-off completed.

## 19. Closure Report Template

At completion, append:

- Release branch and final commit.
- Backend and frontend commit hashes.
- Migration names applied.
- Pre/post database counts.
- Build and test command outputs.
- Test-suite totals.
- Permission-matrix evidence.
- Cross-tenant evidence.
- UAT persona results.
- Browser viewport results.
- Known deferred modules.
- Rollback readiness.
- Technical approver.
- Business approver.
- Final release decision: `GO` or `NO-GO`.

## Assumptions

- `dsp_pms` remains the canonical schema.
- The current Warm Coral + Teal UI remains unchanged.
- Authentication and registration contracts remain backward compatible.
- The security migration has not been manually executed.
- The initial production population is approximately 10–20 users.
- Tenant isolation is mandatory regardless of initial user count.
- Generic workflow, projects and payroll remain future modules.
- External dependency vulnerability scanning requires separate approval because it sends dependency metadata to an external advisory service.
