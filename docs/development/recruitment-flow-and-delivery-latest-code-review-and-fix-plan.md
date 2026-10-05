# Recruitment Flow and Delivery — Latest Code Review and Production Fix Plan

**Repository:** C:\DataScape\HRMS\ERP  
**Reviewed commit:** 0f36441  
**Review date:** 2026-08-20  
**Authoritative source:** recruitment-flow-and-delivery-implementation-plan.md  
**Scope:** Recruitment shortlist flow, durable email/in-app delivery, ZeptoMail integration, employee invitation delivery, Onboarding notifications, operations APIs, and Delivery UI.

This document records current implementation evidence and the exact remediation contract. It does not cover the separate secure-document and signed-offer implementation except where that code affects compilation or delivery links.

## 1. Current verdict

**Production status: NO-GO.**

The shortlist state and a Delivery V2 foundation have been implemented, the Prisma schema validates, builds pass, and all 113 migrations are applied to dsp_erp_dev / dsp_pms. The feature is not production-ready because:

- Delivery workers have no runtime scheduler.
- Delivery V2 fan-out and legacy direct delivery can both execute.
- ZeptoMail API acceptance is incorrectly recorded as final delivery.
- The webhook route and signature verification do not match the provider contract.
- recipient resolution trusts payload identifiers and uses unsafe scope matching.
- delivery addresses, subjects, and provider payloads are stored in plaintext.
- employee invitation remains synchronous after Recruitment conversion.
- Onboarding notification routing does not match the payload shape.
- versioned command, API response, and UI allowed-action contracts are incomplete.
- real PostgreSQL concurrency, real API/browser personas, and real ZeptoMail evidence are absent.

Keep DELIVERY_V2_ENABLED disabled until every P0 gate in this document passes.

## 2. Verified evidence

| Gate | Result | Evidence/qualification |
|---|---|---|
| Working tree | PASS | Clean after review; no source changes made by the review |
| Prisma validation | PASS | Current schema is valid |
| Migration status | PASS | 113 migrations; database schema is up to date |
| Delivery migrations applied | YES | Shortlist, Delivery V2 foundation, and delivery permissions are present in the applied schema |
| Backend TypeScript | PASS | Passed after regenerating the stale local Prisma client |
| Frontend TypeScript | PASS | No-output TypeScript check passed |
| Backend build | PASS | Nest production compilation passed |
| Frontend build | PASS | Next production build passed |
| Focused backend tests | PASS WITH LIMITATION | 6 suites / 55 tests; mocked services and mocked Prisma |
| Frontend tests | PASS WITH LIMITATION | 18 files / 38 tests; no Delivery UI component coverage |
| PostgreSQL Delivery test | PASS WITH LIMITATION | 4 read-only schema/permission checks; no write or concurrency flow |
| Live Delivery rows | NO EVIDENCE | 0 messages, 0 attempts, 0 provider events, 0 suppressions, 0 receipts |
| Backend lint | FAIL | 894 repository errors; 173 errors in the focused Recruitment/Delivery set |
| Frontend lint | FAIL | 14 errors and 11 warnings |
| Playwright acceptance | FAIL/ABSENT | Playwright forces Recruitment mock mode |
| Real ZeptoMail acceptance/webhook | ABSENT | No recorded API acceptance, delivered webhook, or bounce webhook |

Passing builds and mock tests are useful engineering checks but are not production acceptance.

## 3. Immutable migration rule

The following migration has already been applied and must not be edited, renamed, deleted, or checksum-repaired:

- 20260819163801_delivery_v2_foundation

The permission migration must also remain immutable:

- 20260820110000_delivery_permissions

All database fixes must use new additive migrations. Use expand, reconcile/backfill, and contract migrations so another environment containing Delivery rows can upgrade safely.

Recommended new migrations:

1. 20260820xxxx_delivery_v2_production_expand
2. 20260820xxxx_delivery_v2_production_backfill
3. 20260820xxxx_delivery_v2_production_contract

Do not drop or overwrite plaintext compatibility columns until every deployed application instance reads the encrypted canonical fields and the reconciliation report is clean.

## 4. P0 remediation sequence

