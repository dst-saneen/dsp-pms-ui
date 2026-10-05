# Recruitment-to-Onboarding API Plan

## Document status

- Type: backend implementation and production-readiness plan
- Status: planned; this document does not claim the workflow is implemented
- Scope: database, domain services, APIs, authorization, integrations, migration, tests, and rollout
- Companion document: [Recruitment-to-Onboarding UI Plan](./recruitment-to-onboarding-ui-plan.md)

The API contract in this document is the source of truth for statuses, permissions, error codes, validation, and transition rules. The UI must consume this contract and must not redefine it.

## Purpose

Implement the complete employee-entry lifecycle:

`Job Opening -> Candidate -> Interview Sessions/Rounds -> Evaluation -> Selection -> Offer Acceptance -> Convert to Employee -> Onboarding -> Probation -> Active Employee`

Employees must enter the normal HR lifecycle through Recruitment. Direct Employee creation remains available only as an explicitly enabled migration/import exception. Recruitment history must remain linked to the Employee and appear in the authorized career timeline.

## Required business ownership

- HR creates and administers openings, candidates, applications, interviews, and offers.
- The opening's Hiring Manager makes the final selection or rejection decision.
- Assigned interview panel members submit evaluations only for their assigned sessions.
- The candidate accepts or declines through a secure public offer link.
- HR performs the final Employee conversion after acceptance and preflight validation.
- HR confirms the Employee as Active after probation has ended.

## Domain and database changes

All tables must use the repository's existing identifiers, audit fields, tenant keys, soft-delete conventions, and organization-scope patterns. New foreign keys and indexes must be introduced through additive Prisma migrations.

### Job Opening

Store at least:

- Human-readable opening number/code from Number Series.
- Company Group, Company, Branch, Department, and Designation.
- Hiring Manager Employee relation.
- Title, description, employment type, location, headcount, and target joining date.
- Application deadline and publication timestamps.
- Opening status and optimistic-concurrency version.
- Created/updated actor and audit timestamps.

### Job Opening Criterion

Store the configurable scorecard for an opening:

- Criterion name and description.
- Weight percentage.
- Display order.
- Required/active state.
- Opening relation.

The active criteria must total exactly 100 percent before an opening can be published. Published criteria are immutable for that opening; changing them requires a controlled revision before interviews begin or a new opening where evaluations already exist.

### Candidate

Store the person-level recruitment identity:

- First and last name.
- Normalized email and mobile values.
- Optional additional contact/profile fields approved by HR and privacy review.
- Tenant ownership and source.
- Link to the resulting Employee, when converted.

A Candidate may have multiple applications, but deduplication must prevent accidental duplicate identities within the same tenant while avoiding cross-tenant disclosure.

### Job Application

Store an application to a specific opening:

- Candidate and Job Opening relations.
- Application source: public careers or internal HR entry.
- Current status and concurrency version.
- Cover note and privacy-acknowledgement evidence.
- Submission, screening, selection, offer, acceptance, and hire timestamps as applicable.
- Resulting Employee relation after conversion.

Define and enforce the allowed duplicate-application policy for the same Candidate and Opening. An API conflict must not reveal an existing Candidate to an unauthenticated caller.

### Application Status History

Append one immutable row for every attempted successful transition:

- Application.
- From status and to status.
- Reason code and safe comment where applicable.
- Actor type and actor identifier.
- Timestamp and request/correlation reference.

History is append-only. Corrections are represented by a new business transition or audit entry, never by editing previous rows.

### Interview Session

Store:

- Application relation.
- Round number, round name, and required/optional flag.
- Start/end time and timezone.
- Mode: phone, video, or in person.
- Location or meeting link.
- Evaluation deadline.
- Status: scheduled, completed, cancelled, or rescheduled as defined by the final enum.
- Cancellation/reschedule reason and audit metadata.

### Interview Panel Member

Store the assigned User/Employee, lead-interviewer flag, assignment status, and session relation. A database uniqueness constraint must prevent duplicate assignment of the same panel member to one session.

### Interview Evaluation

