# Recruitment-to-Onboarding Latest Code Review

**Review date:** 2026-08-17  
**Reviewed commit:** `563f4d4b86e45e1ad3c5303ff0ecac3919d0f0c0`  
**Branch:** `main` tracking `origin/master`  
**Review type:** Read-only post-remediation review  
**Source reviews:**

- [Backend/API code review](./recruitment-to-onboarding-api-code-review.md)
- [Frontend/UI code review](./recruitment-to-onboarding-ui-code-review.md)

## 1. Executive verdict

The latest merge materially improves Recruitment, Public Careers, Offer, Conversion, and Onboarding integration. Most findings from the earlier API and UI reviews are fixed in code.

However, the remediation is **not fully closed** and Recruitment/Public Careers must remain disabled for production. There are no newly confirmed P0 defects, but several P1 transaction, recovery, notification, migration, and end-to-end acceptance blockers remain.

**Release status:** `NOT READY`  
**Recommended documentation status:** `REMEDIATION IN PROGRESS`

## 2. Repository and review status

- Latest changes were pulled successfully.
- Local `HEAD` matches `origin/master` at `563f4d4`.
- The existing API and UI review documents describe the earlier baseline and predate the latest hardening changes.
- This document records the current post-remediation result.
- No migration was executed or resolved during this review.
- No application source code was changed during this review.

## 3. Findings closed in the latest code

### 3.1 Backend/API findings materially closed

| Finding | Current result | Evidence summary |
|---|---|---|
| API-01 Offer tenant scope | Closed | Offer operations resolve the application through Recruitment domain scope. |
| API-02 Conversion tenant scope | Closed | Conversion load and transaction revalidation use scoped application predicates. |
| API-03 Candidate tenant scope | Closed | Candidates are scoped through accessible applications, including filtered application relations. |
| API-04 Job Opening hierarchy validation | Closed | Draft updates revalidate Company, Branch, Department, Designation, and manager hierarchy. |
| API-07 document download/security core | Materially closed | Downloads require `CLEAN`; production scanning fails closed; production storage requires encrypted private S3-compatible configuration. |
| API-09 Offer revision/versioning | Closed | Revision creates the next version, supersedes the previous offer, releases reservation state, and invalidates the previous response token. |
| API-10 terminal Offer response states | Closed | Public responses handle accepted, declined, revoked, superseded, and expired states. |
| API-11 Probation override authorization | Closed | Early confirmation uses a separate permission and requires an override reason. |
| API-12 career lifecycle events | Materially closed | Conversion, onboarding start/completion, and probation start now project career events. |

### 3.2 Frontend/UI findings materially closed

| Finding | Current result | Evidence summary |
|---|---|---|
| UI-01 mock mode default | Closed | Recruitment mock mode is opt-in outside production, with a visible development banner. |
| UI-02 raw Offer token exposure | Closed | HR UI no longer stores or displays the raw candidate response token/URL. |
| UI-03 Turnstile simulation | Closed in code | Real Turnstile is wired; simulation is restricted to mock mode; production missing configuration fails closed. |
| UI-04 public application anti-abuse contract | Closed in code | UI sends Turnstile token, honeypot, idempotency key, and files; backend verifies and rate-limits the request. |
| UI-05 Offer delivery state | Materially closed | UI reads sanitized persisted delivery state and provides the supported delivery retry action. |

## 4. Remaining P1 blockers

### P1-01 Conversion is not recoverably idempotent

**Evidence**

- `backend/src/modules/recruitment/conversion/conversion.service.ts:73-126`
- `backend/src/modules/recruitment/conversion/conversion.service.ts:214-240`
- `backend/src/modules/recruitment/conversion/conversion.service.ts:281-314`
- `frontend/features/recruitment/ready-to-hire/services/ready-to-hire-service.ts:51-74`

**Current behavior**

- Employee, User, headcount, and Onboarding creation are now handled inside a serializable transaction.
- Invitation delivery and the final Opening transition run after the transaction commits.
- Once `application.employeeId` exists, preflight returns an idempotent result and `convert()` exits early.
- That early return makes the existing missing-Onboarding repair branch unreachable for an already-converted application.
- A failed invitation delivery is not retried or repaired by repeating conversion.
- The live UI ignores the submitted application version, accepted-offer version, and confirmation note.
- The live UI exposes a retry flow, but its service currently throws instead of calling a supported retry endpoint.

**Business impact**

HR can receive a successful-looking conversion while the employee invitation or final Opening transition failed. The employee may exist without a usable activation path, and the UI cannot accurately report or recover the delivery state.

**Required closure**

