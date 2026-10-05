# Onboarding Template P0/P1 Remediation and Database Completion Report

## Document status

- Updated: 2026-08-19
- Implementation baseline: Git HEAD `2a372c3` plus this working-tree remediation
- Scope: Template hierarchy, designation assignment, publish contract, authoring UI, Asset task integration, and database enforcement
- Database inspected read-only: PostgreSQL `dsp_erp_dev`, schema `dsp_pms`
- New migration: `20260819130000_onboarding_template_p0_p1_hardening`
- Migration state: **pending; not applied**
- Code decision: **reviewed Template P0/P1 application findings fixed**
- Production decision: **do not enable until the pending migration and acceptance gates pass**

## 1. Closure summary

| Finding | Result | Resolution |
|---|---|---|
| Designation add-Department missing required snapshots | Fixed | Scoped Company/Branch/Draft resolution and required snapshot fields |
| First Department slice bypassing actor Branch | Fixed | Department is resolved through organization scope before persistence |
| Assignment update accepting foreign Template/Branch | Fixed | Create/update/reactivate validate Company, Designation, Template, and Branch |
| Child check-then-write race | Fixed | Parent Version lock, expected-version CAS, and versioned deletes |
| Publish validation outside transaction | Fixed | Version and hierarchy are locked and validated on the transaction client |
| Effective-range assignment race | Fixed | Receipt-backed commands plus advisory-lock database trigger |
| Missing tenant-qualified FKs | Fixed in pending migration | Composite Template/Designation/Branch relations use Restrict |
| Published hierarchy mutable through direct SQL | Fixed in pending migration | INSERT/UPDATE/DELETE trigger locks parent Version and requires DRAFT |
| Weak owner/reference database shape | Fixed in pending migration | Owner, Department, work type, Asset Type, and publish guards |
| Asset tasks disabled | Fixed | INDIVIDUAL/POOL candidates and transaction-aware fulfillment implemented |
| Direct task commands trusted route access | Fixed | Mutations re-check server `allowedActions` inside the transaction |

## 2. Template/API implementation

### 2.1 Tenant containment

Every hierarchy operation resolves through the owning Template Version and Template Company:

- Template Version;
- Department slice;
- Task Group;
- Template Task;
- validation and publish;
- designation assignment;
- direct-ID reads and mutations.

Foreign Company/Branch/Department combinations return the same safe not-found behavior as missing records.

### 2.2 Designation add-Department

The legacy live route now:

- resolves the Designation and Department in the actor's organization scope;
- uses a Company-qualified Template;
- creates or reuses only a DRAFT Version;
- persists required Company, Branch, and row-version snapshots;
- rejects adding children to a published Version;
- enforces one concrete Branch for Department-owned Template content.

### 2.3 Versioned hierarchy mutations

Department slice, Task Group, and Template Task update/delete operations now:

1. lock the parent Template Version;
2. require it to remain DRAFT;
3. compare the supplied row/version token;
4. mutate with compare-and-swap semantics;
5. return the stable state-changed error when the token is stale.

Delete endpoints and frontend services now send `expectedVersion`.

### 2.4 Publish

Publish requires `expectedVersion` and executes in one transaction:

1. scope and lock the Version;
2. lock Department slices, groups, tasks, and dependencies;
3. validate using the same transaction client;
4. reject unsupported owners/work types, invalid dependencies, named assignments, branch drift, and invalid Asset Types;
5. publish only the hierarchy that was validated.

### 2.5 Designation assignments

Create, update, reactivate, and deactivate now:

- validate the Designation Company;
- validate the target Template Company;
- validate optional Branch containment;
- keep Company/Designation immutable on update;
- use optimistic version checks;
- use command receipts for replay/conflict detection;
- serialize the natural assignment key before overlap validation.

Onboarding receipt replay also verifies actor, command type, Company, and payload hash.

## 3. Template validation and Asset tasks

Newly published content permits only:

- owner types: `DEPARTMENT`, `EMPLOYEE`, `MANAGER`;
- work types: `CHECKLIST`, `ASSET`.