Store one evaluation per assigned panel member and Interview Session:

- Draft/submitted status.
- Recommendation.
- Strengths, concerns, and confidential notes.
- Calculated weighted total.
- Submitted timestamp.
- Optimistic-concurrency version.

Submitted evaluations are immutable. A formal reopen flow, if later approved, must create auditable revision history and is outside the initial release.

### Interview Evaluation Score

Store one score per opening criterion:

- Evaluation relation.
- Criterion snapshot/reference.
- Score from 1 through 5.
- Weight snapshot.
- Calculated weighted contribution.

The server calculates totals; it never accepts a client-calculated final score as authoritative.

### Job Offer

Store versioned offers rather than overwriting sent offers:

- Application relation and version number.
- Status: draft, sent, accepted, declined, expired, revoked, or superseded.
- Role and organization snapshot.
- Reporting manager, employment type, and joining date.
- Structured compensation amount, currency, and monthly/annual period.
- Probation days, expiry date, and terms.
- Private generated-PDF document relation.
- Response-token hash, token expiry, response evidence, and response timestamp.
- Sent/revoked/superseded actor and timestamps.
- Optimistic-concurrency version.

Only one sent/actionable offer version may exist for an application. Revised offers create a new version and supersede the previous one.

### Recruitment Document

Store metadata only; file bytes remain in private object storage:

- Candidate/application/offer relation as appropriate.
- Document kind: CV, supporting document, or offer PDF.
- Original filename, safe display name, MIME type, size, checksum, and object-storage key.
- Malware-scan status and timestamps.
- Encryption/storage metadata required for operations.
- Uploaded-by identity and retention state.

No permanent public URL is stored.

### Employee Career Event

Create an append-only career timeline containing:

- Employee relation.
- Event type and event timestamp.
- Safe employee-visible summary.
- Optional HR-only detail/reference.
- Source module and source record identifier.
- Actor and audit reference.

Initial event types include application submitted, interviews completed, selected, offer accepted, Employee created, onboarding started/completed, probation started/confirmed, promotion, transfer, manager change, and separation/exit.

### Designation Onboarding Assignment

Support both default and branch-specific template resolution:

- Designation relation.
- Optional Branch relation; null means designation default.
- Onboarding Template relation.
- Effective dates and active state.
- Audit metadata.

Uniqueness constraints must prevent overlapping active default assignments and overlapping active assignments for the same Designation/Branch pair.

### Employee changes

Extend Employee with:

- Optional source Candidate relation.
- Creation source enum including `RECRUITMENT` and `LEGACY_IMPORT`.
- Employment status support for `PENDING_ONBOARDING`, `PROBATION`, and `ACTIVE`.
- Probation start date, planned end date, actual confirmation date, confirmed-by User, and confirmation note/reference.

Preserve the existing User/Employee separation: Employee is the workforce identity; User owns authentication, sessions, and role assignments.

### Backfill

The migration/backfill must:

1. Mark every existing Employee without a source as `LEGACY_IMPORT`.
2. Add one baseline career event per existing Employee without duplicating rows on retry.
3. Convert existing Designation onboarding-template links into default Designation Onboarding Assignments.
4. Retain the old Designation link temporarily as a read fallback during compatibility rollout.
5. Produce before/after counts and an exception report without logging confidential personal data.

## State machines

Transitions must be implemented in centralized domain services. Controllers, UI clients, background jobs, and import utilities may request transitions but may not update status columns directly.

### Job Opening

`DRAFT -> OPEN <-> ON_HOLD -> FILLED/CLOSED`

Rules include:

- Only a valid Draft can be published Open.
- On Hold openings are not publicly applyable.
- Filled is reached when filled headcount equals approved headcount.
- Closed is an explicit terminal administrative action.
- A terminal opening cannot accept new applications or issue new offers.

### Job Application

`APPLIED -> SCREENING -> INTERVIEW -> MANAGER_REVIEW -> SELECTED -> OFFER_SENT -> OFFER_ACCEPTED -> HIRED`

Terminal alternatives:

- `REJECTED`
- `WITHDRAWN`
- `OFFER_DECLINED`

Expiry and revocation are offer outcomes; the transition service must put the application into the approved follow-up state and release any reservation atomically.

### Employee

`PENDING_ONBOARDING -> PROBATION -> ACTIVE`

- Conversion creates `PENDING_ONBOARDING`.
- Required onboarding completion moves the Employee to `PROBATION` and records calculated probation dates.
- Only authorized HR can confirm `ACTIVE`, and only on or after the probation end date unless a separately authorized override with reason is approved.

### Transition guarantees

Every successful transition must:

1. Validate current state, requested state, actor, tenant, relationship, and prerequisites.
2. Use optimistic or row-lock concurrency protection.
3. Update the aggregate.
4. Append immutable status/career history as applicable.
5. Write a safe business audit.
6. Enqueue notifications through the transactional outbox where applicable.
7. Return the new server version and allowed next actions.

Invalid state returns HTTP `409` with a stable domain error code. Out-of-scope records follow the existing tenant-safe `404` behavior.

## Core rules

- Opening criteria must total 100 percent before publication.
- The Hiring Manager must be active and have an active linked User.
- Only assigned panel members can save or submit their evaluations.
- Evaluations become immutable after submission.
- All required interviews must be completed and their required evaluations submitted before manager review can finish.
- Only the opening's Hiring Manager can make the final selection or rejection.
- HR prepares and sends offers after manager selection.
- Sending an offer reserves one headcount position atomically.
- Declined, expired, revoked, or superseded actionable offers release the reservation atomically.
- Candidate acceptance does not create an Employee automatically.
- HR performs conversion only after a successful server-generated preflight.
- Conversion is idempotent and transactionally creates Employee, User invitation, role assignment, onboarding snapshot, and history.
- Onboarding completion moves Employee to Probation.
- HR manually confirms Active after the probation end date.
- Confidential evaluation notes and compensation are never exposed through employee self-service.

## API groups

All endpoints use the repository's existing `/api` prefix, authentication conventions, validation pipeline, request references, tenant context, pagination envelope, and error format. Exact DTO names may follow repository conventions, but their fields and state rules must remain contract-compatible with this document.

### Public Careers and offer response

- List published, open, non-expired openings by company code.
- View one public opening by company code and opening code.
- Submit an application with required CV and optional supporting files.
- Inspect a valid offer-response token without consuming it.
- Atomically accept or decline an offer.
- Request a short-lived authorized offer-document download link.

Public responses must not expose internal database identifiers, existing Candidate records, panel data, private evaluation data, or tenant configuration.

### HR Recruitment

- Opening create, read, update, list, publish, hold, reopen where allowed, close, and dashboard actions.
- Candidate and Application read/list and controlled internal intake.
- Start screening, advance to interview, reject, or record withdrawal.
- Interview schedule, reschedule, cancel, complete, and panel administration.
- Offer draft, preview, send, retry delivery, revise, revoke, and inspect.
- Conversion preflight and idempotent conversion.
- Recruitment dashboard summaries and action queues.

### Manager and panel self-service

Relationship-scoped `/me` endpoints provide:

- Assigned interviews.
- Evaluation draft save and final submit.
- Hiring-decision queue for openings where the caller is the Hiring Manager.
- Candidate comparison for the caller's own opening.
- Select or reject action.

The backend derives the caller's relationships. It does not trust opening, manager, panel, company, or branch scope supplied by the client.

### Employee lifecycle

- Authorized HR career timeline, including confidential recruitment references where permitted.
- Employee self-service sanitized career timeline.
- Career actions for promotion, transfer, and manager change.
- Probation-due queue and probation confirmation.

## Conversion preflight

The preflight response must be server-generated and include pass/fail results for:

- Offer accepted and current accepted version identified.
- Position still reserved.
- Candidate/Application not already converted, or existing conversion returned.
- Candidate email present and valid for User invitation.
- Company, Branch, Department, Designation, and Manager active and in scope.
- Current published onboarding-template version resolved.
- No conflicting Employee/User identity.
- Employee number and invitation dependencies available.