### Gate P0.1 — Contain the incomplete runtime

Before changing behavior:

- Keep DELIVERY_V2_ENABLED=false by default.
- Add a server-side Company/Branch allowlist for pilot activation.
- Reject mixed Company Group contexts unless a single uniformly-enabled Company/Branch is selected.
- Add startup validation that fails closed when Delivery V2 is enabled without:
  - ZeptoMail send token;
  - verified from address/name;
  - webhook authentication key;
  - delivery encryption keys;
  - address-HMAC keys;
  - command-receipt HMAC keys;
  - worker lease and batch configuration.
- Do not instantiate a mandatory ZeptoMail provider when Delivery V2 and all ZeptoMail-backed paths are disabled.
- Expose the resolved Delivery mode in an authenticated health endpoint without exposing secrets.

Exit gate:

- Flag off preserves the legacy route.
- Flag on for an allowed Company/Branch uses only Delivery V2.
- No request flag can override the server-side scope decision.

### Gate P0.2 — Add the canonical database contract

#### 4.2.1 Canonical enums

Create new enum types rather than trying to reinterpret existing values silently.

DeliveryRecipientKind:

- EXTERNAL_EMAIL
- USER

DeliveryProvider:

- ZEPTOMAIL
- INTERNAL

DeliveryMessageStatus:

- QUEUED
- PROCESSING
- ACCEPTED
- DELIVERED
- RETRY_WAIT
- RECONCILING
- BOUNCED_SOFT
- BOUNCED_HARD
- COMPLAINED
- DEAD_LETTER
- CANCELLED
- BYPASSED

DeliveryAttemptOutcome:

- ACCEPTED
- DELIVERED
- TRANSIENT_FAILURE
- PERMANENT_FAILURE
- AMBIGUOUS
- BYPASSED

Do not map legacy FAILED or SENDING automatically without checking the corresponding attempts and provider events. Ambiguous legacy rows must appear in the reconciliation report.

#### 4.2.2 DeliveryMessage

Add and make canonical:

- id and optimistic version;
- companyGroupId, companyId, branchId snapshots;
- aggregateType, aggregateId, eventType, outboxEventId;
- channel, recipientKind, provider;
- recipientUserId and recipientEmployeeId for internal recipients;
- recipientAddressCiphertext, recipientAddressNonce, recipientAddressAuthTag;
- recipientAddressKeyVersion;
- recipientAddressHmac and recipientAddressHmacKeyVersion;
- templateKey and immutable templateVersion;
- subjectCiphertext, bodyTextCiphertext, bodyHtmlCiphertext;
- contentNonce/auth tags or a versioned authenticated-encryption envelope;
- contentKeyVersion;
- clientReference, always equal to DeliveryMessage.id;
- providerRequestId and providerEmailReference;
- status, attemptCount, nextAttemptAt;
- lockedBy, lockedAt and lockExpiresAt;
- queuedAt, acceptedAt, deliveredAt, terminalAt and deadLetteredAt;
- lastErrorClass and lastErrorCode;
- createdAt and updatedAt.

Required checks:

- EMAIL requires encrypted recipient, subject and at least one encrypted body.
- EMAIL requires address HMAC and recognized key versions.
- IN_APP requires recipientUserId and forbids email-content columns.
- ZEPTOMAIL is valid only for EMAIL.
- INTERNAL is valid only for IN_APP.
- PROCESSING requires an active lease.
- ACCEPTED requires acceptedAt and provider request/reference data.
- DELIVERED requires deliveredAt and terminalAt.
- BOUNCED_HARD, COMPLAINED, DEAD_LETTER, CANCELLED and BYPASSED require terminalAt.
- attemptCount is non-negative.
- clientReference is non-null and unique.

Required Company-qualified foreign keys:

- Company Group, Company and Branch snapshots;
- recipient User and Employee;
- OutboxEvent where it remains retained;
- actor/evidence references in command receipts.

Use Restrict for historical tenant, recipient, message, attempt, suppression, and actor evidence. Do not cascade-delete delivery history.

Required indexes:

- status + nextAttemptAt;
- status + lockExpiresAt;
- companyId + branchId + createdAt;
- aggregateType + aggregateId + createdAt;
- recipientUserId + createdAt;
- eventType + status + createdAt;
- providerEmailReference;
- unique clientReference;
- unique dedupeKey.

#### 4.2.3 DeliveryAttempt

Add:

- provider;
- clientReference and provider request/reference;
- startedAt and completedAt;
- workerCorrelationId;
- safe error class/code;
- canonical outcome.

Backstops:

- unique deliveryMessageId + attemptNo;
- attemptNo greater than zero;
- completedAt not earlier than startedAt;
- append-only trigger preventing UPDATE and DELETE;
- no email address, body, offer token, invitation token, or signed URL.

#### 4.2.4 DeliveryProviderEvent

Add:

- providerEventId when supplied;
- canonicalPayloadDigest and hash-format version;
- clientReference and providerEmailReference;
- normalized event type;
- signature timestamp and algorithm;
- encryptedPayload, nonce/auth tag and key version;
- receivedAt, processedAt, failedAt;
- safe processing error code.

Backstops:

- partial unique provider + providerEventId when non-null;
- unique provider + canonicalPayloadDigest when providerEventId is absent;
- exactly one canonical correlation path;
- processing cannot change another Company's message because tenant context is taken only from the correlated DeliveryMessage.

#### 4.2.5 EmailSuppression

Change the authority boundary from Company Group to Company.

Add:

- companyId;
- addressHmac and addressHmacKeyVersion;
- reason;
- source DeliveryMessage and ProviderEvent;
- suppressedAt, suppressedByUserId;
- releasedAt, releasedByUserId and releaseReason;
- optimistic version.

Add a partial unique index for one active suppression per companyId + addressHmac where releasedAt is null.

Do not use the webhook secret as the address-HMAC key. Use a separate versioned key domain and fail startup when an accepted key version is unavailable.

#### 4.2.6 DeliveryCommandReceipt

Add:

- companyId;
- operationId;
- commandType;
- actorUserId;
- requestHash, requestHashKeyVersion and requestHashFormatVersion;
- safe response snapshot;
- createdAt.

Make companyId + operationId unique.

Canonical request hashing:

- build a command-specific object after DTO normalization;
- preserve explicit null and omit absent fields;
- normalize UUID, date, number and string representations;
- serialize with stable sorted keys;
- compute HMAC-SHA-256 with a dedicated idempotency key;
- replay using the key and format version stored on the receipt.

Never return a receipt snapshot without rechecking current permission, tenant scope, and sensitive-field permission.

### Gate P0.3 — Reconcile existing Delivery rows

The reviewed development database currently has zero rows, but the migration must support environments that do not.

Generate a preflight report containing:

- messages with plaintext address/subject but missing encrypted snapshots;
- messages missing Company or Branch snapshots;
- duplicate client references or dedupe keys;
- SENDING rows without an active lease;
- FAILED rows without a deterministic retry/terminal classification;
- DELIVERED rows without a provider delivered event;
- duplicate attempt numbers;
- provider events without message correlation;
- duplicate provider event IDs/digests;
- Company Group suppressions without a deterministic Company mapping;
- command receipts without Company or actor evidence.

Mapping rules:

- QUEUED maps to QUEUED.
- SENDING maps to PROCESSING only with a valid new lease; otherwise RETRY_WAIT.
- DELIVERED maps to DELIVERED only when supported by a provider delivered event. Otherwise map to ACCEPTED or RECONCILING after manual review.
- FAILED maps to RETRY_WAIT, DEAD_LETTER or RECONCILING from attempt evidence; never guess.
- DEAD_LETTER, BYPASSED and CANCELLED retain their terminal meaning.
- CANDIDATE email becomes EXTERNAL_EMAIL.
- internal IN_APP recipients become USER after a scoped User lookup.
- IN_APP_STORE becomes INTERNAL.
- existing ACCEPTED attempts remain ACCEPTED.
- TIMEOUT becomes AMBIGUOUS.
- transient/network outcomes become TRANSIENT_FAILURE.
- permanent rejection becomes PERMANENT_FAILURE.

Encrypt legacy address/subject values using the active key version, then null the plaintext columns only after application cutover and verification.

