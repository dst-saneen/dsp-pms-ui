# Recruitment Flow and Durable Delivery Implementation Plan

## 1. Purpose and status

This document is the authoritative implementation plan for Developer 1. It combines the Recruitment-flow improvements that belong to the communications workstream with the shared production email and in-app notification foundation.

This is a plan, not evidence that the described code, migration, external provider configuration, or production acceptance has been completed. Current passing unit or mock tests must not be presented as real ZeptoMail, PostgreSQL, API, or browser evidence.

The plan incorporates these approved walkthrough suggestions:

- Add a real Shortlist stage before Screening.
- Make Applications and Candidates the main Recruitment navigation.
- Keep Interview and Offer pages available for deep links and operational use, but remove them from the primary menu.
- Send interview panel members email as well as in-app notifications.

The following suggestions are deliberately outside this workstream:

- Microsoft Teams/Outlook calendar creation is deferred.
- Signed-offer upload and HR verification are owned by Developer 2 and specified in `secure-documents-and-signed-offer-implementation-plan.md`.
- External e-signature integration is deferred.

## 2. Locked product decisions

- `SHORTLISTED` is a persisted `JobApplicationStatus`, not a secondary Boolean flag.
- New applications must be shortlisted before Screening.
- Existing applications already in Screening or a later state remain valid and are not moved backwards.
- Applications and Candidates are the primary HR entry points.
- Existing Interview and Offer routes remain available; only their primary navigation entries are hidden.
- ZeptoMail REST Email API is the primary production email provider.
- ZeptoMail webhooks reconcile provider delivery and bounce results.
- The existing `OutboxEvent` remains the durable business-event source.
- Email delivery and in-app delivery are separate recipient/channel records so one channel cannot cause the other to be repeated.
- Candidate and internal-recipient resolution always reloads authoritative tenant data; payload recipient IDs are never trusted by themselves.
- Email open and click tracking are disabled by default. Offer acceptance and other business actions are tracked by HRMS itself.
- Employee invitations are sent asynchronously after conversion commits; a mail-provider failure must not roll back or partially recreate the Employee.
- Actionable Onboarding events use email plus in-app delivery. Routine status events use in-app delivery only.

## 3. Developer ownership and integration boundary

Developer 1 owns:

- Recruitment Shortlist state, commands, filtering, history and UI.
- Application-centric navigation and replacement filters.
- Candidate transactional emails.
- Interview candidate and panel email/in-app notifications.
- Offer-link delivery and delivery-state visibility.
- Employee invitation delivery.
- Onboarding task email/in-app notifications.
- Delivery fan-out, attempts, retry, reconciliation, suppression, dead-letter handling and monitoring.
- Company/Branch/Department-safe recipient resolution.

Developer 1 must not:

- Store document binaries or storage-provider credentials.
- Implement signed-offer verification state.
- Call the secure-file module through an HTTP controller from backend code.
- Generate a new offer or invitation token merely because a delivery attempt is retried.
- Add Teams/Graph integration in this release.

Developer 2 will emit signed-offer events through `OutboxEvent`. Developer 1 maps those events to email/in-app delivery. The agreed event payload contains only safe IDs, statuses and dates.

## 4. Recruitment Shortlist contract

### 4.1 Database changes

Add `SHORTLISTED` to `JobApplicationStatus`.

Add to `JobApplication`:

```prisma
shortlistedAt DateTime?
```

Continue using:

- `JobApplication.version` as the optimistic concurrency token.
- `JobApplicationStatusHistory` for `fromStatus`, `toStatus`, actor, reason, comment, request and correlation evidence.

Add an index supporting the new queue through the existing Job Opening relationship and Application status. If the query plan cannot use `job_applications(jobOpeningId, status)`, add the smallest additional Company/Branch-scoped index demonstrated by the real query plan rather than duplicating indexes speculatively.

### 4.2 State machine

The enabled V2 transition matrix is:

```text
APPLIED
├── SHORTLISTED
├── REJECTED
└── WITHDRAWN

SHORTLISTED
├── SCREENING
├── REJECTED
└── WITHDRAWN
```

Rules:

- `APPLIED -> SCREENING` is rejected after the feature is enabled for that Company/Branch.
- `shortlistedAt` is set only on the first successful transition to `SHORTLISTED` and is never supplied by the client.
- Rejection and withdrawal remain terminal under the existing state machine.
- No existing Screening, Interview, Manager Review, Selected, Offer or Hired row is back-migrated to Shortlisted.
- Every transition writes `JobApplicationStatusHistory`, AuditLog and any required outbox events in the same transaction.

