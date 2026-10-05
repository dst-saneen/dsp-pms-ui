# HRMS Release-Flow, Roles and Permissions Gap Audit

**Audit date:** 2026-08-06  
**Audited branch:** `main`  
**Audited commit:** `51b8064`  
**Release flow:** Organization → Structure → Employee → User/Role → Template/Onboarding → Workforce → Leave → Assets → Dashboard/Self-service  
**Decision:** **Not approved for release**

## 1. Executive verdict

The current build is not release-ready.

The audit found:

- **1 P0**: a committed API-UAT script contains a predictable credential and maintains an active Organization Owner account. The configured development database currently has that account active, assigned as Organization Owner, with one active session.
- **4 P1 findings**:
  - the required isolated UAT environment is not configured and the running backend readiness endpoint returns `503`;
  - employee-shift endpoints do not apply tenant or company scope;
  - `hr.team.approve` is granted to Project Manager but is not accepted by any approval endpoint;
  - security-role catalog changes do not have complete actor-attributed audit coverage.
- Browser UAT, direct API bypass testing, two-tenant isolation, persona testing, invitation acceptance, and session invalidation could not be executed against `dsp_erp_uat.dsp_pms`.
- Static/build evidence is mostly healthy: Prisma validation, backend build, backend lint, frontend TypeScript, 47 backend suites/252 tests, and the focused 49-test RBAC suite pass.
- Frontend lint fails on one shift-roster hook error. The backend all-file TypeScript command fails on four test typing errors, although the production build TypeScript configuration passes.

No application API, schema, UI, or database mutation was performed during this audit. The only repository change is this report.

## 2. Status definitions

| Status | Meaning |
| --- | --- |
| Pass | Verified in the current audit with live or executable evidence |
| Static pass | Code, migration, or automated-test evidence supports the behavior; browser/UAT proof is still required |
| Fail | A current defect or release-gate failure was reproduced or proven from code/live state |
| Blocked | The check could not safely run because an approved UAT prerequisite was unavailable |
| Planned | Present only as a future/platform scaffold and excluded from release approval |

## 3. Environment and audit boundary

### 3.1 Runtime evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Frontend listener | Pass | Port `3200` is listening |
| Backend listener | Pass | Port `4500` is listening |
| `GET /health/live` | Pass | HTTP `200` |
| `GET /health/ready` | **Fail** | HTTP `503`, `checks.database = down` |
| Frontend security route | Blocked | `/administration/security` redirects to `/login?next=...`; no approved UAT session exists |
| Fresh PostgreSQL SSL probe | Pass, wrong environment | Connected to `dsp_erp_dev`, schema `dsp_pms`, with the configured CA |
| Prisma migration status | Pass, wrong environment | `93` migrations; `dsp_erp_dev.dsp_pms` reports up to date |
| Required UAT target | **Blocked** | No runtime connection configuration for `dsp_erp_uat.dsp_pms` was found |

The fresh database probe proves the current RDS endpoint, credential, and CA combination can work from a new process. It does **not** satisfy readiness because the long-running backend continues to report its database check as down. The running process must be reconciled or restarted under the approved UAT configuration, and both health endpoints must return `200`, before UAT begins.

### 3.2 Safety boundary followed

- No mutation was run against `dsp_erp_dev`.
- No Prisma reset, development migration, or schema push command was run.
- `backend/scripts/uat-remaining-runner.mjs` was not executed because it explicitly targets and mutates shared `dsp_erp_dev`.
- No password, token, cookie, OTP, or SMTP credential is included in this report.
- No controlled UAT data was created, so no UAT cleanup was required.

## 4. Prioritized findings

### P0-01 — Predictable active Organization Owner test account

**Subsystem:** Security operations, test tooling, credentials  
**Status:** Fail

`backend/scripts/uat-remaining-runner.mjs:13` contains a fixed runner password. The script resets or creates the runner, clears its role assignments, and assigns `ORGANIZATION_OWNER` at Company Group scope (`backend/scripts/uat-remaining-runner.mjs:118-174`). It then authenticates with that fixed credential.

A read-only aggregate query of the configured `dsp_erp_dev.dsp_pms` database confirmed:

- the runner account is `ACTIVE`;
- it has one active assignment;
- that assignment is Organization Owner;
- it has one active session.

**Risk:** Anyone who can obtain the repository credential and reach the environment can authenticate with tenant-owner privileges.

**Required remediation:**

1. Immediately disable or remove the runner account in every persistent environment.
2. Revoke all of its sessions and increment its security version.
3. Rotate any credential derived from the committed value.
4. Remove fixed passwords from tracked scripts. Require an injected, short-lived secret and an explicit allow-listed database/environment.
5. Add a hard guard that refuses every database except `dsp_erp_uat`.
6. Add secret scanning and a release check that fails when predictable privileged test credentials are tracked.

**Acceptance criteria:**

- No tracked file contains a usable fixed account password.
- No persistent environment contains the predictable runner as an active privileged user.
- All previous runner sessions are revoked.
- The UAT runner refuses `dsp_erp_dev`, production, and any target other than `dsp_erp_uat.dsp_pms`.

### P1-01 — Isolated UAT and backend readiness are unavailable

**Subsystem:** Environment, database, deployment  
**Status:** Blocked/Fail

The required UAT guide names `dsp_erp_uat.dsp_pms`, but the active backend configuration points to `dsp_erp_dev.dsp_pms`. No UAT connection configuration was found. The running backend returns `503` from `/health/ready`, even though a fresh read-only process can currently connect to the development database.

**Impact:** Registration, login, role mutation, invitation acceptance, browser personas, tenant isolation, lifecycle transitions, and cleanup cannot be accepted as UAT evidence.

**Acceptance criteria:**

- A dedicated `dsp_erp_uat` database exists with schema `dsp_pms`.
- The backend and frontend are started with approved UAT configuration.
- `GET /health/live` and `GET /health/ready` both return `200`.
- `prisma migrate status` reports only the UAT target and all committed migrations applied.
- No UAT script can connect to `dsp_erp_dev`.

### P1-02 — Employee-shift endpoints are not tenant-scoped

**Subsystem:** Organization structure, workforce authorization  
**Status:** Fail

`EmployeeShiftService`:

- loads employee and shift by global ID during create without asserting organization scope or same-company ownership (`backend/src/modules/employee-shift/employee-shift.service.ts:15-40`);
- returns every employee-shift record from `findAll` (`:46-55`);
- loads a record globally in `findOne` (`:58-72`).

The route policy exposes `employee-shifts` under tenant-assignable `organization.structure.read/manage`. The global Organization Scope guard only inspects explicit Company Group, company, and branch IDs in request values; it cannot repair an unscoped list or an employee/shift ID relationship.

**Risk:** A tenant user with structure permission can potentially list another tenant's assignments, read a known cross-tenant assignment ID, or create an invalid cross-company employee/shift association.

**Acceptance criteria:**

- Every create/read/list operation applies the actor's Company Group/company/branch scope.
- Employee and shift must belong to the same authorized company.
- Cross-tenant IDs return `404` without revealing record existence.
- Two-tenant controller/service tests cover list, get, create, update, deactivate/end, and direct API bypass.
- Shift-assignment mutations create actor-attributed audit records.

### P1-03 — `hr.team.approve` does not authorize any approval action

**Subsystem:** Workforce RBAC, manager approvals  
**Status:** Fail

The permission catalog says `hr.team.approve` approves team leave, attendance regularization, and overtime. It is granted to Project Manager and other manager roles in `20260805140000_workforce_permissions_and_approval_resolution`.

No approval controller accepts it:

- leave approve/reject requires `hr.leave.manage`;
- attendance regularization approve/reject requires `hr.attendance.regularize`;
- overtime approve/reject requires `hr.overtime.approve`.

`hr.team.approve` is only referenced by reporting-team scope logic and does not reach an approval mutation. Therefore Project Manager receives a permission that cannot perform its named function.

**Acceptance criteria:**

- Team approval endpoints accept `hr.team.approve` only for employees inside the actor's resolved reporting team; or the permission is removed and the intended role matrix is updated.
- Project Manager cannot approve outside the reporting team.
- Self-approval is rejected.
- Leave, attendance, and overtime have positive and negative controller tests for this permission.
- Menu/action visibility matches the chosen authorization contract.

