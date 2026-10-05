# Recruitment-to-Onboarding UI Plan

## Document status

- Type: frontend implementation and production-readiness plan
- Status: planned; this document does not claim the workflow is implemented
- Scope: internal Recruitment UX, manager/panel workspaces, public Careers, offer response, Employee lifecycle UI, tests, and rollout gates
- Contract source: [Recruitment-to-Onboarding API Plan](./recruitment-to-onboarding-api-plan.md)

The UI consumes the API contract defined by the backend document. It must not perform unauthorized state transitions, infer tenant scope locally, calculate an authoritative hiring state, or redefine backend statuses, permissions, validation, error codes, and transition rules.

## Purpose

Deliver a complete, role-aware interface for:

`Job Opening -> Candidate -> Interview Sessions/Rounds -> Evaluation -> Selection -> Offer Acceptance -> Convert to Employee -> Onboarding -> Probation -> Active Employee`

The normal Employee entry point becomes Recruitment. The full Recruitment-to-Employee history remains available to authorized HR users, while Employee self-service exposes sanitized career milestones only.

## UX principles

- Display only server-authorized records and actions.
- Use server-returned allowed actions and versions after every transition.
- Make the current state, next owner, blockers, and deadlines obvious.
- Never expose confidential evaluation notes, CVs, compensation, or internal identifiers to unauthorized personas.
- Preserve immutable history visually; do not provide edit/delete controls for submitted history.
- Show safe error messages with the existing request-reference pattern.
- Support keyboard navigation, responsive layouts, loading/empty/error states, and interrupted/retried operations.

## Navigation and routes

Add **Recruitment** under **Human Resources** with permission-aware navigation items:

- Recruitment Dashboard
- Job Openings
- Candidates
- Applications
- Interview Calendar
- Offers / Ready to Hire

### Internal routes

- `/hr/recruitment`
- `/hr/recruitment/openings`
- `/hr/recruitment/openings/[id]`
- `/hr/recruitment/candidates`
- `/hr/recruitment/candidates/[id]`
- `/hr/recruitment/applications`
- `/hr/recruitment/applications/[id]`
- `/hr/recruitment/interviews`
- `/hr/recruitment/offers`

### Public routes

- `/careers/[companyCode]`
- `/careers/[companyCode]/jobs/[openingCode]`
- `/offer-response?token=...`

Internal pages use the existing workspace shell. Public pages use a minimal branded shell that does not depend on authentication and never exposes internal navigation.

Direct navigation must still rely on backend authorization. Hiding a menu or action is usability behavior, not a security boundary.

## Recruitment Dashboard

Show tenant-scoped KPI cards and actionable queues for:

- Open positions.
- Remaining headcount.
- New Candidates.
- Interviews today.
- Evaluations pending.
- Hiring Manager decisions pending.
- Offers awaiting response.
- Accepted Candidates ready to hire.
- Conversion and onboarding-template blockers.

Each KPI links to a pre-filtered authorized list. Counts and queue membership come from the server and share the same status rules as the detail pages.

The dashboard must display:

- Last refresh time.
- Loading skeletons.
- Zero/empty states.
- Partial failure with retry.
- Permission-safe omission of cards the user cannot access.

## Job Opening UI

### Opening list

Provide search, status, Company, Branch, Department, Designation, Hiring Manager, deadline, and ownership filters subject to the caller's scope. Show opening code, title, organization, headcount used/reserved/remaining, deadline, status, and next action.

### Opening editor

Sections:

- Job details.
- Company, Branch, Department, and Designation.
- Hiring Manager.
- Employment type and location.
- Headcount and target joining date.
- Application deadline.
- Weighted evaluation criteria.

Criteria editing supports add, reorder, edit, and remove while Draft. Display the running total and prevent accidental submission of invalid numeric values, while retaining the backend as final validator.

### Publication checklist

Display backend validation results for:

- Organization active.
- Hiring Manager linked to an active User.
- Headcount valid.
- Deadline valid.
- Criteria total exactly 100 percent.

The Publish button is available only when permitted, but the server remains authoritative. Published criteria are read-only. Hold and Close actions require confirmation and display the business impact returned by the API.

## Candidate and Application UI

### Candidate intake

Support both:

- Public application through Careers.
- Internal entry by authorized HR for an application received through an approved offline source.