Rules enforced by service and database migration:

- Department ownership is derived from the enclosing Department slice;
- Employee and Manager tasks cannot retain Department or named-person assignment;
- named Employee/Designation assignment is rejected;
- approval workflow and unfinished generic execution configuration are rejected;
- dependencies must remain in the same Version and acyclic;
- a skippable task cannot be a prerequisite;
- Checklist tasks cannot retain a reference;
- Asset tasks must be Department-owned and reference an active same-Company Asset Type;
- Asset Type tracking must be `INDIVIDUAL` or `POOL`; `LOCATION` is rejected;
- Asset V2 must be enabled for the required Company/Branch scope.

### Asset fulfillment

Onboarding Asset fulfillment now:

- lists only authorized candidate Assets/pools;
- requires both Onboarding task authority and the applicable Asset permission/Department grant;
- calls the Asset internal assignment/allocation primitive inside the Onboarding transaction;
- writes source-bound provenance;
- stores either `employeeAssetId` or `softwareLicenseAllocationId`;
- marks the task completed only after Asset custody/allocation succeeds;
- writes action, audit, and outbox evidence atomically.

Database checks reject a completed Asset task without exactly one valid result and reject result references on a non-completed task.

## 4. UI implementation

The authoring UI now:

- uses the server-backed task create/update/delete path;
- sends row/version tokens on delete and publish;
- uses the correct singular Department Template API route;
- displays Department ownership as inherited;
- offers only Department, Employee, and Manager owners;
- supports Checklist and eligible Asset Type selection;
- refreshes after version conflicts.

Asset transfer and waiver evidence collection changes are documented separately in the Asset report.

## 5. New database migration

Migration:

`backend/prisma/migrations/20260819130000_onboarding_template_p0_p1_hardening/migration.sql`

### 5.1 Tenant-qualified relationships

The migration:

- adds `designations(companyId, id)` uniqueness;
- backfills and makes assignment `companyId` required;
- preflights existing assignment tenant mismatches;
- replaces Template Version → Template with a Company-qualified FK;
- replaces designation assignment relations with Company-qualified Designation, Branch, and Template FKs;
- uses `ON DELETE RESTRICT ON UPDATE RESTRICT` for historical integrity.

### 5.2 Concurrency and immutability

It adds:

- an advisory-lock assignment overlap trigger;
- DRAFT-only child INSERT/UPDATE/DELETE triggers;
- parent Version row locking inside the child trigger;
- task owner/reference shape trigger;
- publish guard for task shape, Branch/Department containment, dependency containment, skippable prerequisites, and cycles.

### 5.3 Asset-result integrity

It adds Company/Employee-qualified foreign keys from an Onboarding task to:

- `employee_assets(companyId, id, employeeId)`;
- `software_license_allocations(companyId, id, employeeId)`.

It adds a shape check and indexes for both result paths.

### 5.4 Deployment status

Before application, read-only `prisma migrate status` reported:

- 109 migrations found;
- only `20260819130000_onboarding_template_p0_p1_hardening` pending.

Following explicit approval on 2026-08-19, `prisma migrate deploy` applied
`20260819130000_onboarding_template_p0_p1_hardening` to `dsp_pms`. A subsequent
read-only status check reported that the database schema is up to date.

### 5.5 Isolated migration rehearsal and shared-schema preflight

On 2026-08-19, the current 109 migrations were deployed from zero into the isolated
`onboarding_template_rehearsal_background4` schema on the development database host.
The runner then verified the named constraints, triggers, and indexes, ran a second
`migrate deploy` that reported no pending migrations, and dropped that exact temporary
schema. `dsp_pms` was not the migration target.

The subsequent read-only preflight against `dsp_pms` returned zero exceptions and zero
skipped checks. Its ID-only report is kept outside the release artifact under
`.tmp-onboarding-rehearsal/shared-preflight.json`.

This proves the from-zero schema contract and the current shared-data preflight only.
After the approved shared-schema application, the catalog verifier found every named
constraint, trigger, and index, and the read-only post-apply preflight again returned
zero exceptions and zero skipped checks.