### P1-04 — Role catalog changes lack complete actor-attributed audit evidence

**Subsystem:** RBAC administration, audit  
**Status:** Fail

`RoleAdministrationService` does not use `AuditService`.

- Custom role create, clone, rename, and description changes create no business audit or security event.
- Permission replacement and role activation/deactivation create `ROLE_CHANGED` events only when users are already assigned.
- Those events identify affected users and a request ID, but do not persist an explicit actor field in the security-event model.
- Changing an unassigned role's permissions or status can therefore leave no durable security event.

Session invalidation itself is implemented correctly when assigned users are affected.

**Acceptance criteria:**

- Create, clone, edit, permission replacement, activation, and deactivation always emit an immutable security audit.
- Audit evidence includes actor user, target role, tenant, before/after permission codes, request ID, and timestamp.
- The audit is written in the same transaction as the role change.
- Tests cover assigned and unassigned roles.

### P2 findings

| ID | Gap | Evidence and impact | Acceptance criteria |
| --- | --- | --- | --- |
| P2-01 | Locked system-role UX is unclear | The page labels roles as System and hides edit/status actions, but shows only a permission count. There is no system-role permission detail, locked-state explanation beside the role, or guided clone action. Users can interpret this as broken enable/disable behavior. | System role opens a read-only permission detail; lock reason is explicit; primary action is “Clone to custom role”; a short explanation says only custom roles can be changed. |
| P2-02 | Custom role edit is a two-request partial workflow | The frontend first updates role metadata, then replaces permissions (`frontend/app/(dashboard)/administration/security/page.tsx:57-63`). If the second call fails, the first change remains although the UI reports one failed save. | Provide one atomic backend command or explicit partial-failure recovery; UI identifies which operation failed and refreshes persisted state. |
| P2-03 | Project Manager calendar permission is hidden by the parent menu | Project Manager has `hr.calendar.read` but not `hr.leave.read`. The Calendar child is nested under a Leave parent that itself requires `hr.leave.read`, so sidebar filtering removes the parent before evaluating the child (`frontend/config/navigation.ts:171-197`). Direct URL/API can work while the menu is absent. | A user with `hr.calendar.read` sees a valid Calendar navigation item without requiring unrelated leave permission. |
| P2-04 | Employee-first flow lacks integrated Start Hire/Probation behavior | Employee defaults to `ACTIVE` (`backend/prisma/schema.prisma:587`). Starting onboarding requires explicit employee and template selection (`start-employee-onboarding-form.tsx:26,63,160`). It does not select the designation's current published template automatically or create a Probation employee from one Start Hire flow. | Start Hire creates or selects the Employee first, defaults the approved employment status, resolves the designation-linked current published template, and gives an actionable error when none exists. |
| P2-05 | Onboarding notifications are not emitted | Published-version snapshots, dependencies, assignees, transitions, and audits are implemented, but employee-onboarding create/task services do not write notification/outbox events. The workspace only reads existing `UserNotification` rows. | Assignment, due-soon, dependency-unblocked, completion, and cancellation events create deduplicated notifications for the correct users. |
| P2-06 | Employee-shift lifecycle is incomplete | The controller supports create/list/get only. There is no update, end-date, deactivate, or conflict-safe replacement flow, and no audit attribution. | Effective-dated assignments can be corrected and ended without overlap, with scope validation and audit history. |
| P2-07 | Several release masters lack business-audit writes | Shift, Holiday, Leave Type, Leave Policy, Employee Shift, and Employee Document Type services do not consistently write `AuditService` records. | Every create/update/deactivate and sensitive lifecycle transition records actor, tenant, entity, before/after state, and request ID. |
| P2-08 | Current quality gates are not all green | Frontend lint has one shift-roster hook error. Backend all-file TypeScript has four test typing errors. | Both commands exit `0` on the release commit. |
| P2-09 | Attendance administration requires raw IDs | Attendance period closing asks operators to type Company ID and Branch ID (`attendance-period-workspace.tsx:168-169`); exception filters similarly expose raw IDs. | Use scoped lookups, show names/codes, preserve keyboard accessibility, and prevent invalid cross-company combinations. |
| P2-10 | Current release evidence is stale/incomplete | The 2026-08-05 baseline says all gates pass, but current lint/all-file typing and runtime readiness do not. The WP-10 manual UAT checklist and sign-offs remain blank. | Evidence is regenerated from the release commit and completed by named technical/business testers. |

