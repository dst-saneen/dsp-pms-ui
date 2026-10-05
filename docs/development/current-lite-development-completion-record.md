# Current Lite Development Completion Record

## Status

The bounded Current Lite development scope is code-complete for:

- Company/Branch-safe HR Request Types and employee HR Requests;
- sequential HR Request and Employee Separation approvals;
- Employee Separation and Department Clearance;
- Asset V2 clearance enforcement before final separation completion;
- authenticated HR Request attachments through File Storage V2;
- server-derived UI actions and module capability containment;
- employee, HR monitor, assigned approver, and Department clearance workspaces.

This record is development evidence, not production approval. The new database migration is pending and real PostgreSQL/API/browser E2E execution remains a separate release-validation phase.

## Database implementation

Added `20260901100000_hr_operations_hardening` as an additive migration. It has not been applied or resolved.

The migration provides:

- Company and Branch snapshots for HR Requests, Separations, Clearances, and Clearance Items;
- Company-qualified foreign keys for Employees, Request Types, Branches, Departments, files, and clearance actors;
- User actor evidence for create, approve, reject, cancel, complete, and command receipts;
- optimistic versions and Company-scoped idempotency receipts;
- one open Separation per Employee;
- Company-scoped HR Request numbers;
- lifecycle, terminal-evidence, manual Department ownership, and Asset-summary checks;
- `HR_REQUEST_ATTACHMENT` upload purpose and authenticated upload-session creator binding;
- permissions for HR Requests and Department Clearance, with system-role grants;
- query indexes for request, separation, clearance, receipt, and upload-session work queues.

Read-only migration helpers were added:

- `backend/prisma/preflight/20260901100000_hr_operations_hardening_preflight.sql`
- `backend/prisma/preflight/20260901100000_hr_operations_hardening_reconciliation.sql`

The configured `dsp_erp_dev` / `dsp_pms` migration-status check found 143 migrations and exactly one pending migration:

```text
20260901100000_hr_operations_hardening
```

No migration, resolve, preflight data query, or data correction was executed.

## Backend implementation

HR Requests now:

- derive the Employee and organization scope from the authenticated actor;
- accept an active Request Type, remarks, optional clean upload-session ID, and operation ID;
- resolve an active Company workflow before the global `HR_REQUEST` fallback;
- reject zero-step workflows during configuration rather than at submission time;
- resolve each approver on the server and prevent self-approval;
- use expected versions, HMAC-backed command receipts, audited transitions, and outbox events;
- expose only a safe response projection and server-calculated `allowedActions`;
- archive Request Types instead of deleting history.

Employee Separation and Clearance now:

- require an active, in-scope Employee and explicit HR, Finance, IT, and Admin Department mappings;
- create the Separation, approval transaction, manual clearance rows, Asset summary, audit, and outbox evidence transactionally;
- restrict approval to the exact current approver;
- restrict manual clear/reopen commands to an active Employee in the executor Department with the Department permission;
- keep Asset clearance system-managed and call Asset V2 synchronization and `assertResolved` inside final completion;
- atomically complete clearance, complete separation, deactivate the Employee and User sessions, write the career event, audit, and outbox evidence;
- reject stale versions, reused operation IDs, invalid direct IDs, cross-Company IDs, and cross-Branch Department mappings.

Unfinished legacy modules are no longer registered in `AppModule`. The local-disk document generator is disabled; generated documents must use File Storage V2.

## Frontend implementation

Added or completed:

- `/my-workspace/hr-requests`
- `/my-workspace/approvals`
- `/hr/hr-requests`
- `/hr/employee-separations`
- `/hr/employee-separations/[id]`

The UI:

- renders mutations only from backend `allowedActions`;
- uses typed workflow candidates instead of workflow UUID entry;
- uses the secure upload-session component and submits `attachmentUploadSessionId`;
- uses active Employee and Department lookup controls instead of raw IDs;
- requires explicit HR, Finance, IT, and Admin Department mappings;
- identifies Asset clearance as system-managed;
- hides disabled Onboarding, Asset, Delivery, File Operations, and Project routes through server capabilities;
- hides unfinished Onboarding execution-profile/rule authoring controls.

## Verification evidence

Backend evidence under Node 24.20.0:

- Prisma schema validation: passed.
- Prisma Client generation: passed.
- TypeScript 6 production configuration: passed.
- TypeScript 7 production configuration: passed.
- TypeScript 6 test configuration: passed.
- TypeScript 7 test configuration: passed.
- Full ESLint gate, including the previously ignored HR Request module: passed.
- Full Jest gate: 154 suites passed, 842 tests passed, 3 suites and 9 tests explicitly skipped.
- Production Nest build: passed.
- Repository secret scan: clean.
- `git diff --check`: passed.

Frontend evidence under Node 24.20.0:

- TypeScript 6: passed.
- TypeScript 7: passed.
- Full ESLint: passed.
- Full Vitest: 26 files and 51 tests passed.
- Production Next.js build: passed.

These are static, unit, and build results. They are not real PostgreSQL concurrency, provider, API, or browser-persona evidence.

## Remaining release gates

Before enabling this scope in development/UAT or production:

1. Configure a non-development `HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON` key ring and active version.
2. Run the read-only HR Operations preflight on the approved target and reconcile every non-zero finding through an approved data-fix runbook.
3. Rehearse the migration from zero and from production-like legacy data on disposable PostgreSQL.
4. Verify the resulting constraints, indexes, permission grants, actor evidence, backup, and restore behavior.
5. Obtain approval, apply the pending migration to development/UAT, and run post-migration verification. Do not apply it directly to production first.
6. Run real API and PostgreSQL concurrency tests for duplicate submissions, approval races, separation decisions, Department clearance, Asset resolution, and final completion.
7. Run real browser personas for Employee, assigned approver, HR monitor, HR manager, Department viewer, Department clearer, Company/Branch outsider, and cross-tenant outsider.
8. Prove the Recruitment to Onboarding to Asset to Separation/Probation lifecycle in the final golden-thread test.
9. Verify production email, notification, object storage, malware scanning, retry/dead-letter monitoring, and operational ownership.
10. Record technical, security, operations, and business sign-off.

## Recommended commit grouping

1. Existing P0/P1 gate and Onboarding Template/Designation hardening.
2. HR Operations Prisma schema, migration, preflight, permissions, and HMAC configuration.
3. HR Request, Request Type, secure attachment, approval, audit, and outbox backend.
4. Employee Separation, Department Clearance, and Asset V2 final-completion backend.
5. Module capability containment and Current Lite frontend routes/workspaces.
6. Test-fixture repairs, regression tests, and this completion record.