Internal entry still creates a Candidate and Job Application; it must never bypass Recruitment by creating an Employee directly.

### Application list

Filters:

- Opening.
- Branch.
- Status.
- Submission date.
- Candidate search.

Columns should include application number, Candidate name, Opening, Branch, current status, submission date, current owner/action, and relevant deadline. Confidential fields are omitted unless explicitly permitted.

### Application detail

Tabs:

- Overview
- Documents
- Interviews
- Evaluations
- Offer
- Timeline

The Timeline is chronological and immutable. It displays actor-safe summaries, timestamps, status changes, and business events returned by the API.

Authorized HR actions:

- Start screening.
- Advance to interview.
- Reject with a required reason.
- Record withdrawal where appropriate.
- Schedule, reschedule, or cancel interviews.
- View submitted evaluations.
- Prepare an offer after Hiring Manager selection.

Each transition uses a confirmation dialog where impact or irreversibility matters, sends the last server version, refreshes all affected queries, and displays any stale-state conflict returned by the API.

## Interview UI

### Interview calendar and list

Support calendar and table views with filters for date, Opening, Branch, round, status, panel member, and Hiring Manager. Times must display in the user's timezone while preserving the scheduled timezone.

### Scheduler

Capture:

- Round number and name.
- Required or optional.
- Date, time, duration, and timezone.
- Phone, video, or in-person mode.
- Location or meeting link.
- Panel members and lead interviewer.
- Evaluation deadline.

Reschedule and cancellation dialogs require a reason, show notification impact, and refresh the Application timeline and assigned-person workspaces.

### Panel My Workspace

Show:

- Assigned interview list.
- Candidate summary and authorized CV access.
- Interview details and Evaluation deadline.
- Save Draft action.
- Submit Evaluation action.

### Evaluation form

Capture:

- One score from 1 through 5 per criterion.
- Read-only weighted-total preview.
- Recommendation.
- Strengths.
- Concerns.
- Confidential notes.

The score preview is for UX only; the response rendered after save/submit must use the total calculated by the server. Submission requires confirmation. Submitted evaluations become fully read-only and must not expose an edit or delete control.

## Hiring Manager UI

My Workspace includes a **Hiring Decisions** queue derived by the backend from openings where the caller is the Hiring Manager.

The Hiring Manager can:

- Compare Candidates for their own openings.
- Review aggregate scores.
- Review submitted recommendations and permitted evaluation summaries.
- Select or reject with the required decision input.

The Hiring Manager cannot:

- Access unrelated openings or Candidates.
- Modify any panel member's evaluation.
- Prepare, send, revise, or revoke an offer.
- Convert a Candidate to Employee.
- View compensation unless a separate permission explicitly authorizes it.

The comparison view must distinguish missing evaluations, incomplete required rounds, and completed results. It must not enable a decision when the server reports prerequisites are incomplete.

## Offer UI

### Offer composer

Capture:

- Role and organization snapshot.
- Reporting Manager.
- Employment type.
- Joining date.
- Compensation amount.
- Currency.
- Monthly or annual period.
- Probation days.
- Expiry date.
- Offer terms.

Use appropriate monetary/date controls and show a clear summary before send. Never log form values to browser analytics or error telemetry.

### Offer actions

- Preview offer.
- Send.
- Retry failed email delivery.
- Revoke.
- Create revised version.

Sent, accepted, declined, expired, revoked, and superseded versions are read-only. Revision starts from an authorized snapshot but creates a separate version. The history view shows version, status, timestamps, and safe delivery/response state.

Sending and revoking require confirmation and must display headcount-reservation impact from the server.

## Ready-to-Hire UI

Display a server-generated preflight checklist:

- Offer accepted.
- Position reserved.
- Candidate not already converted, or existing conversion identified.
- Candidate email available.
- Organization hierarchy active.
- Manager active.
- Published onboarding template resolved.
- User and Employee can be created.

Do not duplicate these rules in the browser. Render each server result as passed, blocked, or warning with an actionable explanation.

Conversion requires an explicit confirmation showing the Candidate, role, organization, joining date, and resolved onboarding template. Disable duplicate submission while the request is active, send the current version/idempotency data required by the API, and handle a repeated successful request by navigating to the existing Employee.