### P3 findings

| ID | Gap | Disposition |
| --- | --- | --- |
| P3-01 | Zero-permission custom roles are allowed | This is safe by default but needs a warning and an explicit product decision. Inactive roles are correctly rejected for new assignments. |
| P3-02 | Employee documents are metadata-only | Keep the accepted limitation explicit: secure upload, malware scanning, private storage, and authorized download are not complete. |
| P3-03 | Legacy/generic workflow scaffolds contain unimplemented methods | Keep them unregistered and platform-only until the generic engine is accepted. Do not present them as the employee-onboarding runtime. |

## 5. Roles and permissions reconciliation

### 5.1 Live read-only database snapshot

This snapshot is from the currently configured **development** database, not UAT.

| Measure | Current result |
| --- | --- |
| System roles | 7, all active |
| Permission catalog | 52 total |
| Tenant-assignable permissions | 44 |
| Custom roles | 4 total, 2 inactive |
| Zero-permission custom roles | 0 |
| Tenant/custom roles containing `platform.admin` | 0 |
| Active authorization sessions | 15 |
| Active sessions with user/session security-version mismatch | 0 |

Active assignment aggregates:

| Role | Scope | Active assignments |
| --- | --- | ---: |
| Super Administrator | Global | 2 |
| Organization Owner | Company Group | 2 |
| HR Manager | Company | 4 |
| Project Manager | Company | 1 |
| Employee | Company | 3 |

The absence of a current Company Administrator or Asset Manager assignment is not itself a catalog defect, but both personas are still required in isolated UAT.

### 5.2 Intended system-role matrix

System roles are intentionally immutable. Their live permission counts match committed migrations.

| System role | Required scope | Permission count | Intended release access | Key exclusions/notes |
| --- | --- | ---: | --- | --- |
| Super Administrator | Global | 1 | `platform.admin` bypass for platform administration | Must not be granted by tenant administrators |
| Organization Owner | Company Group | 44 | Full tenant organization, security, HR, workforce, leave, assets, and self-service | Cannot cross Company Group |
| Company Administrator | Company or Branch | 42 | Company/branch administration, security, HR, workforce, leave, and assets | No Company Group administration; no platform access |
| HR Manager | Company or Branch | 33 | Organization read, employees, onboarding, documents, attendance, leave, workforce, and asset read | No user/role administration; no asset mutation |
| Project Manager | Company or Branch | 10 | Dashboard, organization/employee read, self-service, team/calendar access | `hr.team.approve` is currently non-functional |
| Asset Manager | Company or Branch | 11 | Dashboard, organization/employee read, asset masters and assignments, self-service | No HR/workforce mutation |
| Employee | Company or Branch | 3 | Dashboard and self-service | No tenant administration |

### 5.3 Custom-role lifecycle

| Control | Static result | UAT result |
| --- | --- | --- |
| Clone a system role into tenant custom role | Static pass | Blocked |
| System role mutation rejected | Pass in code and focused tests | Blocked |
| Only tenant-assignable permissions selectable | Pass in service | Blocked |
| Actor cannot grant a permission they do not hold | Pass in service/tests | Blocked |
| Custom role cannot contain `platform.admin` for tenant actor | Pass; live leak count `0` | Blocked |
| Cross-Company-Group custom role rejected | Pass in service | Blocked |
| Inactive role rejected for assignment | Pass in service | Blocked |
| Last Organization Owner protected | Pass in service/tests | Blocked |
| Permission change increments security version and revokes sessions | Pass in service/tests | Blocked |
| Role status change increments security version and revokes sessions | Pass in service/tests | Blocked |
| Fresh sign-in required to receive changed permission snapshot | Static pass | Blocked |
| Zero-permission custom role | Allowed | Blocked |
| Actor-attributed role-change audit | Fail | Blocked |

