# Recruitment-to-Onboarding Backend/API Code Review

## Review scope

- Repository: `C:\DataScape\HRMS\ERP`
- Branch: `main`
- Reviewed commit: `aa281d1`
- Comparison baseline: `d5dbd63`
- Review date: 2026-08-17
- Review type: source, schema, migration, security, transaction and automated-gate review
- Application code changes made by this review: none
- Shared database migrations or production deployments performed: none

This document reviews the backend implementation against the approved flow:

`Job Opening → Candidate → Interview Sessions/Rounds → Evaluation → Selection → Offer Acceptance → Convert to Employee → Onboarding → Probation → Active Employee`

The approved contract remains [recruitment-to-onboarding-api-plan.md](./recruitment-to-onboarding-api-plan.md). This review records the current implementation status and deviations; it does not replace that contract.

## Executive verdict

The backend contains a substantial Recruitment-to-Employee foundation, but it is **not production-ready**. The main blockers are tenant-scope bypasses, a non-atomic conversion boundary, incomplete document security, incomplete candidate communications and insufficient integration/concurrency verification.

`RECRUITMENT_ENABLED` and public recruitment flags should remain disabled until all P1 findings are resolved and verified against a disposable database and a real end-to-end environment.

## Backend capabilities currently present

The latest code includes foundations for:

- Job openings and weighted evaluation criteria
- Candidates and job applications
- Application status history and centralized transition services
- Interview scheduling, panel membership and evaluations
- Hiring Manager decisions through relationship-scoped endpoints
- Versioned offers, response tokens and headcount reservation
- Public careers and public offer-response endpoints
- Employee conversion preflight and conversion services
- Designation/branch onboarding-template resolution
- Employee career events and probation transitions
- Recruitment permissions and feature guards
- Recruitment document metadata and generated offer PDFs
- Recruitment outbox event creation

These foundations do not yet prove the complete client flow works safely end-to-end.

## P1 production blockers

### API-01: Offer operations bypass tenant scope

Severity: **P1 — security and tenant-isolation blocker**

