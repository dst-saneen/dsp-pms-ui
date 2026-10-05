# Developer 1 — Security, Tenancy, and User Lifecycle

## Document purpose

This is the complete engineering handoff for Developer 1 in the **ERP Foundation Completion** programme.

Developer 1 joins after Developers 2 and 3 have started. The employee, onboarding, document, asset, leave, and attendance work may already contain new Prisma migrations and protected routes. Developer 1 must rebase onto that work, preserve the existing authentication implementation, and complete tenant security before normal tenant UAT or production release.

## Delivery outcome

An Organization Owner must be able to:

1. Invite a user without generating or displaying a temporary password.
2. Link the user to an employee when applicable.
3. Assign one or more roles at Company Group, Company, or Branch scope.
4. Create or clone a tenant-owned custom role.
5. Select only approved tenant permissions.
6. Resend an expired invitation.
7. Disable users or revoke sessions.
8. Recover a forgotten password securely.

Tenant administrators must never be able to grant global platform access or access another Company Group.

## Existing implementation to retain

The following are already implemented and must not be rebuilt:

- NestJS authentication module.
- RS256 access tokens.
- Rotating opaque refresh sessions.
- PostgreSQL-backed `AuthSession` records.
- Redis session caching with database fallback.
- Login throttling and account lockout.
- Change-password flow.
- Session listing and revocation backend endpoints.
- Company Group, Company, and Branch authorization context.
- Organization-context switching.
- `PermissionGuard` and deny-by-default route policy.
- `OrganizationScopeService`.
- SaaS Company Group registration.
- ZeptoMail OTP verification and development bypass.
- Organization Owner provisioning.
- Request IDs, structured logs, database pooling, health endpoints, and graceful shutdown.

Any refactoring must be justified by a failing test or a concrete security gap. Authentication response and cookie behavior must remain backwards compatible.

## Start condition and dependencies

Developer 1 starts from the latest merged branch containing:

- Developer 2's onboarding/asset migration, if merged.
- Developer 3's leave/attendance migration, if merged.
- All current authentication and SaaS registration migrations.

Before coding:

1. Pull and rebase onto the latest integration branch.
2. Run Prisma migration status.
3. Run the existing authentication/foundation tests.
4. Read the new Developer 2 and Developer 3 route inventory.
5. Confirm which routes are still falling back to `platform.admin`.
6. Record the current system-role and permission mappings.

Developer 1 must not edit or squash migrations that have already been applied to a shared database.

## Shared engineering rules

- Database schema: `dsp_pms`.
- Successful APIs remain `{ "success": true, "data": ... }`.
- Controllers validate DTOs and declare explicit permissions.
- Services enforce scope and business invariants.
- Out-of-scope records return `404`.
- Missing permissions return `403`.
- Invalid lifecycle transitions return `409` with stable error codes.
- Raw tokens, passwords, OTPs, SMTP secrets, HR data, and document references must never be logged.
- Business audits contain safe summaries, actor, request ID, and organization context.
- System roles are immutable.
- Tenant roles cannot use `GLOBAL` scope.
- No hard deletion of a role that has historical assignments.

---

## Work package D1-01 — Authentication regression baseline

### Required checks

Verify before changing security code:

- Login with username.
- Login with normalized email.
- Invalid-password handling.
- Account lockout.
- Access-token validation.
- Refresh-token rotation.
- Refresh-token replay rejection.
- Session idle and absolute expiry.
- Logout.
- Logout all.
- Individual session revocation.
- Organization context switching.
- Organization registration.
- OTP expiry, resend, and development bypass.
- Production rejection of email development bypass.

### Deliverable

Add or update tests only where the existing behavior is not already covered. Do not alter working authentication behavior merely to reorganize code.

### Completion check

The baseline must be green before the first security schema migration is merged.

---

## Work package D1-02 — Permission and route contract

### Explicit permissions

Retain existing permission codes and add:

- `hr.attendance.read`
- `hr.attendance.manage`
- `hr.self.read`
- `hr.self.manage`
- `assets.assignments.read`
- `assets.assignments.manage`

Correct the existing `hr.leave.read/manage` descriptions so they describe Leave only.

### Tenant-assignable permission policy

Add `Permission.isTenantAssignable`.

Rules:

- `platform.admin` is never tenant assignable.
- Permissions for incomplete domains are not tenant assignable.
- Developer 2 routes become assignable only after their acceptance tests pass.
- Developer 3 routes become assignable only after their acceptance tests pass.
- Permission grouping in the UI is derived from the permission-code namespace.

### Route policy

Add explicit route mappings for:

- Onboarding templates and versions.
- Employee onboarding and tasks.
- Employee document categories, types, and records.
- Employee assets.
- Leave types, policies, balances, and requests.
- Attendance.
- Manager dashboard.
- `/me` self-service routes.

Every controller action must also use `@RequirePermissions` where read/manage behavior is not unambiguous.

### Stable behavior

- Super Administrator may access every route.
- Unknown protected routes continue to require `platform.admin`.
- `/me` routes require self-service permission and an employee link.
- Organization scope does not come from a URL alone; domain services still enforce record ownership.

---

## Work package D1-03 — Security database migration

### Migration name

Create the migration:

`security_tenant_roles_and_account_recovery`

The final timestamp is assigned after rebasing onto all previously merged migrations.

### `UserStatus`

Add:

- `INVITED`

### `User`

Change:

- Allow `passwordHash` to be null while a user is invited.

Add a database constraint enforcing:

- `INVITED` may have a null password.
- `ACTIVE`, `LOCKED`, and `DISABLED` must have a password hash unless an explicitly supported legacy record is documented and corrected before the constraint is enabled.

Existing users and password hashes must not be modified.

### `Role`

Add:

- `companyGroupId UUID NULL`
- `normalizedName TEXT`

Relations and indexes:

- Foreign key to Company Group.
- Partial unique index on `(companyGroupId, normalizedName)` where Company Group is not null.
- Index on `(companyGroupId, isActive)`.

Invariants:

- System role: `isSystem = true`, `companyGroupId = null`.
- Tenant custom role: `isSystem = false`, `companyGroupId` required.
- System-role codes remain unchanged.
- Custom-role codes are generated server-side through Number Series.

### `Permission`

Add:

- `isTenantAssignable BOOLEAN NOT NULL DEFAULT false`

Backfill approved existing tenant permissions to `true`. Keep platform and incomplete-domain permissions `false`.

### `UserInvitation`

Create a table with:

- `id`
- `userId`
- `tokenHash`
- `expiresAt`
- `sentAt`
- `resendAvailableAt`
- `consumedAt`
- `revokedAt`
- `ipHash`
- `userAgentHash`
- `createdAt`
- `updatedAt`

Constraints:

- User foreign key with appropriate cleanup behavior.
- Unique token hash.
- One current invitation per invited user.
- Expiry index.
- User/consumed/revoked index.

### `PasswordResetChallenge`

Create a table with:

- `id`
- `userId`
- `tokenHash`
- `expiresAt`
- `createdAt`
- `consumedAt`
- `revokedAt`
- `ipHash`
- `userAgentHash`
- `updatedAt`

Constraints:

- User foreign key.
- Unique token hash.
- One current reset challenge per user.
- Expiry index.

### `AuditLog`

Extend the existing business audit table with:

- `requestId`
- `companyGroupId`
- `companyId`
- `branchId`

Add indexes:

- `requestId`
- `(companyGroupId, createdAt)`
- `(companyId, createdAt)`

Populate these values through the existing request context. Do not duplicate application logs in the audit table.

### Migration preflight

Before applying constraints:

1. Count users by status.
2. Confirm every non-invited user has a password.
3. List existing non-system roles.
4. Backfill normalized role names.
5. Detect duplicate normalized names within a Company Group.
6. Verify all permission codes are unique.
7. Record counts for users, roles, permissions, assignments, and sessions.

### Migration acceptance

- Prisma validation succeeds.
- Migration applies to an empty database.
- Migration applies to a development-data copy.
- Existing login still works.
- Existing sessions are not accidentally revoked.
- Before/after business-table counts match.

---

## Work package D1-04 — Secure invitation workflow

### Token policy

- Generate 32 cryptographically secure random bytes.
- Encode as URL-safe text.
- Store only an HMAC-SHA-256 hash.
- Invitation lifetime: 24 hours.
- Resend cooldown: 60 seconds.
- Resending invalidates the previous token.
- Production requires successful email delivery.
- Development bypass may return `developmentActionUrl` only outside production.

Use a dedicated validated action-token secret. Never put the raw token in logs, database columns, analytics, or error payloads.

### Invite-user transaction

Input:

- Display name.
- Business email.
- Optional employee ID.
- One or more scoped role assignments.

Server flow:

1. Normalize email.
2. Confirm email is not already active/invited.
3. Validate the employee, if supplied, belongs to the actor's tenant scope.
4. Validate every role and scope.
5. Prevent tenant assignment of global/platform roles.
6. Create `User` as `INVITED` with no password.
7. Create role assignments.
8. Create invitation challenge.
9. Commit database transaction.
10. Send ZeptoMail invitation.
11. If email delivery fails, keep the resumable invited user and allow resend.
12. Record a security event without recording the token.