Failures return stable, actionable codes without partially creating records.

## Conversion transaction

Run conversion at serializable isolation with bounded retry for serialization conflicts:

1. Lock Candidate, Application, accepted Offer, and Job Opening.
2. Revalidate accepted state, tenant scope, and reserved headcount.
3. Resolve the Branch override or Designation default onboarding template and its current published version.
4. Create Employee as `PENDING_ONBOARDING` with creation source `RECRUITMENT`.
5. Link Candidate, Application, and Employee.
6. Create the invited User and Employee role assignment using existing security conventions.
7. Create the invitation record with an expiring single-use invitation token.
8. Snapshot onboarding tasks, dependencies, due dates, and assignees from the resolved published version.
9. Mark the Application `HIRED` and append status history.
10. Convert the reserved headcount position to filled.
11. Write the business audit, career events, and safe outbox notifications.
12. Commit, then attempt to send the User invitation.

Invitation delivery is a retryable post-commit operation. A delivery failure must not roll back a successfully created Employee, and the HR UI must expose a safe resend action.

Repeated conversion for the same Application must return the existing Employee and Employee Onboarding rather than create duplicates. Database uniqueness constraints must backstop service-level idempotency.

## Onboarding-template resolution

Resolution order:

1. Active Branch-specific assignment for the Employee's Designation.
2. Active Designation default assignment.
3. Block with an actionable `ONBOARDING_TEMPLATE_NOT_CONFIGURED` error.

Offer sending and conversion require the resolved template to have a current published version. Existing Designation template links remain a temporary read fallback for compatibility and must emit operational metrics so they can be retired deliberately.

## Direct Employee creation restriction

- Remove direct-create access from regular HR roles and menus.
- Keep `POST /employees` only for Platform Administrator.
- Require server configuration `ALLOW_LEGACY_EMPLOYEE_CREATE=true`.
- Require a migration/import reason and external reference.
- Mark every resulting record `LEGACY_IMPORT`.
- Write a high-signal audit containing identifiers and reason, but no unnecessary personal data.
- Never allow this exception to start the public/normal hire flow.

Existing Employee update APIs remain available for personal-data maintenance. Organization, Designation, and Manager changes must use dedicated, auditable career actions.

## Private documents

Use private S3-compatible object storage.

### Upload requirements

- CV is required for an application.
- Allowed formats: PDF, DOC, and DOCX.
- Maximum file size: 10 MB per file.
- Maximum optional supporting documents: five.
- Validate extension, declared MIME, detected MIME/file signature, size, and checksum.
- Scan with ClamAV before marking the object available.
- Reject or quarantine failed/unscanned objects according to the retention policy.
- Apply server-side encryption.
- Serve only short-lived, authorized download URLs.
- Never store or return a permanent public URL.

Generate the offer PDF on the server from the immutable offer-version snapshot and store it privately under the same controls.

Download authorization must be rechecked before each signed URL is issued. Object keys, malware results, and storage credentials must not appear in public responses or generic logs.

## Offer-response security

- Generate a cryptographically secure 32-byte random response token.
- Store only an HMAC hash using the distinct `offer-response` purpose and the configured action-token secret.
- Make the token single-use and expiring.
- Inspect without consuming; accept/decline consumes atomically.
- Require typed legal name and explicit acknowledgement.
- Store privacy-approved response evidence, including hashed IP and user-agent values.
- Protect against retry, replay, and concurrent response races with transaction/uniqueness controls.
- A revised offer creates a new version and invalidates the previous token.
- Never place raw tokens in logs, audits, analytics, or outbox payloads.

## Permissions and route policy

Add permission catalog entries:

- `hr.recruitment.read`
- `hr.recruitment.manage`
- `hr.recruitment.offer`
- `hr.recruitment.convert`

Grant them through an additive permission migration to:

- Organization Owner
- Company Administrator
- HR Manager

Map every new internal route explicitly in route policy; do not rely on a broad fallback permission.