## 6. Menu, page, API, and permission alignment

All 20 permission codes used by active navigation entries exist in committed migrations. All 39 permission codes used by route-policy rules also exist in committed migrations.

Security administration endpoints use explicit `@RequirePermissions` decorators. Other active release endpoints use route-policy inference or explicit workforce decorators. Unclassified endpoints default to `platform.admin`.

| UI route/menu | Read permission | Mutation permission(s) | Backend family | Result |
| --- | --- | --- | --- | --- |
| `/dashboard` | `dashboard.read` | `dashboard.read` | `dashboard` | Static pass |
| `/my-workspace` | `hr.self.read` | `hr.self.manage` | `me/*` | Static pass |
| Company Groups | `organization.company-groups.read` | `.manage` | `company-groups`, `organization-onboarding` | Static pass |
| Companies | `organization.companies.read` | `.manage` | `companies` | Static pass |
| Branches | `organization.branches.read` | `.manage` | `branches` | Static pass |
| Departments/Designations/Shifts | `organization.structure.read` | `.manage` | `departments`, `designations`, `shifts` | Static pass |
| Employee shift assignments | `organization.structure.read` | `.manage` | `employee-shifts` | **Fail: service scope missing** |
| Employees | `hr.employees.read` | `.manage` | `employees`, `employee-profile`, `employee-workspace` | Static pass |
| Employee Onboarding/Templates | `hr.onboarding.read` | `.manage` | onboarding families | Static pass |
| Employee Documents | `hr.documents.read` | `.manage` | document categories/types/documents | Static pass; audit coverage gap |
| Work Schedule | `hr.schedule.read` | `.manage`, `.publish` | `shift-rosters` | Static pass |
| Attendance | `hr.attendance.read` | `.manage`, `.regularize`, `.lock` | attendance families | Static pass |
| Overtime | `hr.overtime.read` | `.manage`, `.approve` | overtime families | Static pass |
| Leave Requests/Types/Policies/Balances | `hr.leave.read` | `.manage` | leave families | Static pass |
| Calendar | `hr.calendar.read` | read only | `workforce-calendar` | API aligned; Project Manager menu hidden |
| Holidays | `hr.holidays.read` | `.manage` | `holidays` | Static pass |
| Comp-off | `hr.comp-off.read` | `.manage` | `comp-off-credits` | Static pass |
| Asset Categories/Types/Assets | `assets.assets.read` | `.manage` | asset families | Static pass |
| Employee Assets | `assets.assignments.read` | `.manage` | `employee-assets` | Static pass |
| Users | `security.users.read` | `.manage` and `security.roles.manage` for assignments | `security/users` | Static pass |
| Roles & Permissions | `security.roles.read` | `.manage` | `security/roles`, `security/permissions` | Static authorization pass; UX/audit gaps |

The frontend does not implement a general route-level permission guard for every dashboard page. A user can enter a direct URL, but protected data/actions still depend on backend authorization. UAT must prove a direct URL produces a safe access-denied state and that the API returns `403` or scoped `404`, not data.

## 7. Workflow-by-workflow audit