On success, redirect to Employee Detail with Career and Onboarding tabs available. If invitation email delivery later fails, show the Employee as created and provide the authorized retry action rather than presenting conversion as failed.

## Public Careers UI

### Careers listing

Show only public fields for open, non-expired positions:

- Company name and role.
- Branch/location.
- Employment type.
- Closing date.

Provide responsive cards/listing, public-safe filtering where approved, loading state, no-openings state, expired/closed behavior, and accessible links.

### Job detail and Application form

Capture:

- First and last name.
- Email.
- Mobile.
- Required CV.
- Up to five optional supporting documents.
- Cover note.
- Privacy acknowledgement.

Upload feedback must enforce the published client-side limits—PDF, DOC, or DOCX; 10 MB per file—while the server performs authoritative signature, MIME, checksum, and malware validation.

### Public protection and privacy

- Honeypot field.
- Rate-limit error handling with safe retry guidance.
- Production Turnstile integration.
- No disclosure of internal IDs.
- No disclosure that a Candidate/email already exists.
- No client telemetry containing CV names/content or sensitive form values.
- Clear privacy notice and retention link from approved content.

On submission, show a generic success receipt and next-step message. A retry must not accidentally create duplicate Applications.

## Public offer-response UI

- Validate the token with the server before showing offer content.
- Display role, organization, joining date, compensation, probation, expiry, and terms from the immutable offer version.
- Provide an authorized secure PDF download action.
- Require typed legal name and acknowledgement.
- Allow Accept or Decline; Decline uses a confirmation step.
- Disable controls while a response is being submitted.
- Disable repeated response after success.
- Show expired, revoked, superseded, invalid, and already-responded states safely.

Never persist the raw token in local storage, session storage, analytics, logs, or error reports. Avoid leaking it through third-party resources/referrers; apply the route's approved referrer policy and redact query parameters from telemetry.

## Employee UI changes

### Entry-point change

- Replace **Add Employee** with **Recruit Candidate** for normal HR users.
- Route the action to Recruitment/Opening or internal Candidate intake as approved by product UX.
- Redirect normal `/hr/employees/new` access to Recruitment.
- Keep the legacy direct-create screen inaccessible unless the caller is Platform Administrator and the backend feature flag is enabled.

### Existing Employee maintenance

Continue to support editing allowed personal information. Organization, Designation, and Manager changes use dedicated **Career Actions** for:

- Promotion.
- Transfer.
- Manager change.

Each action displays effective date and impact, requires the configured reason/details, and relies on the backend transition/audit rules.

### Career tab

Add a chronological Career tab containing applicable milestones:

- Application submitted.
- Interviews completed.
- Selected.
- Offer accepted.
- Employee created.
- Onboarding started and completed.
- Probation started and confirmed.
- Promotions.
- Transfers.
- Manager changes.
- Separation/exit.

Visibility rules:

- Authorized HR sees full recruitment history and confidential references only when permitted.
- Employee self-service sees sanitized milestone summaries only.
- Interview scores, recommendations, strengths, concerns, confidential notes, CVs, and compensation remain hidden from Employee self-service.

The UI renders the appropriate server projection; it must not download the HR timeline and hide fields in the browser.

## Onboarding and Probation UI integration

- Employee Detail shows the onboarding snapshot created during conversion.
- Onboarding task progress uses server state and current allowed actions.
- When required onboarding completes, refresh Employee status and Career timeline to show Probation.
- HR receives a Probation-due queue and can open the Employee confirmation action.
- Active confirmation displays planned end date, actual confirmation date, and required note/reference.
- The server rejects early or unauthorized confirmation; the UI presents the stable error and request reference.

## Frontend architecture

Create a dedicated Recruitment feature area containing:

- API service.
- Shared types matching backend enums and response contracts.
- Query-key factory.
- React Query hooks.
- Validation schemas.
- Tables and column definitions.
- Forms.
- Dialogs and sheets.
- Status badges.
- Timeline components.
- Permission-aware action components.

Use existing project patterns for:

- Workspace shell.
- KPI cards/grid.
- Data table.
- Lookup controls.
- Form dialogs/sheets.
- API error and request-reference handling.
- Toasts and query invalidation.

### Client-state rules