### 4.3 Commands

```http
POST /job-applications/:id/shortlist
POST /job-applications/:id/start-screening
POST /job-applications/:id/reject
```

Shortlist request:

```ts
interface ShortlistApplicationRequest {
  expectedVersion: number;
  operationId: string;
  comment?: string;
}
```

Start Screening request:

```ts
interface StartScreeningRequest {
  expectedVersion: number;
  operationId: string;
  comment?: string;
}
```

Reject continues to require a reason code and accepts an optional comment. All commands follow this sequence:

1. Resolve the authenticated Company/Branch scope.
2. Claim or replay `operationId`.
3. Read the Application through its Job Opening tenant chain and return safe `404` for a foreign direct ID.
4. Lock the Application.
5. Validate expected version and current state.
6. Apply the transition and increment version.
7. Write status history, audit and outbox evidence.
8. Commit and return the refreshed projection.

Stable errors:

```text
APPLICATION_NOT_FOUND
APPLICATION_STATE_CHANGED
APPLICATION_VERSION_CONFLICT
APPLICATION_NOT_SHORTLISTED
OPERATION_ID_REUSED
```

## 5. Durable delivery database contract

Keep `OutboxEvent` as the transactionally-created domain event. Do not treat an Outbox row as a recipient/channel attempt. Add the following dedicated models.

### 5.1 Enums

```text
DeliveryChannel:
EMAIL
IN_APP

DeliveryRecipientKind:
EXTERNAL_EMAIL
USER

DeliveryProvider:
ZEPTOMAIL
INTERNAL

DeliveryMessageStatus:
QUEUED
PROCESSING
ACCEPTED
DELIVERED
RETRY_WAIT
RECONCILING
BOUNCED_SOFT
BOUNCED_HARD
COMPLAINED
DEAD_LETTER
CANCELLED
BYPASSED

DeliveryAttemptOutcome:
ACCEPTED
DELIVERED
TRANSIENT_FAILURE
PERMANENT_FAILURE
AMBIGUOUS
BYPASSED
```

### 5.2 `DeliveryMessage`

Required fields:

- `id`, `version`.
- `companyGroupId`, `companyId`, `branchId` snapshots where applicable.
- `aggregateType`, `aggregateId`, `eventType`.
- `channel`, `recipientKind`, `provider`.
- `recipientUserId` and `recipientEmployeeId` for internal recipients.
- encrypted recipient address and normalized recipient-address HMAC for email.
- `templateKey`, immutable `templateVersion`.
- encrypted subject/body snapshot and encryption-key version.
- deterministic, globally unique `dedupeKey`.
- `clientReference`; use the Delivery Message ID.
- `providerRequestId` and provider email reference when returned.
- status, `attemptCount`, `nextAttemptAt`, lock fields and optimistic version.
- queued, accepted, delivered, terminal and dead-letter timestamps.
- safe `lastErrorClass` and `lastErrorCode`.
- creation/update timestamps.

Checks:

- An `EMAIL` message requires encrypted address, subject and body plus an address HMAC.
- An `IN_APP` message requires `recipientUserId` and must not store an email body.
- Provider must match the channel.
- Terminal statuses require a terminal timestamp.
- Delivered status requires `deliveredAt`.
- Encrypted fields require a recognized encryption-key version.
- Current recipient pointers may be nullable only where the external recipient is represented by encrypted email.

Indexes:

- `(status, nextAttemptAt)` for workers.
- `(companyId, branchId, createdAt)` for scoped monitoring.
- `(aggregateType, aggregateId, createdAt)`.
- `(recipientUserId, createdAt)`.
- `(eventType, status, createdAt)`.

### 5.3 `DeliveryAttempt`

Fields:

- Delivery Message ID and attempt number.
- provider, request/client references.
- outcome and HTTP/provider status.
- safe error class/code.
- started/completed timestamps.
- worker correlation ID.

Constraints:

- Unique `(deliveryMessageId, attemptNo)`.
- Attempt number is positive.
- Attempt rows are append-only.
- No email body, offer token, invitation token or signed URL is stored.

### 5.4 `DeliveryProviderEvent`

Fields:

- provider.
- provider event ID when supplied.
- fallback digest of the versioned canonical webhook payload.
- client reference and provider email reference.
- normalized provider event type.
- webhook signature timestamp.
- encrypted raw payload and encryption-key version.
- received, processed and failed timestamps.
- safe processing error.

Constraints:

- Unique provider event ID when present.
- Unique fallback digest when an ID is absent.
- One webhook receipt can update a Delivery Message only after tenant-neutral correlation through its stored provider/client reference.

### 5.5 `EmailSuppression`

Fields:

- Company ID and normalized address HMAC.
- reason: `HARD_BOUNCE`, `COMPLAINT` or `MANUAL`.
- source Delivery Message/provider event.
- suppressed and released actor/timestamps.
- release reason and optimistic version.

Add a partial unique index for one active suppression per Company/address. A soft bounce does not create a permanent suppression.

### 5.6 `DeliveryCommandReceipt`

Use the established command-receipt pattern:

- Company, operation ID, command type and actor.
- versioned canonical-request HMAC and HMAC-key version.
- safe response snapshot.
- unique `(companyId, operationId)`.

Retry, cancel and suppression-release commands must be idempotent.

## 6. Delivery processing and provider contract

### 6.1 Transaction and fan-out

```text
Business transaction
  -> OutboxEvent
  -> scoped recipient resolution
  -> one DeliveryMessage per recipient and channel
  -> channel worker
  -> DeliveryAttempt
  -> provider webhook reconciliation
```

The fan-out worker must:

1. Claim the Outbox row through the existing lock/retry mechanism.
2. Reload the authoritative aggregate.
3. Verify the event tenant snapshot matches the aggregate.
4. Resolve recipients using server data and permissions.
5. Create deterministic channel-specific Delivery Messages.
6. Mark expansion complete only after every intended message exists.

A candidate email failure must not cause an already-created in-app notification to be recreated. A failed in-app recipient must not cause a candidate email to be resent.

### 6.2 ZeptoMail adapter

Use `POST https://api.zeptomail.com/v1.1/email` with:

- a server-side send-mail token;
- a verified sender address;
- `DeliveryMessage.id` as `client_reference`;
- `track_opens=false`;
- `track_clicks=false`.

Store the returned request ID and provider references. API acceptance maps to `ACCEPTED`, not `DELIVERED`.