| Workflow | Code/automated evidence | Current result | Remaining gap |
| --- | --- | --- | --- |
| Registration and OTP | Registration, verification, account lifecycle, rate/security controls exist | Static pass | Browser/email UAT blocked |
| Organization onboarding | Company Group owner and step-based onboarding exist; generated codes are implemented | Static pass | End-to-end registration → onboarding UAT blocked |
| Company/Branch/Department/Designation/Shift | Scoped services and active pages exist | Static pass | Employee-shift scope/lifecycle and master audit gaps |
| Employee-first creation | Employee is independent; User has an optional unique Employee link | Static pass | Integrated Start Hire/Probation flow missing |
| Optional User invitation | User create/invitation/acceptance/account lifecycle implemented | Static pass | Controlled inbox and browser UAT blocked |
| Role/scope assignment | Scope validation, actor-grant restriction, and active-context snapshot implemented | Static pass | Persona and two-tenant UAT blocked |
| Employee deactivation | Sets Employee inactive/terminated, disables linked User, increments security version, revokes sessions | Static pass | Live session invalidation UAT blocked |
| Designation-linked template | Designation can own an onboarding template and current draft version | Static pass | Start form does not automatically resolve designation template |
| Template publication | Employee onboarding requires an active, current, published version | Static pass | Publish and stale-version browser UAT blocked |
| Onboarding snapshot | Tasks, due dates, dependencies, assignees, version ID, and audit snapshot are persisted | Static pass | No notification emission; full UAT blocked |
| Onboarding task lifecycle | Start/complete/skip/reopen, dependency checks, concurrency checks, progress, and actor completion exist | Static pass | Notification and browser/action UX UAT blocked |
| Documents | Metadata, expiry, verification, categories/types, and employee views exist | Static pass | Secure file handling excluded; some master audits missing |
| Shift roster | Draft/generate/override/publish/lock/archive, outbox, audit, and permission split exist | Static pass | Frontend lint failure and manual roster UAT |
| Attendance | Check-in/out, exceptions, regularization, finalization, period review/lock/close, and audits exist | Static pass | Manual time-zone, late/missing-punch, raw-ID UX, and concurrency UAT |
| Holidays | Scoped CRUD and calendar integration exist | Static pass | Mutation audit missing; UAT blocked |
| Overtime | Policy, request state machine, approval, audit, and notification outbox exist | Static pass | Project Manager team-approval mapping fails |
| Comp-off | Credit lifecycle, reservation, consumption, release, and audit controls exist | Static pass | Full leave integration UAT blocked |
| Leave | Policy resolution, balances/ledger, request lifecycle, approvals, cancellation, audit, and error codes exist | Static pass | Project Manager team-approval mapping fails; manual accounting/concurrency UAT |
| Assets | Scoped masters, assignment/return, custody validation, and audits exist | Static pass | Asset Manager persona UAT blocked |
| Manager Dashboard | Scoped dashboard service and tests exist | Static pass | Project Manager persona and team isolation UAT blocked |
| Employee Self-service | Linked-employee context, attendance, leave, overtime, comp-off, documents, assets, roster, calendar, and onboarding views exist | Static pass | Employee persona, responsive, and accessibility UAT blocked |

## 8. Planned/platform-only boundary

The following must remain excluded from release claims:

| Area | Current evidence | Release disposition |
| --- | --- | --- |
| Payroll | Backend models/modules exist; no active frontend page; attendance has a Payroll Pending handoff only | Planned, not production-ready |
| Projects and resources | Backend modules exist; navigation is marked planned and no active pages exist | Planned |
| HR requests and approval administration | Backend/platform modules exist; no accepted end-to-end release UI | Platform-only |
| Generated documents | Backend service exists but depends on incomplete HR request/approval flow | Platform-only |
| Generic workflow engine | Runtime engine, readers, and Prisma repositories contain explicit unimplemented methods and are not registered as the employee-onboarding runtime | Planned scaffold |
| Settings | Navigation marked planned; no active page | Planned |

## 9. Current quality-gate results

| Command/check | Result |
| --- | --- |
| `pnpm exec prisma validate` | Pass |
| `pnpm exec prisma migrate status` | Pass for `dsp_erp_dev.dsp_pms`, 93 migrations; **not UAT evidence** |
| `pnpm exec nest build` | Pass |
| `pnpm exec tsc --noEmit -p tsconfig.build.json` | Pass |
| Backend ESLint check | Pass |
| `pnpm exec jest --config ./test/jest-all.json --runInBand` | Pass: 47 suites, 252 tests |
| Focused permission/route/role/user suite | Pass: 4 suites, 49 tests |
| Frontend `pnpm exec tsc --noEmit` | Pass |
| Frontend `pnpm exec eslint .` | **Fail:** `features/shift-roster/dialogs/generate-roster-sheet.tsx:78`, `react-hooks/set-state-in-effect` |
| Backend all-file `pnpm exec tsc --noEmit` | **Fail:** four test typing errors |
| `GET /health/live` | Pass: 200 |
| `GET /health/ready` | **Fail:** 503 |
| Browser persona UAT | Blocked |
| Two-tenant/direct API mutation UAT | Blocked |