Managers and interviewers use relationship-scoped `/me` endpoints. Authentication or a generic self-service permission never grants access to unrelated Candidates, Applications, Interviews, evaluations, offers, CVs, or compensation.

## Notifications

### Candidate email

- Application receipt.
- Interview schedule, change, and cancellation.
- Secure offer link.
- Acceptance or decline confirmation.
- Employee account invitation after conversion.

### Internal notification

- New application.
- Interview assigned.
- Evaluation due.
- Hiring Manager decision due.
- Offer accepted.
- Candidate ready to hire.
- Conversion completed.
- Probation confirmation due.

Notification payloads contain only safe identifiers, routing references, and non-confidential summaries. CV contents, salary, offer terms, response tokens, and confidential feedback must not be written to logs or generic outbox payloads.

## Backend implementation sequence

1. Lock enums, transition matrix, stable errors, permission map, and public/internal DTO contract.
2. Add additive Prisma schema/migrations, constraints, indexes, and idempotent backfills.
3. Implement private document storage, validation, scanning, authorization, and retention hooks.
4. Implement Opening, Candidate, Application, and immutable status-history services.
5. Implement Interview, panel assignment, and evaluation services.
6. Implement manager selection and headcount-reservation concurrency controls.
7. Implement versioned offers, PDF generation, secure response tokens, and email delivery.
8. Implement conversion preflight and serializable idempotent conversion.
9. Connect onboarding completion to Probation and add manual Active confirmation.
10. Add career timeline projections, confidential/sanitized views, notifications, audit, and operational metrics.
11. Restrict legacy Employee creation and activate explicit route policies.
12. Complete automated tests, disposable migration rehearsals, pilot UAT, and controlled rollout.

## Backend tests

Cover at minimum:

- All valid and invalid state transitions.
- Tenant, Company, Branch, and relationship isolation.
- Candidate and Application deduplication without public disclosure.
- Opening criteria validation and published immutability.
- Panel and Hiring Manager authorization.
- Evaluation draft behavior and post-submit immutability.
- Required-round completion rules.
- Headcount reservation, release, and concurrency.
- Offer versioning, token expiry, replay, and concurrent response.
- Document type/size/signature/scan and download authorization.
- Template default, Branch override, fallback, and missing configuration.
- Conversion transaction rollback at each failure boundary.
- Concurrent and repeated conversion idempotency.
- Invitation post-commit failure and retry.
- Onboarding-to-Probation transition.
- Probation date validation and Probation-to-Active confirmation.
- Legacy Employee-create feature flag, permission, and required reason.
- Confidential HR timeline versus sanitized employee timeline.
- Audit/outbox payload redaction.

Tests must include unit/domain tests, service integration tests against PostgreSQL, API authorization tests, and migration rehearsals from both an empty database and a representative upgraded snapshot.

## Backend rollout

- Use additive migrations only.
- Rehearse from-zero and upgrade paths in disposable databases.
- Do not deploy or test migrations directly against a shared database first.
- Ship feature flags disabled by default.
- Configure and validate S3-compatible storage, ClamAV, email, privacy notice, retention, token secrets, and monitoring before enablement.
- Enable internal Recruitment for authorized HR users first.
- Pilot one opening through the complete flow, including declined/retried/error cases.
- Enable public Careers only after technical UAT, security/privacy review, and business UAT.
- Keep legacy direct Employee creation disabled unless an approved migration window requires it.

## Production acceptance criteria

The backend is production-ready only when:

- The complete lifecycle succeeds without manual database changes.
- All status changes use the centralized transition services and immutable history.
- Cross-tenant and relationship authorization tests pass.
- Headcount and conversion remain correct under concurrent requests.
- Private documents and response tokens pass security review.
- Existing Employees and template links are backfilled and reconciled.
- From-zero and upgrade migrations pass in disposable environments.
- Tests, lint, build, monitoring, alerting, backup/restore checks, and runbooks pass the release gates.
- HR, Hiring Manager, panel member, candidate, and employee personas complete signed-off UAT.