Stop the contract migration when any ambiguous or cross-tenant row remains.

### Gate P0.4 — Implement a real worker host

Add a DeliveryJobsScheduler or dedicated worker process that invokes both workers when:

- workforce/background jobs are enabled;
- Delivery V2 is enabled;
- the message Company/Branch is in the server allowlist.

Claiming algorithm:

1. Select eligible IDs in deterministic order with FOR UPDATE SKIP LOCKED.
2. Change QUEUED or RETRY_WAIT to PROCESSING.
3. Set lockedBy, lockedAt and lockExpiresAt.
4. Increment the optimistic version.
5. Commit the claim before the provider call.
6. Process each claimed message with a stable worker-correlation ID.

Recovery:

- a sweeper returns expired PROCESSING leases to RETRY_WAIT or RECONCILING;
- it never blindly resends an attempt that may have been accepted;
- provider log reconciliation is attempted before resending ambiguous email.

Canonical lock order:

1. command receipt when applicable;
2. DeliveryMessage;
3. active EmailSuppression;
4. DeliveryAttempt;
5. DeliveryProviderEvent;
6. audit/outbox/operations alert.

Every attempt and message transition must commit atomically where possible. Attempt numbers are allocated under the message lock.

### Gate P0.5 — Remove dual delivery

Change OutboxProcessorService to choose exactly one server-resolved path:

- allowed V2 scope: DeliveryFanoutService only;
- non-V2 scope during compatibility: legacy processor only;
- V2 dry-run scope: create redacted resolution evidence but do not send;
- never invoke both paths for the same event and recipient.

Retire TransactionalMailService direct Recruitment sends only after V2 acceptance. Until then, feature routing must remain mutually exclusive per Company/Branch.

Use compatible dedupe keys across the cutover so a legacy in-app notification cannot be recreated by V2.

### Gate P0.6 — Fix authoritative recipient resolution

Create typed handlers for every supported event. Each handler must reload its authoritative aggregate and verify that the Outbox tenant snapshot matches it.

Do not use payload candidateId, panelUserIds, panelEmails, recipientUserId, recipientUserIds, Company IDs, or Branch IDs as authorization evidence.

Candidate:

- Outbox aggregate -> Application -> Job Opening -> Candidate;
- verify Company and Branch;
- use the Candidate's current normalized email;
- create a redacted resolution exception when no safe email exists.

Interview panel:

- Interview Session -> Application -> persisted InterviewPanelMember;
- active Employee;
- active linked User;
- same Company and Branch as the Opening/Application;
- still assigned to the Interview;
- email plus in-app.

HR recipients:

- resolve permission from the event registry;
- GROUP means exact Company Group;
- COMPANY means exact Company;
- BRANCH means exact Branch;
- GLOBAL is allowed only for explicit platform-operations events;
- do not use a loose OR expression.

Onboarding:

- reload Onboarding task and current assignee;
- assignment/reassignment/due/overdue use email plus in-app;
- completion/waiver/onboarding completion use in-app only;
- Department recipients require active Employee + active User + exact Company + Branch + Department + onboarding permission;
- ignore singular/plural payload discrepancies by treating the aggregate as authoritative.

When recipient resolution fails, write a redacted resolution exception and alert operations. Never broaden scope.

### Gate P0.7 — Snapshot immutable content

Render the email once when DeliveryMessage is created:

- resolve the versioned template;
- construct the action link;
- render text and HTML;
- encrypt address, subject and both bodies;
- store template key/version and encryption-key version;
- set clientReference to DeliveryMessage.id.

Retries reuse the exact encrypted snapshot. They must not reload mutable Candidate, Offer, Interview, Employee, or Onboarding values to produce a different message.

Action links:

- never store plaintext action tokens in Outbox payloads, logs, audits, or attempts;
- store only an encrypted, versioned token envelope where asynchronous rendering requires recovery;
- clear or cryptographically expire recoverable invitation material after delivery eligibility ends;
- an expired offer/invitation uses the domain regeneration command, not Delivery retry.

### Gate P0.8 — Correct ZeptoMail semantics

Send:

- POST https://api.zeptomail.com/v1.1/email;
- verified sender;
- DeliveryMessage.id as client_reference;
- track_opens=false;
- track_clicks=false.