- Refresh server state after every transition.
- Include backend aggregate versions on mutating requests where required.
- Treat HTTP `409` as a stale state or invalid transition and refetch before another action.
- Keep filters in URL/search state where consistent with existing list pages.
- Do not optimistically display irreversible status transitions as complete before server confirmation.
- Do not copy backend state-machine logic into UI validation; use server preflight and allowed-action responses.

## UI implementation sequence

1. Lock generated/shared API types, enums, errors, permissions, query keys, and route map against the API document.
2. Add Recruitment navigation, route guards, feature shell, shared badges, and list primitives.
3. Build Opening list/editor, criteria editor, and publication checklist.
4. Build Candidate/Application lists, detail tabs, immutable timeline, and authorized transitions.
5. Build Interview calendar/scheduler and panel Evaluation workspace.
6. Build Hiring Manager decision workspace and Candidate comparison.
7. Build Offer composer/history and delivery actions.
8. Build public Careers listing/detail/Application pages and protected file upload.
9. Build secure public offer-response page.
10. Build Ready-to-Hire preflight/conversion UX and Employee redirect.
11. Replace normal Add Employee entry points and add Career/Probation UI.
12. Complete component, browser-persona, responsive, accessibility, security, and business UAT.

The frontend may develop against contract-accurate mocks after the API contract is locked, but production integration and end-to-end tests must use the real API.

## UI tests

### Component tests

- Opening publication validation rendering.
- Criteria weight total and published read-only behavior.
- Permission-based navigation and action visibility.
- Interview Evaluation draft and submit behavior.
- Submitted Evaluation read-only behavior.
- Offer composer validation and immutable version display.
- Conversion preflight rendering and blocker handling.
- Public Application upload type/count/size validation.
- Offer token state rendering.
- Confidential HR versus sanitized Employee timeline rendering.

### Playwright personas

1. HR creates and publishes an Opening.
2. A public Candidate applies.
3. HR screens the Application and schedules required interviews.
4. An assigned panel member saves and submits an Evaluation.
5. The Hiring Manager reviews and selects the Candidate.
6. HR prepares and sends the Offer.
7. The Candidate securely accepts the Offer.
8. HR passes preflight and converts the Candidate.
9. The Employee accepts the account invitation.
10. The Employee sees assigned onboarding.
11. Required onboarding completion starts Probation.
12. HR confirms the Employee as Active after the probation end date.

Also test:

- Unauthorized direct URLs and hidden actions.
- Cross-tenant identifiers.
- Unrelated manager/panel access.
- Expired, revoked, superseded, and replayed offer tokens.
- Duplicate/retried public Application submission.
- Concurrent/retried conversion response.
- Mobile and tablet layouts.
- Keyboard order, focus trapping/restoration, labels, and screen-reader status announcements.
- Loading, empty, partial, stale, and failure states.
- File-upload validation, malware rejection, and network interruption.
- Email-delivery failure and retry state.
- Browser refresh/deep link at every major status.

## UI release gates

- TypeScript passes.
- ESLint passes.
- Production build passes.
- Component tests pass.
- Integrated Playwright personas pass against the release API/database.
- Responsive and accessibility review passes.
- No console, hydration, uncaught-promise, or sensitive-telemetry errors.
- Authorization/security checks confirm that hidden data is absent from API responses, page source, cache, and browser logs.
- Product/HR validates wording, ownership, status names, rejection reasons, offer content, and privacy notice.
- The client signs off the complete Recruitment-to-Active flow.

## Frontend rollout

- Keep internal Recruitment and public Careers behind separate feature flags, both disabled by default.
- Deploy route code and navigation safely before exposing it to normal users.
- Enable internal HR, panel, and Hiring Manager personas for the pilot Opening.
- Run the complete pilot through conversion, onboarding, probation, and Active confirmation.
- Enable public Careers only after API, storage, malware scan, email, privacy, rate-limit, Turnstile, and public security checks pass.
- Monitor API errors, stale conflicts, upload failures, email-delivery failures, abandonment, and conversion blockers without collecting confidential payloads.
- Retain an approved rollback method that disables entry points without corrupting already-created workflow records.

## Production acceptance criteria

The UI is production-ready only when every authorized persona can complete its part of the end-to-end workflow without direct Employee creation or manual database intervention, unauthorized personas cannot view or invoke unrelated actions, confidential information never appears in Employee/public projections, and every UI release gate and client UAT scenario passes against the production-candidate API contract.