ZeptoMail documents `client_reference` and `request_id` in its [Email API](https://www.zoho.com/zeptomail/help/api/email-sending.html). Its [webhook guide](https://www.zoho.com/zeptomail/help/webhooks.html) defines a `producer-signature` using HMAC-SHA256. Implementation must follow the currently published provider documentation and record the provider configuration used for UAT.

### 6.3 Webhook

```http
POST /webhooks/zeptomail
```

Rules:

- Preserve and verify the raw request bytes.
- Parse and validate signature timestamp, signature and algorithm.
- Reject signatures outside the configured replay window.
- Persist the idempotent provider event before returning success.
- Do not accept a Company, Branch or User scope from the webhook request.
- Process delivered, soft bounce, hard bounce and feedback-loop events.
- Ignore open/click events unless a later approved privacy decision enables them.
- Handle duplicate and out-of-order events deterministically.

### 6.4 Retry and dead letters

Provider-call policy:

- Initial call plus retries after 1 minute, 5 minutes, 15 minutes, 1 hour, 6 hours and 24 hours.
- Retry connection/network failures, HTTP 408/429 and 5xx.
- Treat other 4xx errors as permanent unless a documented ZeptoMail code mapping says otherwise.
- An ambiguous timeout enters `RECONCILING`; do not immediately resend.
- External email is at-least-once. Internal dedupe prevents repeated domain commands, but provider ambiguity can still result in a duplicate copy of the same message.
- After attempts are exhausted, set `DEAD_LETTER` and create an operations alert.

Manual retry:

- Requires an allowed action, expected version, operation ID and reason.
- Reuses the immutable Delivery Message and same still-valid action link.
- Is blocked for hard-bounced/complained addresses until suppression is released.
- Cannot revive an expired offer/invitation token; use the domain regeneration command instead.

## 7. Event and recipient matrix

### 7.1 Candidate events

Email:

- Application received.
- Interview scheduled, rescheduled and cancelled.
- Interview reminder.
- Offer sent and approved reminder.
- Signed-offer resubmission request from Developer 2's event.
- Employee invitation.

Candidate email must be loaded from the scoped Candidate/Application relationship. Fix the current interview event construction so a scheduled/rescheduled/cancelled interview always correlates to its persisted Application and Candidate.

### 7.2 Interview panel

Email plus in-app:

- Interview scheduled, rescheduled and cancelled.
- Evaluation due and overdue.

Recipients come from persisted `InterviewPanelMember` rows. Each recipient must be:

- an active Employee;
- linked to an active User;
- in the same Company and Branch as the Application/Opening;
- still assigned to the Interview.

External panel email addresses and Teams/Outlook calendar events are not part of this release.

### 7.3 Offer and HR events

- Candidate receives the secure offer-response link.
- Authorized HR receives in-app delivery-failure, hard-bounce and dead-letter exceptions.
- `OFFER_SIGNATURE_SUBMITTED`, `OFFER_SIGNATURE_VERIFIED`, `OFFER_SIGNATURE_REJECTED` and `OFFER_SIGNATURE_RESUBMISSION_REQUESTED` are produced by Developer 2.
- The outbox contains safe IDs, never a plaintext response token.

### 7.4 Employee invitation

Recruitment conversion must commit Employee, User invitation and OutboxEvent in one transaction. Delivery occurs asynchronously. Retry of the conversion returns the same Employee/invitation/onboarding state and repairs missing delivery work rather than creating another Employee or invitation.

### 7.5 Onboarding

Email plus in-app:

- Assignment.
- Reassignment.
- Due soon.
- Overdue.

In-app only:

- Task completed.
- Task waived.
- Onboarding completed or cancelled.

Resolve personal notifications from the task's authoritative current assignee. Resolve Department notifications from active same-Department users with the exact onboarding permission. Correct any singular/plural recipient payload mismatch rather than expanding arbitrary payload IDs.

## 8. Company/Branch/Department-safe recipient resolution

- Candidate recipient: reload Candidate through Application and Job Opening scope.
- Panel recipient: reload Interview, Application, panel Employee and User.
- Invitation recipient: reload Employee/UserInvitation through Company/Branch scope.
- Onboarding assignee: reload task and current assignee.
- Department recipient: active Employee plus exact Company, Branch, Department and permission.
- HR exception recipient: exact RoleAssignment scope.

RoleAssignment matching:

- `GROUP`: same Company Group.
- `COMPANY`: same Company.
- `BRANCH`: same Branch.
- Department work: additionally the actor's active Employee Department must match.
- `GLOBAL`: explicitly authorized platform operations only.

Never use a loose Company-or-Branch `OR` query. If intended recipients cannot be safely resolved, create a redacted resolution exception and operations alert; do not broaden the query.

## 9. Public and operations APIs

### 9.1 Monitoring

```http
GET /delivery/messages
GET /delivery/messages/:id
GET /delivery/messages/:id/attempts
GET /delivery/dead-letters
GET /delivery/health
```

List queries use repository-standard pagination:

```ts
interface DeliveryMessageQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: DeliveryMessageStatus;
  channel?: DeliveryChannel;
  eventType?: string;
  companyId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "nextAttemptAt" | "deliveredAt" | "status";
  sortOrder?: "asc" | "desc";
}
```

Response shape:

```ts
interface PagedDeliveryMessages {
  items: DeliveryMessageSummary[];
  total: number;
  page: number;
  limit: number;
}
```

### 9.2 Commands

```http
POST /delivery/messages/:id/retry
POST /delivery/messages/:id/cancel
GET  /delivery/suppressions
POST /delivery/suppressions/:id/release
```

Command body:

```ts
interface DeliveryOperatorCommand {
  expectedVersion: number;
  operationId: string;
  reason: string;
}
```

### 9.3 Projection

```ts
type DeliveryAllowedAction = "RETRY" | "CANCEL" | "RELEASE_SUPPRESSION";

interface DeliveryMessageSummary {
  id: string;
  version: number;
  eventType: string;
  channel: "EMAIL" | "IN_APP";
  status: string;
  redactedRecipient: string;
  aggregate: { type: string; id: string };
  provider: string;
  attemptCount: number;
  queuedAt: string;
  nextAttemptAt: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  terminalAt: string | null;
  lastError: { code: string; classification: string } | null;
  allowedActions: DeliveryAllowedAction[];
}
```

Never return rendered bodies, raw recipient addresses, provider tokens or secure action URLs.

### 9.4 Permissions

Add and seed:

- `platform.delivery.read`
- `platform.delivery.retry`
- `hr.recruitment.delivery.read`
- `hr.recruitment.delivery.retry`

HR access is Company/Branch scoped. Platform global access is restricted to platform operations roles.

## 10. Frontend implementation

### 10.1 Application-centric navigation

Primary Recruitment menu:

```text
Recruitment
├── Dashboard
├── Applications
└── Candidates
```

Hide the Interview and Offer menu entries, but retain their routes for deep links, existing bookmarks, notification targets and operational use.

Application filters:

- Applied.
- Shortlisted.
- Screening.
- Has scheduled interview.
- Interview date range.
- Offer sent.
- Offer accepted with signature verification pending.
- Ready to hire.
- Rejected/withdrawn.

Application list actions:

- APPLIED row: Shortlist or Reject.
- SHORTLISTED row: Start Screening or Reject.
- Actions are rendered only from the backend projection's `allowedActions`.
- Every mutation sends `expectedVersion` and `operationId` and refetches the row/list/detail.

Application detail remains the primary place for Interview, Evaluation, Offer, signed-offer verification status and Ready-to-Hire work.

### 10.2 Delivery monitoring UI

Routes:

```text
/hr/recruitment/delivery
/hr/recruitment/delivery/[id]
/admin/operations/delivery
```

Views:

- Scoped delivery list.
- Dead-letter queue.
- Hard-bounce/complaint suppression list.
- Attempt timeline.
- Provider reconciliation status.
- Safe aggregate deep link.

Rules:

- Redact email addresses.
- Never display message body, token or provider credentials.
- Render commands only from `allowedActions`.
- Retry/release dialogs require a reason.
- On 409 preserve input, refetch and ask the user to review current state.
- On 403 refetch permissions and close the forbidden action.
- On 5xx preserve input and show retry; never display a false success.

## 11. Migration and rollout

Use expand -> backfill/reconcile -> contract.

### Expand

- Add `SHORTLISTED`, `shortlistedAt`, delivery enums/tables, constraints and permissions.
- Deploy with delivery and Shortlist feature flags off.
- Preserve existing SMTP behavior only as a controlled compatibility path.

Flags:

- `RECRUITMENT_SHORTLIST_ENABLED`
- `DELIVERY_V2_ENABLED`
- server-side Company/Branch allowlist
- `ZEPTOMAIL_WEBHOOK_ENABLED`

### Backfill/reconcile

- Do not change legacy Application statuses.
- Backfill new delivery history only where existing Recruitment attempts correlate reliably.
- Reconcile pending, unexpired invitation and offer deliveries without generating new tokens.
- Report delivery attempts without an Application/Candidate/Offer.
- Report Interview events without a Candidate resolution.
- Report panel members without active Users or valid tenant membership.
- Report hard-bounced addresses still used by active Candidates/Employees.

### Contract and activation

- Enable Shortlist only after UI/API transition tests pass.
- Enable delivery expansion in dry-run/bypassed mode first to verify recipients without sending duplicates.
- Pilot one approved Company/Branch with real ZeptoMail evidence.
- Disable synchronous invitation and old direct email paths only after delivery V2 acceptance.
- A mixed Company Group context must require selection of a uniformly enabled Company/Branch.

## 12. Test and acceptance plan

Backend unit/service tests:

- Shortlist transition matrix and status history.
- `allowedActions` for Application and delivery commands.
- Candidate, panel, invitation, HR and Onboarding recipient resolution.
- tenant/role/Department permission intersection.
- dedupe, retry classification, suppression and webhook normalization.

Real PostgreSQL integration/concurrency:

- concurrent Shortlist versus Reject.
- repeat idempotent Shortlist.
- Outbox fan-out claimed by multiple workers.
- duplicate message creation.
- retry versus webhook arrival.
- out-of-order and duplicate webhooks.
- suppression release versus new hard bounce.
- invitation recovery without duplicate Employee/UserInvitation.

Real API/browser personas:

1. HR Recruitment user shortlists and starts Screening.
2. Unauthorized Branch user cannot see or mutate the Application.
3. Candidate receives application/interview/offer email.
4. Panel Employee receives email and in-app Interview notification.
5. Removed/inactive panel member receives nothing.
6. HR sees a scoped delivery failure and retries when allowed.
7. Global operations user sees dead letters without message-body/token exposure.
8. Employee receives one durable invitation after conversion.
9. Onboarding assignee receives the approved channel combination.
10. Another Department/Company receives no task notification.

External/runtime evidence:

- Real ZeptoMail API acceptance.
- Real signed delivered and bounce webhooks.
- Sender/domain verification.
- Secret rotation and secret-manager configuration.
- Queue/dead-letter monitoring and alerts.
- No mock-mode claim as production evidence.

Production acceptance requires zero cross-tenant recipient leakage, deterministic Shortlist transitions, recoverable offer/invitation delivery, working suppression/dead-letter operations, real provider evidence, migration rehearsal, backup/restore evidence and business sign-off on the recorded release commit.