Backend all-file TypeScript failures:

1. `test/foundation/permission.guard.spec.ts:41` — mock lacks `username` and `mustChangePassword`.
2. `test/foundation/permission.guard.spec.ts:73` — same mismatch.
3. `test/foundation/user-administration.service.spec.ts:113` — expected three arguments, received two.
4. `test/utils/testing.ts:13` — unsafe generic Jest mock cast.

## 10. Required browser/API UAT

These checks remain **Blocked**, not passed:

- Organization Owner, HR Manager, Project Manager, Asset Manager, Employee, and custom read-only personas.
- Company Administrator should also be added because it is one of the intended seven system roles.
- Registration, OTP, organization onboarding, invitation acceptance, password recovery, and fresh authentication.
- Clone system role → edit custom permissions → assign scoped role → revoke sessions → sign in again → menu/action update.
- Permission add/remove, zero-permission role, inactive role, last-owner protection, and actor-grant restrictions.
- Direct URL and direct API bypass attempts.
- Two Company Groups with cross-tenant IDs returning safe `404`.
- Cross-company assignment combination and active-context switching.
- Employee deactivation while signed in.
- Published-template enforcement, snapshot dependencies, assignees, notifications, and completion.
- Roster, attendance, regularization, closing, holidays, overtime, comp-off, leave balances/requests, and asset return.
- Responsive checks at 1440, 1024, 768, and 390 pixels.
- Keyboard, focus, loading, empty, error, and actionable validation states.
- Audit and security-event references for every sensitive transition.

## 11. Remediation order

### Step 0 — Immediate containment

1. Disable/remove the predictable UAT runner in persistent databases.
2. Revoke its sessions and rotate the exposed credential.
3. Remove fixed privileged credentials from source.
4. Guard all UAT scripts to `dsp_erp_uat.dsp_pms` only.

### Step 1 — Restore a valid release environment

1. Provision/configure `dsp_erp_uat.dsp_pms`.
2. Validate CA, credential, network, and active process configuration.
3. Apply only unapplied committed migrations with `prisma migrate deploy`.
4. Require live and ready health checks to return `200`.
5. Record the release commit and initial UAT counts.

### Step 2 — Close P1 authorization and audit gaps

1. Scope Employee Shift list/get/create and implement same-company validation.
2. Decide and implement the `hr.team.approve` contract.
3. Add complete actor-attributed role catalog audits.
4. Add controller/service two-tenant tests for the corrected paths.

### Step 3 — Close P2 release-flow and UX gaps

1. Clarify system-role locked state, show permission detail, and guide clone.
2. Make custom-role save atomic or explicitly recoverable.
3. Fix Project Manager calendar navigation.
4. Complete Start Hire/designation-template/Probation flow.
5. Emit onboarding notifications.
6. Complete employee-shift lifecycle and audit.
7. Replace raw-ID attendance controls with scoped lookups.
8. Fix frontend lint and test TypeScript errors.

### Step 4 — Execute isolated UAT

1. Prepare controlled personas without committing credentials.
2. Run all role/menu/API, tenant-isolation, lifecycle, accounting, UX, accessibility, and operational cases.
3. Record request IDs and sanitized evidence.
4. Clean up only the UAT records created by the run.
5. Re-run static gates and final regression.

### Step 5 — Release decision

Release approval requires:

- P0 count `0`;
- P1 count `0`;
- both health endpoints `200`;
- all quality gates green;
- completed two-tenant/persona UAT;
- technical and business sign-off;
- planned modules explicitly excluded from release communication.

## 12. Acceptance decision

Current acceptance criteria are **not met**.

- System-role immutability and custom-role customization are implemented as intended.
- Static menu/API catalog reconciliation is substantially aligned.
- No tenant/custom role currently contains `platform.admin`.
- Session security-version reconciliation shows no current mismatch.
- However, the P0 privileged test-account exposure, missing Employee Shift scope, broken team-approval permission contract, incomplete RBAC audit attribution, backend readiness failure, absent UAT target, and unexecuted browser/two-tenant UAT prevent release approval.

