# Security Route Matrix

Authentication is global and deny-by-default.

## Public routes

| Route | Reason |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health/ready` | Database and Redis readiness |
| `POST /auth/login` | Establish a session |
| `POST /auth/refresh` | Rotate a valid refresh session |
| `GET /auth/capabilities` | Discover enabled public onboarding flows |
| `POST /auth/register-organization` | Start customer Company Group registration |
| `POST /auth/registration/verify` | Verify customer email and provision the tenant |
| `POST /auth/registration/resend` | Replace an unconsumed OTP after cooldown |
| `POST /auth/invitations/inspect` | Validate a time-limited invitation link |
| `POST /auth/invitations/accept` | Set the initial password and activate an invited account |
| `POST /auth/password/forgot` | Request an enumeration-safe password reset |
| `POST /auth/password/reset` | Consume a reset token and set a new password |

All other registered routes require a valid access JWT and active durable
session. A legacy user with `mustChangePassword=true` can access only
authenticated `/auth/*` self-service routes until the password is changed.

## Permission routing

`GET`, `HEAD`, and `OPTIONS` use the read permission. Mutating methods use the
manage permission.

| Controller route family | Read permission | Manage permission |
| --- | --- | --- |
| `/company-groups` | `organization.company-groups.read` | `organization.company-groups.manage` |
| `/organization-onboarding` | `organization.company-groups.read` | `organization.company-groups.manage` |
| `/companies` | `organization.companies.read` | `organization.companies.manage` |
| `/branches` | `organization.branches.read` | `organization.branches.manage` |
| `/departments`, `/designations`, `/shifts`, `/employee-shifts` | `organization.structure.read` | `organization.structure.manage` |
| `/employees`, `/employee-workspace`, `/employee-profile` | `hr.employees.read` | `hr.employees.manage` |
| `/dashboard` | `dashboard.read` | `dashboard.read` |
| `/attendance` | `hr.attendance.read` | `hr.attendance.manage` |
| `/leave-types`, `/leave-policies`, `/leave-requests`, `/employee-leave-balances`, `/holidays`, `/employee-leave` | `hr.leave.read` | `hr.leave.manage` |
| `/me` | `hr.self.read` | `hr.self.manage` |
| `/employee-onboarding*`, `/onboarding-*` (accepted families) | `hr.onboarding.read` | `hr.onboarding.manage` |
| `/employee-documents`, `/employee-document-types`, `/employee-document-categories` | `hr.documents.read` | `hr.documents.manage` |
| `/employee-assets` | `assets.assignments.read` | `assets.assignments.manage` |
| `/asset`, `/asset-types`, `/asset-categories` | `assets.assets.read` | `assets.assets.manage` |
| `/security/users` | `security.users.read` | `security.users.manage` |
| `/security/roles`, `/security/permissions`, role assignments | `security.roles.read` | `security.roles.manage` |

Any route not matched above requires `platform.admin`. This fallback is
intentional: a newly added domain cannot become available to ordinary roles
until its permission mapping is reviewed.

Explicit `@RequirePermissions` also applies on sensitive mutations such as leave
approve/reject, attendance correct, leave-balance generate, document
verify/reject/reset, asset return, and manager dashboard / self-service routes.

Workflow, payroll, projects/tasks, approval-engine administration and unfinished
scaffolds remain Super-Administrator-only until their scope adapters and
acceptance tests are complete. Tenant role grants for the workforce permissions
above are activated by the security / activation migrations (Phase 4/E).

## Starter roles

1. Super Administrator
2. Organization Owner
3. Company Administrator
4. HR Manager
5. Project Manager
6. Asset Manager
7. Employee

Organization Owner is assigned at `COMPANY_GROUP` scope and can administer
only users and supported business records belonging exclusively to that
Company Group. Tenant administrators cannot view or grant roles containing
`platform.admin`.

System roles are immutable. Organization Owners can create Company
Group-owned custom roles from permissions marked tenant assignable. Changing a
custom role's permissions or status increments affected users' security
versions and revokes their durable sessions.

## Account lifecycle

- Administrators invite users; the API never generates or returns a password.
- Invitation and reset tokens are random, HMAC-hashed at rest and single-use.
- Invitations expire after 24 hours by default; resets expire after 30 minutes.
- Resending an invitation revokes its earlier token and enforces a cooldown.
- Invited users cannot sign in until they accept the invitation and set a
  password.
- Successful invitation acceptance creates the durable session and continues
  directly to the authenticated application.
- Password-reset requests return the same public response whether or not an
  eligible account exists.
- Password reset, account status, role assignment and custom-role permission
  changes revoke affected sessions.
- The final active Organization Owner in a Company Group cannot be disabled or
  stripped of ownership until another active owner exists.

Project Manager is the starter project-delivery role. It receives
organization and employee read access in this rollout. Its project/task
permission activation is deferred until the project-derived scope adapter is
complete; it does not receive HR, payroll, asset, user, or role administration.

## Organization scope

- `GLOBAL` assignments may work across all organizations.
- `COMPANY_GROUP` assignments may work across the companies and branches in
  exactly one Company Group.
- `COMPANY` assignments may work only inside the assigned company and its
  branches.
- `BRANCH` assignments may work only inside the exact assigned branch.
- The active Company Group/company/branch context is stored in the server-side
  session.
- Role permissions from different companies or branches are never unioned.
- Explicit out-of-scope `companyId` or `branchId` input is returned as not
  found.
- Tenant user administration excludes accounts with active assignments outside
  the tenant, and replacement operations delete only assignments within the
  active tenant boundary.
- Company, Branch, Department, Designation, Shift, Employee, Asset Category,
  Asset Type and Asset services apply server-side scope predicates to lists and
  record lookup.
- Leave, attendance, self-service, onboarding, documents and asset-assignment
  services also apply employee-domain scope predicates; out-of-scope IDs return
  `404`.
- Unclassified legacy domains remain Super-Administrator-only until their
  service queries receive a reviewed scope adapter.

## Module availability

| Area | Status |
| --- | --- |
| Organization / employees / assets / security | Available |
| Leave / attendance / self-service / dashboard | Available with role permissions |
| Onboarding / employee documents / assignments | Available with role permissions |
| Generic workflow runtime | Internal scaffold (not registered) |
| Payroll / projects / HR requests / document generator | Planned / platform-only |

PostgreSQL row-level security is not enabled in this sprint. Application-layer
scope enforcement is the active control.

## Session controls

- RS256 access JWT: 10 minutes
- Opaque rotating refresh cookie: `HttpOnly`, `SameSite=Strict`, `Secure` in
  production, scoped to `/api/auth`
- Idle timeout: 30 minutes
- Absolute timeout: 12 hours
- Session activity persistence: at most once every 5 minutes
- Concurrent sessions: unlimited in v1, with list/revoke and sign-out-all
- Redis cache: 60 seconds
- Redis failure: PostgreSQL fallback, limited to five concurrent fallbacks per
  application instance
- Refresh-token mismatch/reuse: revoke the session

Redis is a cache, not the durable authorization source. PostgreSQL session and
role records remain authoritative.