On HTTP success:

- create an ACCEPTED attempt;
- persist request/provider references;
- set message status to ACCEPTED and acceptedAt;
- do not set deliveredAt.

Classification:

- network failure, HTTP 408/429 and 5xx: transient;
- documented permanent 4xx: permanent;
- timeout after request transmission: AMBIGUOUS and RECONCILING;
- exhausted retries: DEAD_LETTER plus operations alert.

Retry schedule remains the approved sequence:

- 1 minute;
- 5 minutes;
- 15 minutes;
- 1 hour;
- 6 hours;
- 24 hours.

### Gate P0.9 — Implement the official webhook contract

Route:

- POST /webhooks/zeptomail;
- mark it Public for the application authentication guard;
- authenticate exclusively with mandatory provider signature verification;
- apply a provider-specific rate limit and request-size limit.

Verification:

- preserve raw bytes before JSON/body parsing;
- parse producer-signature fields ts, s and s-algorithm;
- require HmacSHA256;
- decode the provider signature as Base64;
- validate the millisecond timestamp in the configured replay window;
- construct the signed payload exactly as defined by the current ZeptoMail documentation;
- compare with constant-time equality;
- reject missing secret, signature, timestamp, algorithm, malformed encoding, or stale timestamp.

Processing:

1. Verify signature.
2. Normalize the payload and compute its versioned digest.
3. Insert the idempotent encrypted ProviderEvent.
4. If it already exists, return the prior safe result.
5. Correlate by the stable DeliveryMessage clientReference/provider reference.
6. Lock the message and apply a monotonic transition.
7. Create/release suppression only from supported events and scoped message data.
8. Mark the provider event processed.
9. Return success.

Do not swallow database/processing failures. Return a retriable failure so the provider can resend. Invalid signatures remain non-retriable authentication failures.

State rules:

- delivered -> DELIVERED;
- soft bounce -> BOUNCED_SOFT and scheduled retry when allowed;
- hard bounce -> BOUNCED_HARD and active Company suppression;
- feedback-loop complaint -> COMPLAINED and active Company suppression;
- duplicate/out-of-order events cannot move a terminal hard bounce/complaint backward.

Use provider fixtures captured from the configured ZeptoMail Agent, then retain redacted fixtures for automated contract tests.

### Gate P0.10 — Make employee invitation asynchronous

Recruitment conversion must commit in one serializable transaction:

- Employee;
- User;
- UserInvitation;
- Recruitment/Application conversion state;
- Employee Onboarding;
- safe Outbox event;
- audit/career evidence.

After commit, Delivery fan-out creates or replays exactly one invitation DeliveryMessage.

Required idempotency:

- repeated conversion returns the same Employee, UserInvitation and Onboarding;
- it repairs a missing invitation DeliveryMessage;
- it never creates a second Employee or invitation;
- a mail/provider failure never rolls back or masks the committed conversion result;
- the API returns persisted invitation-delivery status rather than fabricating success.

If asynchronous rendering needs the raw invitation token, store it only as a short-lived encrypted envelope linked to the invitation. The Outbox event contains IDs only.

## 5. P1 Recruitment shortlist fixes

### 5.1 Command request contract

Replace the optional version field with:

    {
      expectedVersion: number;
      operationId: string;
      comment?: string;
      reasonCode?: string;
    }

Both expectedVersion and operationId are required for Shortlist, Start Screening, Reject, Withdraw, and every other internal state-changing Application command.

### 5.2 Idempotency and concurrency

Use a Company-qualified RecruitmentCommandReceipt or the established generic command-receipt implementation. Do not reuse a receipt that is scoped only to Delivery operations.

Within one transaction:

1. claim/replay receipt;
2. scoped-read and lock Application;
3. compare expectedVersion;
4. validate state transition;
5. update with a version CAS;
6. write status history;
7. write audit;
8. write candidate/operations Outbox event when configured;
9. persist safe response snapshot.

Stable failures:

- APPLICATION_NOT_FOUND;
- APPLICATION_STATE_CHANGED;
- APPLICATION_INVALID_TRANSITION;
- APPLICATION_NOT_SHORTLISTED;
- OPERATION_ID_REUSED.