### Existing user-creation compatibility

The current `POST /security/users` implementation generates and returns a temporary password. Replace that behavior:

- Remove `temporaryPassword` from the public create-user DTO.
- Remove `temporaryPassword` and `passwordShownOnce` from the response.
- Treat `POST /security/users` as an invitation operation.
- Return the created User, invitation status, expiry, and delivery status.
- In non-production bypass mode only, the response may include `developmentActionUrl`.
- Update the current frontend password-copy dialog so it displays invitation delivery/resend status instead.

The current `POST /security/users/:userId/reset-password` endpoint must no longer generate or return a password. Keep the route temporarily for compatibility, but change it to create/send a password-reset challenge and return delivery status. Mark it deprecated in favour of the public forgot/reset workflow.

### Invitation inspection

Input:

- Raw token.

Output:

- Valid/expired/consumed status.
- Masked email.
- Expiry.
- Password-policy hints.

Never return user ID, tenant ID, role, or scope information.

### Invitation acceptance transaction

1. HMAC the submitted token.
2. Lock/find the active invitation.
3. Reject expired, consumed, or revoked tokens.
4. Validate password policy.
5. Hash password with the existing password service.
6. Set user to `ACTIVE`.
7. Set `emailVerifiedAt`.
8. Set `passwordChangedAt`.
9. Clear `mustChangePassword`.
10. Consume invitation.
11. Commit.
12. Create an authenticated session.
13. Record security event.

Concurrent acceptance must result in exactly one successful transaction.

### APIs

- `POST /auth/invitations/inspect`
- `POST /auth/invitations/accept`
- `POST /security/users/:userId/invitations/resend`
- Updated `POST /security/users`
- Updated/deprecated `POST /security/users/:userId/reset-password`

### Stable error codes

- `INVITATION_INVALID`
- `INVITATION_EXPIRED`
- `INVITATION_CONSUMED`
- `INVITATION_RESEND_COOLDOWN`
- `EMAIL_DELIVERY_UNAVAILABLE`

---

## Work package D1-05 — Password recovery

### Token policy

- Secure opaque token.
- HMAC hash only.
- Lifetime: 30 minutes.
- One current reset challenge per user.
- Starting a new reset invalidates the previous challenge.
- Redis rate limits by normalized email and IP hash.

### Forgot-password behavior

- Always return a generic accepted response.
- Do not disclose whether the account exists.
- Do not send reset email for disabled/invited accounts unless explicitly supported by invitation resend.
- Record safe security events.

### Reset transaction

1. Validate token hash.
2. Lock challenge and user.
3. Reject expired/consumed/revoked token.
4. Validate new password.
5. Set new password hash.
6. Increment `securityVersion`.
7. Update password timestamp.
8. Consume reset challenge.
9. Revoke all existing sessions.
10. Clear Redis session entries.
11. Commit and record security event.

### APIs

- `POST /auth/password/forgot`
- `POST /auth/password/reset`

### Error codes

- `RESET_TOKEN_INVALID`
- `RESET_TOKEN_EXPIRED`
- `RESET_TOKEN_CONSUMED`
- `PASSWORD_POLICY_FAILED`

---

## Work package D1-06 — Custom roles and permission matrix

### Role lifecycle

Support:

- Create custom role.
- Clone system/custom role.
- Update custom-role name and description.
- Replace custom-role permissions.
- Activate/deactivate custom role.

Do not support hard deletion.

### Scope rules

- Tenant custom roles can be assigned at Company Group, Company, or Branch scope.
- Tenant custom roles cannot be assigned globally.
- Organization Owner may assign Company Group scope within their group.
- Company Administrator may assign only within permitted Company/Branch scope.
- An actor cannot grant a permission they are not authorized to administer.
- `platform.admin` is blocked in validation and database-facing service logic.

### Last-owner protection

Before disabling an Organization Owner, removing the owner role, or disabling the user:

1. Count active Organization Owners in that Company Group.
2. Lock relevant assignments/users.
3. Reject the change if it removes the final active owner.

Error:

- `LAST_ORGANIZATION_OWNER`

### Session invalidation

When role permissions, assignments, role status, or user status changes:

1. Find affected active users.
2. Increment their `securityVersion`.
3. Revoke active sessions.
4. Clear Redis cached sessions.
5. Write safe security events.

### APIs

- `POST /security/roles`
- `POST /security/roles/:roleId/clone`
- `PATCH /security/roles/:roleId`
- `PUT /security/roles/:roleId/permissions`
- `PATCH /security/roles/:roleId/status`
- Existing `PUT /security/users/:userId/role-assignments` remains and gains full frontend support.