- Keep conversion transactionally idempotent for Employee, User, Onboarding, headcount, and lifecycle state.
- Persist an invitation-delivery command/attempt in the same transaction through the outbox.
- Make repeated conversion return the same Employee and Onboarding while repairing any missing recoverable state.
- Return explicit invitation delivery state and supported allowed actions.
- Either accept and validate the UI concurrency fields or remove them from the UI contract.
- Provide a real versioned invitation resend command.

### P1-02 Required CV is persisted after the application transaction

**Evidence**

- `backend/src/modules/recruitment/public/public-careers.controller.ts:305-378`
- `backend/src/modules/recruitment/document/recruitment-document.service.ts:222-242`

**Current behavior**

- Candidate, Application, status history, idempotency state, and receipt outbox are committed first.
- Required CV scanning, object storage, and document-row creation run afterward.
- Duplicate retry can repair a missing CV, but only when the candidate retries.
- Object storage is written before the document row, without compensation when database persistence fails.

**Business impact**

A storage, antivirus, or document-database failure can leave an `APPLIED` application and an application-received notification without the required CV. The reverse failure can leave an orphaned object.

**Required closure**

Choose and implement one authoritative workflow:

1. Stage and validate the CV before committing the application, then atomically commit the application/document metadata and outbox; or
2. Introduce an explicit `PENDING_DOCUMENTS` state with a durable finalize/compensation workflow that prevents the application from being treated as submitted until the CV is complete.

The idempotency result must represent the whole submission, including its required document.

### P1-03 Recruitment delivery remains incomplete and incorrectly scoped

**Evidence**

- `backend/src/modules/recruitment/interview/interview.service.ts:235-249`
- `backend/src/modules/recruitment/notifications/recruitment-delivery.processor.ts:68-105`
- `backend/src/modules/recruitment/notifications/recruitment-delivery.processor.ts:126-243`

**Current behavior**

- Interview scheduling creates panel-recipient data but omits `candidateId`.
- Candidate-email processing exits when `candidateId` is missing, so scheduled-interview candidate email cannot be sent through this path.
- Internal recipient resolution matches role assignments using Company, Branch, or Company Group identifiers without first applying the role assignment's actual scope.
- A Branch-scoped HR user can therefore match an event from another Branch through the shared Company identifier.
- Persisted delivery-attempt state is implemented mainly for Offer send/retry; other Recruitment events do not consistently create a delivery attempt.

**Business impact**

Candidates may not receive interview communication, and internal Recruitment notifications may cross Branch boundaries. Operations also lack a consistent retry and audit trail for failed delivery.

**Required closure**

- Include the candidate identity in every candidate-directed event.
- Resolve recipients according to `RoleAssignment.scope`, not merely populated organization identifiers.
- Create a delivery-attempt record for every externally or internally delivered Recruitment event.
- Define deterministic retry, terminal failure, deduplication, and safe operational visibility.
- Add Branch-isolation and delivery-retry tests using a real database.

### P1-04 Onboarding completion can race with task state changes

**Evidence**

- `backend/src/modules/onboarding/employee-onboarding.service.ts:549-591`

**Current behavior**

Mandatory tasks are loaded and validated before the completion transaction. The completion transaction conditionally changes the Onboarding status but does not lock and revalidate the task set.

**Business impact**

A concurrent task reopen or update can allow Onboarding to become `COMPLETED` while a mandatory task is incomplete. Recruitment-created employees could then progress to Probation with an invalid Onboarding state.

**Required closure**

- Lock the Onboarding aggregate and its mandatory task rows in one transaction.
- Revalidate task completion after acquiring the locks.
- Complete Onboarding, start Probation, create career events, audit, and enqueue notifications atomically.
- Add concurrency tests for complete-versus-reopen and repeated completion.

### P1-05 Database migrations are pending and not upgrade-rehearsed

**Read-only migration status**

The configured development database reports 98 migrations, with these migrations pending:

- `20260814110000_recruitment_backfill`
- `20260817120000_recruitment_hardening`

**Migration risks**

- Immediate unique indexes and check constraints can fail when legacy duplicate or invalid data exists.
- Preflight evidence is missing for duplicate Candidate/Application Employee links, conflicting designation onboarding assignments, and invalid headcount/score data.
- Existing sent Offers do not have a documented `responseTokenCiphertext` backfill.
- Retry of an affected legacy Offer can return `OFFER_TOKEN_UNAVAILABLE`.
- The latest application code already depends on newly introduced columns and tables.

**Required closure**

- Add read-only preflight queries and explicit zero-result acceptance criteria.
- Define safe treatment of legacy sent Offers whose original response token cannot be recovered.
- Rehearse from-zero migration and upgrade migration against disposable PostgreSQL databases.
- Verify constraints, rollback/restore procedure, and post-migration invariants before deployment.