Repeated operation with the same canonical request returns the original response. Reusing the operation ID with a different request returns OPERATION_ID_REUSED.

### 5.3 Shortlist rollout

- Add a server-side Company/Branch allowlist, not only a global flag.
- Preflight existing APPLIED/SCREENING rows before enabling.
- Preserve existing Screening rows; do not backfill them to Shortlisted.
- Record feature use and transition conflicts by Company/Branch.

## 6. P1 API contract fixes

### 6.1 Read endpoints

Retain:

- GET /delivery/messages
- GET /delivery/messages/:id
- GET /delivery/messages/:id/attempts
- GET /delivery/dead-letters
- GET /delivery/health
- GET /delivery/suppressions

List response:

    {
      items: DeliveryMessageResponse[];
      total: number;
      page: number;
      limit: number;
    }

Supported query fields:

- status;
- channel;
- eventType;
- Company and Branch for platform operations only;
- keyword over safe identifiers;
- fromDate/toDate;
- page/limit;
- allowlisted sortBy;
- sortOrder.

Every direct ID uses the same safe 404 for absent and out-of-scope records.

### 6.2 Delivery response

Return:

- id and version;
- safe aggregate reference;
- event type;
- channel/provider/status;
- redacted recipient display;
- Company/Branch display;
- attempt count;
- queued/accepted/delivered/terminal/dead-letter dates;
- safe last error;
- allowedActions;
- action requirements.

Never return:

- ciphertext/nonces/tags;
- recipient HMAC;
- plaintext address or message body;
- action token/link;
- provider raw payload;
- command hash;
- unrestricted recipient/user IDs.

Allowed actions:

- RETRY;
- CANCEL;
- RELEASE_SUPPRESSION.

The server computes actions from permission, tenant scope, status, optimistic version, suppression state, token validity, and provider state.

### 6.3 Commands

Retry:

    {
      expectedVersion: number;
      operationId: string;
      reason: string;
    }

Cancel:

    {
      expectedVersion: number;
      operationId: string;
      reason: string;
    }

Release suppression:

    {
      expectedVersion: number;
      operationId: string;
      reason: string;
    }

Use the authenticated User ID as actor evidence. Do not substitute Company Group ID or the string system.

Command responses return the refreshed typed projection and replay the original safe response.

Stable errors:

- DELIVERY_MESSAGE_NOT_FOUND;
- DELIVERY_STATE_CHANGED;
- DELIVERY_RETRY_NOT_ALLOWED;
- DELIVERY_CANCEL_NOT_ALLOWED;
- DELIVERY_RECIPIENT_SUPPRESSED;
- DELIVERY_ACTION_LINK_EXPIRED;
- SUPPRESSION_NOT_FOUND;
- SUPPRESSION_STATE_CHANGED;
- OPERATION_ID_REUSED.

Map named database constraint/trigger failures to these codes rather than exposing Prisma/PostgreSQL errors.

## 7. P1 frontend fixes

### 7.1 Typed server contract

- Replace data/total with items/total/page/limit.
- Add version, allowedActions and actionRequirements.
- Update enums to the canonical production values.
- Treat unknown future action/status values as read-only.
- Add contract fixtures shared with backend response tests.

### 7.2 Action rendering

- Remove status-derived Retry/Cancel rules.
- Render a button only when the exact server allowed action exists.
- Retry/Cancel dialogs collect reason.
- Send expectedVersion and operationId.
- Preserve reason when a 409 conflict occurs.
- Refetch detail, list, health and dead-letter queries after mutation.
- Do not optimistically mark a message queued, cancelled, accepted, or delivered.

### 7.3 Monitoring views

HR scope:

- only authorized Company/Branch Recruitment messages;
- redacted recipient;
- safe attempt timeline;
- retry only when allowed.

Platform operations:

- Company/Branch filters;
- dead-letter queue;
- suppression queue;
- queue health;
- provider reconciliation state;
- no plaintext body/token access.

Required states:

- loading skeleton;
- empty queue;
- access denied;
- safe not found;
- version conflict;
- suppression conflict;
- expired action link;
- network/provider retry;
- dead-letter escalation.