This does **not** prove an upgrade from a production-like legacy copy, backup/restore,
or rollback. Those production-release gates remain open.

## 6. Additional authorization hardening

During verification, a direct-command gap was found and fixed:

- task mutation endpoints no longer rely only on route access;
- the transaction reloads the task and Onboarding;
- current actor context and server `allowedActions` are recalculated;
- the requested action must be present before mutation;
- assignee candidates require Department assignment permission and exact Company/Branch/Department membership;
- task detail/history visibility is limited to HR monitor authority, the assignee, the joiner, or the matching permitted Department;
- HR override completion derives authority from the actor and requires an override reason.

## 7. Verification evidence

| Gate | Result |
|---|---|
| Prisma schema validation | Pass |
| Backend TypeScript | Pass |
| Changed backend ESLint | Pass, zero errors |
| Backend production build | Pass |
| Frontend TypeScript | Pass |
| Changed frontend ESLint | Pass, zero errors |
| Frontend unit tests | Pass: 18 files, 38 tests |
| Frontend production build | Pass |
| Focused Asset/Onboarding remediation tests | Pass: 16 suites, 63 tests |
| Runtime direct-authorization tests | Pass |
| Migration static contract tests | Pass |
| Disposable rehearsal runner static preflight | Pass; no database connection or migration application |
| Isolated from-zero migration rehearsal | Pass: 109 migrations, catalog verification, idempotent second deploy, and temporary-schema cleanup |
| Shared-schema Onboarding Template preflight | Pass: 0 exceptions, 0 skipped checks; read-only |
| Shared `dsp_pms` hardening migration | Pass: `20260819130000_onboarding_template_p0_p1_hardening` applied, status up to date, catalog verified, post-apply preflight 0 exceptions / 0 skipped |
| Git whitespace check | Pass |

## 8. Required database rollout

1. Run `pnpm onboarding-template:disposable preflight`. The checked-in runner refuses an implicit target; its `apply` mode requires an explicitly supplied disposable database URL, creates a random isolated schema, runs migrations twice, verifies the named database objects, and drops only that schema by default. It explicitly supplies `DATABASE_SCHEMA` to Prisma so the configured shared schema cannot be selected by the URL alone.
2. Run the Onboarding Template preflight against the release copy.
3. Confirm zero cross-tenant assignments, unsupported owners, named-person rows, branch mismatches, invalid dependencies, and invalid Asset references.
4. Rehearse all 109 migrations from zero.
5. Rehearse upgrade from a production-like copy with existing published Versions and active assignments.
6. Apply `20260819130000_onboarding_template_p0_p1_hardening` to the controlled UAT database.
7. Verify every named FK, trigger, check, and index from the catalog.
8. Re-run preflight and reconciliation.
9. Test rollback by restoring the backup; do not mark a partially applied contract migration as resolved.
10. Apply to production only after technical and business sign-off.

## 9. Remaining production gates

- [x] Reviewed Template P0/P1 application defects fixed
- [x] Asset fulfillment seam implemented
- [x] Prisma, TypeScript, lint, focused tests, unit tests, and builds pass
- [x] From-zero Onboarding hardening migration rehearsed in an isolated schema
- [ ] Production-like legacy upgrade rehearsal and reconciliation passed
- [x] Pending migration applied and catalog-verified in the shared development target
- [ ] Real PostgreSQL publish-versus-edit and assignment-overlap concurrency tests passed
- [ ] Real API tests prove Company/Branch/Department direct-ID isolation
- [ ] Real browser personas pass for Template author, HR monitor, Department assigner, assignee, joiner, manager, and Asset custodian
- [ ] Recruitment conversion → resolved Template → Onboarding → Asset custody → final completion → Probation lifecycle passes
- [ ] Notification/outbox retry and dead-letter behavior verified
- [ ] Backup/restore, monitoring, technical UAT, and business sign-off complete

The reviewed code fixes are complete. Database deployment and real integration/UAT evidence remain the boundary between code completion and production readiness.