### P1-06 Real lifecycle browser acceptance is absent

**Evidence**

- `frontend/playwright.config.ts:31-35` forces Recruitment mock mode.
- `frontend/e2e/recruitment-hardening.spec.ts` contains broad mock-oriented smoke coverage only.
- `frontend/test-results/.last-run.json` records a failed run with ten failed test IDs.
- Referenced persona, accessibility, and extra suites are not present under `frontend/e2e` in the reviewed checkout.

**Business impact**

The real Opening → public application → CV → interview → Offer email/token → acceptance → conversion → activation → Onboarding → Probation lifecycle has not been proven against the API and database.

**Required closure**

- Add a committed real-API Playwright project that does not force mock mode.
- Run the approved HR, candidate, employee, manager, and unauthorized personas.
- Verify database state, email/outbox delivery, sanitized browser storage, allowed actions, and audit/career projections.
- Preserve reproducible artifacts for the exact reviewed commit.

### P1-07 Backend lint gate is failing

The current backend lint command reports **22 errors and 0 warnings**. The failures include Recruitment DTO/service formatting and unused imports, plus existing Attendance and route-policy formatting errors.

This is a release-gate failure even though the test suites pass.

## 5. Verification results

| Verification | Result | Qualification |
|---|---|---|
| Repository synchronization | Pass | `HEAD` matches `origin/master` at `563f4d4`. |
| Prisma schema validation | Pass | Schema validation completed successfully. |
| Backend automated tests | Pass | 78 suites and 473 tests passed. Coverage remains shallow for the critical Recruitment transaction and delivery paths. |
| Backend TypeScript compilation | Pass | No-output compilation passed. |
| Backend ESLint | Fail | 22 errors, 0 warnings. |
| Frontend TypeScript compilation | Pass | No-output compilation passed. |
| Frontend Vitest | Pass | 16 files and 34 tests passed. |
| Frontend ESLint | Pass with warnings | 0 errors and 3 unrelated warnings. |
| Real API/database Playwright lifecycle | Not proven | Current config forces mock mode; committed last run is failed. |
| Migration deployment | Not performed | Two Recruitment migrations remain pending. |
| Disposable upgrade rehearsal | Not proven | No recorded from-zero and upgrade-copy rehearsal. |
| Production dependency verification | Not proven | S3, ClamAV, Turnstile, SMTP, outbox worker, monitoring, and backup/restore require environment evidence. |

Passing unit tests do not override the failed lint gate, pending migrations, missing real browser lifecycle, or transaction/recovery blockers.

## 6. Closure sequence

1. Fix conversion repair/idempotency and make invitation delivery durable and retryable.
2. Make required-CV submission atomic or introduce an explicit durable pending-document workflow.
3. Correct Recruitment delivery recipient scope, candidate events, attempt tracking, and retry behavior.
4. Make Onboarding completion and Probation transition concurrency-safe.
5. Add migration preflight/backfill handling and complete disposable from-zero and upgrade rehearsals.
6. Clear backend lint and frozen-install reproducibility gates.
7. Run the real API/database/email browser persona lifecycle.
8. Complete technical UAT, operational verification, backup/restore evidence, and business sign-off.

## 7. Production acceptance criteria

Recruitment/Public Careers can be enabled only when all of the following are true:

- Conversion failure leaves no partial Employee/User/Onboarding/headcount state.
- Repeated conversion returns the same Employee and Onboarding and repairs supported incomplete delivery state.
- Invitation failure is visible and retryable without repeating conversion.
- A submitted application cannot be `APPLIED` without its required clean CV.
- Candidate and internal notifications are tenant/Company/Branch safe and have durable delivery attempts.
- Onboarding cannot complete while any mandatory task is incomplete, including under concurrent requests.
- Both pending migrations pass preflight, from-zero rehearsal, upgrade rehearsal, and post-migration verification.
- Backend lint, build, schema validation, and automated tests pass from a frozen install.
- Frontend lint, type-check, build, component tests, and real API Playwright tests pass.
- Real candidate token/email, document scanning/storage, employee activation, Onboarding, Probation, audit, and career projection are verified.
- Backup/restore, monitoring, alerting, rollback, technical UAT, and business sign-off are recorded.

## 8. Final status

The earlier reviews are useful and most of their direct code findings have been addressed. They should not yet be marked fully remediated because API-05, API-06, API-08, Onboarding completion concurrency, migration readiness, lint, and real lifecycle acceptance remain open.

Assets work may continue independently, but Onboarding production acceptance remains dependent on closing the Recruitment conversion and lifecycle boundary issues above.