### Default system-role mapping

Organization Owner:

- All tenant-assignable permissions across the Company Group.

Company Administrator:

- User and role administration.
- Company/Branch/structure administration.
- Employee, onboarding, document, leave, attendance, and asset administration within scope.

HR Manager:

- Employee, onboarding, document, leave, and attendance management.
- Organization read.
- Asset-assignment read.

Asset Manager:

- Asset and employee-asset management.
- Employee and organization read.

Project Manager:

- Dashboard, employee read, and organization read until the Project domain is implemented.

Employee:

- Dashboard and self-service permissions only.

Super Administrator:

- Global `platform.admin`.

---

## Work package D1-07 — Security administration UI

### Users

Complete:

- User list with status and invitation state.
- Invite-user right-side drawer.
- Employee-link selector.
- Multiple role assignments.
- Scope selector.
- Resend invitation.
- Enable/disable/lock actions.
- Session list and revoke actions.

Do not show generated passwords.

### Roles and permissions

Complete:

- System-role read-only view.
- Custom-role create drawer.
- Clone-role action.
- Grouped permission matrix.
- Active/inactive state.
- Assigned-user count.
- Protection messages for immutable system roles and the final owner.

### Public pages

Add:

- Invitation acceptance page.
- Forgot-password page.
- Reset-password page.

Requirements:

- Mask email.
- Clear expiry/error messages.
- Keyboard-accessible forms.
- Password rules visible before submission.
- No tenant, role, or internal identifier exposure.

---

## Work package D1-08 — Testing and security acceptance

### Unit/service tests

- Permission assignability.
- Role normalization.
- Scope validation.
- Last-owner protection.
- Session invalidation.
- Token hashing.
- Invitation expiry and resend.
- Concurrent invitation acceptance.
- Password-reset replay.
- Generic forgot-password response.

### Integration tests

- Organization Owner manages users only in own group.
- Company Administrator cannot assign Company Group scope outside authority.
- Tenant cannot grant `platform.admin`.
- Disabled role removes access.
- Assignment replacement refreshes authorization.
- Expired sessions remain invalid after role changes.
- Developer 2 and Developer 3 routes work with correct tenant roles.

### Browser tests

- Invite and accept user.
- Resend expired invitation.
- Forgot/reset password.
- Create and clone role.
- Assign role at each tenant scope.
- Revoke session.
- Confirm responsive and keyboard behavior.

### Required commands

Backend:

```powershell
pnpm.cmd run prisma:validate
pnpm.cmd run prisma:generate
pnpm.cmd run lint:check
pnpm.cmd run test:foundation
pnpm.cmd run build
```

Frontend:

```powershell
pnpm.cmd run lint
pnpm.cmd run build
```

Changed and activated security files must have zero lint errors or warnings.

---

## Database deployment procedure

1. Rebase onto the latest migration history.
2. Create the migration against a disposable local PostgreSQL database.
3. Review SQL manually.
4. Confirm all objects target `dsp_pms`.
5. Apply to a development-data copy.
6. Run authentication and security tests.
7. Record before/after counts.
8. Merge the migration separately from major UI changes.
9. Back up AWS RDS.
10. Apply using `prisma migrate deploy`.
11. Confirm `prisma migrate status`.
12. Smoke-test login, refresh, registration, invitations, roles, and protected routes.

Never use `prisma db push` on AWS RDS. Never mark a migration applied unless its SQL actually executed.

---

## Handoff requirements

Developer 1 provides:

- Final permission-code catalog.
- Updated route-security matrix.
- Default system-role mapping.
- Tenant-role and invitation API contracts.
- Session-invalidation behavior.
- Security UAT evidence.
- List of any routes intentionally left `platform.admin` only.

Developer 1 reviews:

- Developer 2 tenant filters and permission decorators.
- Developer 3 self-service and manager permission decorators.
- Cross-tenant negative tests.

---

## Definition of done

- Existing authentication behavior remains green.
- Users are invited without exposing passwords.
- Invitations and reset tokens are single-use.
- Custom tenant roles are editable; system roles are immutable.
- Tenant administrators cannot grant global access.
- Role/assignment changes invalidate sessions.
- Final Organization Owner is protected.
- Developer 2 and Developer 3 modules work for authorized tenant roles.
- Cross-tenant user, role, and permission access is impossible.
- Production secrets and sensitive content do not appear in logs or UI.
- Migration and deployment runbooks are verified.

## Explicitly deferred

- Billing and subscriptions.
- SCIM/SAML/enterprise SSO.
- Social login.
- Multi-factor authentication.
- Generic notification framework.
- Project, CRM, payroll, finance, procurement, and BIM permissions.