[`OfferService.assertApplicationInScope`](../../backend/src/modules/recruitment/offer/offer.service.ts#L668) uses `findUnique({ id })` and does not apply `RecruitmentDomainScopeService`. Offer draft, lookup, send, revise, retry and revoke operations rely on this helper.

Impact:

- A user with Recruitment offer permission can operate on another tenant's application if its UUID is known.
- Permission checks alone do not protect company or branch boundaries.
- Candidate compensation and offer data may be exposed or mutated across tenants.

Required correction:

- Query the application with `jobApplicationWhere()` or an equivalent scoped predicate.
- Return the same not-found response for nonexistent and out-of-scope records.
- Add company-group, company and branch isolation tests for every offer action.

### API-02: Conversion preflight and conversion load applications globally

Severity: **P1 — security and data-integrity blocker**

[`ConversionService.loadApplication`](../../backend/src/modules/recruitment/conversion/conversion.service.ts#L689) also uses an unscoped `findUnique({ id })`. The [controller](../../backend/src/modules/recruitment/conversion/conversion.controller.ts#L16) verifies permission but does not establish record scope itself.

Impact:

- A user with `hr.recruitment.convert` can preflight or attempt conversion against another tenant's application.
- Employee and User records may be created in an unintended company before a later scoped operation rejects the request.

Required correction:

- Make tenant scope a mandatory input to preflight and conversion.
- Apply the scoped predicate before any readiness response or mutation.
- Revalidate the scope inside the conversion transaction.

### API-03: Candidate company/branch scope exposes sibling-tenant applications

Severity: **P1 — confidentiality blocker**

[`candidateWhere()`](../../backend/src/modules/recruitment/core/recruitment-domain-scope.service.ts#L57) checks whether the Candidate's company group contains the active company. That condition is true for every Candidate in the group and does not restrict by the Candidate's applications. Branch scope is not represented.

[`CandidateService`](../../backend/src/modules/recruitment/candidate/candidate.service.ts#L11) then includes all applications for every returned Candidate.

Impact:

- Company- or branch-scoped HR users can see Candidate identity/contact data and applications belonging to sibling companies or branches.
- The exposure includes email, mobile and opening history.

Required correction:

- Scope Candidates through at least one accessible Job Application/Job Opening.
- Scope included applications separately so a visible Candidate does not expose inaccessible applications.
- Add negative tests for sibling company and sibling branch access.

### API-04: Draft opening updates can move records outside the authorized hierarchy

Severity: **P1 — authorization and hierarchy-integrity blocker**

The opening is initially scoped, but [`JobOpeningService.update`](../../backend/src/modules/recruitment/job-opening/job-opening.service.ts#L177) writes replacement `companyId`, `branchId`, `departmentId` and `designationId` values without rerunning the create-time hierarchy validation.

Impact:

- An authorized user can move a draft opening to out-of-scope hierarchy IDs.
- Cross-company branch/department/designation combinations can be persisted.
- Hiring Manager validation does not fully prove the manager belongs to the resulting hierarchy.

Required correction:

- Resolve and validate every changed hierarchy ID under the active scope.
- Validate company → branch → department → designation relationships together.
- Validate the Hiring Manager against the finalized opening company and applicable organizational rules.

### API-05: Conversion is not atomic or recoverably idempotent

Severity: **P1 — employee lifecycle blocker**

The main transaction commits at [`conversion.service.ts`](../../backend/src/modules/recruitment/conversion/conversion.service.ts#L162). Onboarding creation and invitation delivery execute afterward at [`conversion.service.ts`](../../backend/src/modules/recruitment/conversion/conversion.service.ts#L210).

If onboarding creation fails:

1. Employee, User, invitation, application and headcount changes are already committed.
2. A retry sees `application.employeeId`.
3. The idempotent path returns the Employee without creating the missing onboarding.

The transaction also does not explicitly request serializable isolation, and the documented records are not locked with database row locks.

Required correction:

- Include the onboarding snapshot and all database lifecycle records in the serializable transaction.
- Use bounded retries for serialization failures.
- Lock or atomically revalidate Application, accepted Offer and Opening/headcount.
- Make the idempotent path detect and repair an incomplete onboarding/invitation state.
- Keep only external delivery after commit, backed by a retryable delivery record.

### API-06: Public applications can commit without the required CV

Severity: **P1 — recruitment data-integrity blocker**

Candidate, Application, status history and outbox changes commit at [`public-careers.controller.ts`](../../backend/src/modules/recruitment/public/public-careers.controller.ts#L228). CV and supporting files are stored afterward at [line 294](../../backend/src/modules/recruitment/public/public-careers.controller.ts#L294).

Impact:

- A signature, malware scan, filesystem or database-document failure leaves an `APPLIED` application without its required CV.
- A repeated submission takes the duplicate-success path and does not repair the missing CV.
- The submission lookup validates `OPEN` but does not reject an expired `applicationDeadline`.
- `FileFieldsInterceptor` has file counts but no upload-size limits, so unauthenticated files are buffered before service validation.

Required correction:

- Stage and validate documents before committing the final Application state, or use a recoverable `PENDING_DOCUMENTS` workflow.
- Ensure retries can complete an interrupted submission idempotently.
- Enforce deadline and remaining-publication conditions on the submission endpoint.
- Configure Multer request/file-size limits before buffering.

### API-07: Pending malware scans are downloadable

Severity: **P1 — document-security blocker**

[`assertDocumentAvailable`](../../backend/src/modules/recruitment/document/recruitment-document.service.ts#L240) accepts both `CLEAN` and `PENDING`. In production, missing ClamAV configuration explicitly produces `PENDING` at [`scanFile`](../../backend/src/modules/recruitment/document/recruitment-document.service.ts#L357).

Additional deviations:

- Storage uses the local filesystem rather than private S3-compatible object storage.
- Server-side object encryption is not established.
- An infected file is written before scanning and is not removed or quarantined when scanning rejects it.
- Filesystem and document-row writes are not one recoverable storage workflow.

Required correction:

- Only `CLEAN` documents may receive download tokens or streams.
- Fail closed when ClamAV is unavailable in production.
- Delete/quarantine rejected objects.
- Implement private S3-compatible storage, encryption and authorized short-lived download URLs.

### API-08: Recruitment notifications and Candidate email delivery are incomplete

Severity: **P1 — end-to-end workflow blocker**

Recruitment services enqueue events, including [`recruitment.offer.sent`](../../backend/src/modules/recruitment/offer/offer.service.ts#L367). However, [`OutboxProcessorService`](../../backend/src/modules/outbox/outbox-processor.service.ts#L131) only creates internal User notifications. Recruitment payloads generally contain neither `recipientUserIds` nor `employeeId`, so recipient resolution returns an empty list.

No Candidate-email handler was found for:

- Application receipt
- Interview schedule/change/cancellation
- Offer link
- Acceptance/decline confirmation
- Ready-to-hire or conversion notifications

The offer outbox payload does not contain a usable response token. Only its HMAC hash is stored, so [`retryDelivery`](../../backend/src/modules/recruitment/offer/offer.service.ts#L431) cannot reconstruct the Candidate link.

Required correction:

- Add explicit internal-recipient resolution per Recruitment event.
- Add a Candidate-email delivery pipeline with sanitized payloads/templates.
- Persist a safe, retryable delivery command without exposing the raw token to HR clients or generic logs.
- Record delivery attempts, terminal failures and retry state.

## P2 functional and contract deviations

### API-09: Offer revision history is inconsistent

[`revise`](../../backend/src/modules/recruitment/offer/offer.service.ts#L540) accepts a draft or sent offer. A draft revision then calls `createDraft`, which rejects the still-open draft. A sent revision revokes the previous version instead of recording `SUPERSEDED` and linking `supersededByOfferId`.

Required correction:

- Define one atomic revision operation.
- Close/link the previous version as `SUPERSEDED`.
- Invalidate the previous response token and reserve/release headcount exactly once.

### API-10: Public offer states are over-normalized

Expired, revoked, declined and already-responded tokens generally collapse to an invalid-token response. This prevents the UI from presenting the safe, distinct terminal states required by the contract.

Required correction:

- Preserve a non-secret response reference or state lookup that can return sanitized terminal status without enabling token replay.

### API-11: Early probation confirmation lacks separate authorization

[`EmployeeProbationService.confirmActive`](../../backend/src/modules/recruitment/probation/employee-probation.service.ts#L47) accepts an `override` flag under the normal recruitment-manage permission. Any note can become the override reason.

Required correction:

- Require a distinct early-confirmation permission or higher administrative role.
- Require a structured reason and retain explicit audit evidence.

### API-12: Employee career history is incomplete

Onboarding completion starts Probation in [`employee-onboarding.service.ts`](../../backend/src/modules/employee-onboarding/employee-onboarding.service.ts#L472), but the career timeline does not fully project:

- Application submitted
- Interviews completed
- Candidate selected
- Offer accepted
- Onboarding started
- Onboarding completed

Required correction:

- Project the approved milestone summaries during conversion/onboarding transitions.
- Keep confidential evaluation, compensation and recruitment notes out of employee-visible history.

### API-13: Database backstops and migration verification are incomplete

The additive migration establishes the principal tables and indexes, but production readiness still needs database-enforced or concurrency-proven protection for:

- One active default onboarding-template assignment per designation
- One active branch override per designation/branch
- Headcount invariants
- Score and weight ranges
- Offer/version uniqueness under concurrency
- Conversion uniqueness and idempotency

No from-zero or upgrade disposable migration rehearsal was performed during this review.

## Automated verification results

| Gate | Result | Evidence |
|---|---:|---|
| Prisma schema validation | Passed | Schema reported valid |
| Backend production build | Passed | Prisma generation and Nest build completed |
| Backend full test suite | Failed | 73/74 suites; 456/457 tests passed |
| Backend lint check | Failed | 94 errors; many occur in new Recruitment files |
| Disposable migration rehearsal | Not run | No disposable database was provisioned in this review |
| Live API/database flow | Not run | No integrated environment was started |

The failing test is [`workforce-jobs.scheduler.spec.ts`](../../backend/src/modules/workforce-jobs/workforce-jobs.scheduler.spec.ts#L27). `OfferService` was added to the scheduler constructor, but the positional test fixture was not updated, shifting the remaining mocks.

## Missing backend test coverage

The new backend test coverage is primarily utility-level. Production sign-off still requires automated coverage for:

- Company-group, company and branch isolation
- Cross-tenant UUID access attempts
- Opening hierarchy validation on update
- Candidate/application deduplication under concurrency
- Interview panel and Hiring Manager relationship authorization
- Submitted evaluation immutability
- Headcount reservation/release concurrency
- Offer token expiry, replay and revision
- Document size, signature, scan, quarantine and download authorization
- Public submission failure and repair
- Template resolution and published-version requirements
- Serializable conversion and rollback
- Concurrent conversion and idempotent repair
- Invitation failure and retry
- Onboarding-to-Probation transition
- Probation-to-Active authorization
- Confidential versus employee-visible career history

## Required backend completion order

1. Fix tenant scope and hierarchy validation across every read and mutation.
2. Redesign conversion as a serializable, recoverable unit of work.
3. Redesign public submission/document persistence so required CV integrity is guaranteed.
4. Implement private object storage, fail-closed malware scanning and secure downloads.
5. Implement Candidate email and internal Recruitment notification delivery.
6. Correct offer revision, retry and terminal-state behavior.
7. Complete career-event projection and probation override authorization.
8. Add database backstops and the missing service/integration/concurrency tests.
9. Clear build, lint and full backend test gates.
10. Run from-zero and upgrade disposable migration rehearsals, then pilot one opening end-to-end.

## Backend release decision

**Do not deploy or enable the Recruitment backend in production yet.**

Backend approval requires all P1 findings closed, green automated gates, disposable migration evidence, configured storage/ClamAV/email services and a successful integrated pilot covering the full Job Opening-to-Active Employee lifecycle.