### 7.4 Recruitment navigation and filters

Primary menu:

    Recruitment
      Dashboard
      Applications
      Candidates

Remove Job Openings from the primary menu while retaining its route through Application/administrative flows if still required. Interview and Offer remain deep-link routes.

Add Application filters:

- Applied;
- Shortlisted;
- Screening;
- Has scheduled interview;
- Interview date range;
- Offer sent;
- Offer accepted with signature verification pending;
- Ready to hire;
- Rejected/withdrawn.

Application list and detail actions continue to consume backend allowedActions only.

### 7.5 UI tests

Add tests for:

- no local status-derived action;
- Retry/Cancel reason and version payload;
- 403/404/409/422/5xx behavior;
- redacted recipient/body;
- pagination and filters;
- accepted versus delivered presentation;
- soft/hard bounce and complaint presentation;
- suppression release;
- dead-letter retry;
- keyboard, focus, responsive and loading/empty states.

## 8. Onboarding notification integration

Create an event-to-channel registry:

| Event | Email | In-app |
|---|---:|---:|
| Task assigned | Yes | Yes |
| Task reassigned | Yes | Yes |
| Task due soon | Yes | Yes |
| Task overdue | Yes | Yes |
| Task completed | No | Yes |
| Task waived | No | Yes |
| Onboarding completed | No | Yes |
| Onboarding cancelled | No | Yes |

The handler reloads the task/onboarding and resolves:

- current assignee for personal events;
- active same-Department permitted users for Department events;
- HR exception recipients through exact RoleAssignment scope.

Correct the current recipientUserId versus recipientUserIds mismatch by removing recipient authorization from payloads. Payloads may carry safe hints, but the Delivery handler must use current persisted state.

Notification deep links contain safe entity IDs only and recheck access when opened.

## 9. Testing required before enablement

### 9.1 Unit/service tests

- Shortlist state matrix and receipt replay/conflict.
- typed recipient handlers for Candidate, panel, HR, invitation and Onboarding.
- exact RoleAssignment scope.
- message encryption/decryption and key versions.
- canonical request/payload digests.
- allowedActions.
- retry classification.
- immutable content snapshot.
- suppression creation/release.
- webhook normalization and signature verification.
- delivery state transition matrix.

### 9.2 Real PostgreSQL integration/concurrency

Use an isolated disposable PostgreSQL database, not mocked Prisma.

Test:

- from-zero migrations;
- upgrade from the currently-applied foundation with legacy rows;
- concurrent Shortlist versus Reject;
- repeated idempotent Shortlist;
- two workers claiming the same message;
- duplicate fan-out;
- attempt-number allocation;
- retry versus delivered webhook;
- retry versus hard bounce;
- duplicate/out-of-order webhook;
- suppression release versus new hard bounce;
- lease expiry and reconciliation;
- employee invitation recovery without duplicate Employee/User/Invitation;
- Company/Branch direct-ID denial.

Verify named constraints, triggers and indexes from PostgreSQL catalogs.

### 9.3 Real API tests

Run with live Nest application and PostgreSQL:

- HR Recruitment scope;
- other Branch;
- other Company;
- platform operations;
- webhook without application JWT but with valid provider signature;
- invalid/stale webhook signature;
- retry/cancel/release version conflicts;
- safe 404 and redacted response.

### 9.4 Real Playwright personas

Remove forced mock mode from the production-candidate Playwright configuration.

Personas:

1. HR shortlists and starts Screening.
2. Other Branch cannot read/mutate Application.
3. Candidate receives application/interview/offer email.
4. active panel Employee receives email plus in-app.
5. removed/inactive panel member receives nothing.
6. HR sees a scoped failure and retries.
7. platform operator monitors dead letters without content/token exposure.
8. converted Employee receives one invitation.
9. Onboarding assignee receives the approved channel combination.
10. other Department/Company receives nothing.

### 9.5 Real ZeptoMail evidence

Record:

- verified sender/domain and Agent;
- API request accepted with DeliveryMessage.id client_reference;
- persisted ACCEPTED state;
- signed delivered webhook;
- persisted DELIVERED state;
- signed soft-bounce webhook and retry;
- signed hard-bounce/feedback-loop event and Company suppression;
- duplicate webhook replay;
- invalid/stale signature rejection;
- secret rotation check;
- dead-letter alert.

Redact addresses, tokens, authorization headers and raw payloads from committed evidence.

## 10. Rollout sequence

1. Keep Delivery V2 disabled.
2. Implement and review expand migration.
3. Rehearse from-zero and upgrade migrations on disposable PostgreSQL.
4. Deploy additive schema with flags off.
5. Run preflight and reconciliation.
6. Implement canonical encryption, receipts, fan-out and workers.
7. Fix ZeptoMail acceptance/webhook processing.
8. Move Invitation and Onboarding delivery to authoritative asynchronous handlers.
9. Finalize typed APIs and server allowedActions.
10. Update UI to consume the final contract.
11. Pass lint, type-check, unit and production builds.
12. Pass real PostgreSQL concurrency and real API tests.
13. Pass real non-mock browser personas.
14. Capture real ZeptoMail acceptance and webhook evidence.
15. Enable dry-run for one approved Company/Branch.
16. Verify recipient resolution with no sends.
17. Enable sending for that pilot scope.
18. Monitor queues, retries, dead letters, suppressions and recipient exceptions.
19. Obtain technical UAT, business sign-off and rollback approval.
20. Expand the server-side allowlist.

## 11. Monitoring and operations

Metrics:

- queued/processing/accepted/retry/reconciling/dead-letter counts;
- oldest eligible message age;
- expired leases;
- provider acceptance/failure by safe error code;
- webhook accepted/rejected/duplicate/failed;
- unresolved recipient exceptions;
- suppressed-address bypasses;
- invitation repair;
- out-of-scope direct-ID attempts;
- legacy delivery usage.

Alerts:

- dead letter created;
- worker heartbeat missing;
- queue age threshold exceeded;
- webhook signature failures spike;
- provider processing failure;
- unresolved RECONCILING rows;
- no-recipient exception;
- legacy path used in a V2-enabled scope.

Logs must contain safe IDs and codes only. Do not log addresses, subject/body, action links, tokens, ciphertext, HMAC values, provider authorization, or raw webhook content.

## 12. Production acceptance

Production acceptance requires all of the following:

- no Delivery V2 and legacy double processing;
- no queued messages without an active worker;
- provider acceptance is distinct from final delivery;
- webhook follows the current official ZeptoMail signature contract;
- email address, subject/body and provider payload are encrypted at rest;
- immutable retry content;
- exact Company/Branch/Department recipient resolution;
- no payload-authorized recipients;
- deterministic Shortlist commands under retry/concurrency;
- employee conversion and invitation recovery without duplicates;
- Onboarding channel matrix works for the actual assignee;
- server-authoritative allowedActions across API and UI;
- additive migration rehearsed from zero and current foundation upgrade;
- reconciliation reports zero unresolved rows;
- lint, TypeScript, tests and builds pass;
- real PostgreSQL concurrency passes;
- real API and non-mock browser personas pass;
- real ZeptoMail acceptance, delivered and bounce webhooks are recorded;
- backup/restore and rollback are rehearsed;
- monitoring and alerts are operational;
- technical UAT and business sign-off are recorded against the release commit.

## 13. Recommended commit grouping

1. Delivery canonical schema and expand migration.
2. Delivery backfill, reconciliation and contract migration.
3. Encryption, command receipts and typed Delivery domain.
4. Authoritative recipient handlers and mutually-exclusive cutover.
5. Durable worker host, lease recovery and retry/reconciliation.
6. ZeptoMail adapter and official webhook implementation.
7. Asynchronous Employee invitation and Onboarding notification integration.
8. Shortlist operationId/expectedVersion and receipt hardening.
9. Delivery API response/command contract.
10. Delivery and Recruitment UI contract/navigation/filter changes.
11. PostgreSQL/API/browser/provider acceptance tests and operational runbooks.

Each commit should leave schema/client generation, TypeScript and focused tests internally consistent. Do not mix unrelated Asset, Onboarding Template, or secure-file refactors into these commits.
