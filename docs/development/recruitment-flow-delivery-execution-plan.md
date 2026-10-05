# Recruitment Flow and Delivery — Phased Execution Plan

**Owner:** Developer 1  
**Source spec:** `recruitment-flow-and-delivery-implementation-plan.md`  
**Colleague spec:** `secure-documents-and-signed-offer-implementation-plan.md` (Developer 2)

---

## Current codebase state (as of latest pull)

| Area | What exists now |
|---|---|
| `JobApplicationStatus` | `APPLIED → SCREENING → INTERVIEW → MANAGER_REVIEW → SELECTED → OFFER_SENT → OFFER_ACCEPTED → HIRED` — **no `SHORTLISTED`** |
| Transition service | `startScreening`, `reject`, `withdraw`, etc. — **no `shortlist()` method** |
| Transition matrix (`recruitment.utils.ts`) | `APPLIED → SCREENING` directly — needs SHORTLISTED inserted |
| `allowedActions` in `recruitment-transition.types.ts` | `start-screening, reject, withdraw` for APPLIED — **no shortlist action** |
| Nav (`navigation.ts`) | Dashboard, Job Openings, Candidates, Applications, **Interviews, Offers** (both visible) |
| Email delivery | Nodemailer via SMTP (`TransactionalMailService`) — **no ZeptoMail REST adapter** |
| Delivery tracking | `RecruitmentDeliveryAttempt` (per-offer/per-application model) — not the full durable delivery schema |
| Panel email on interview schedule | **Not sent** — only candidate email + in-app notification to HR roles |
| Delivery monitoring UI | **Does not exist** |
| Shortlist UI | **Does not exist** |
| ZeptoMail package | **Not installed** |
| Application list filters | Applied, Screening, Interview, Manager review, Rejected, Withdrawn — **missing Shortlisted, Offer-stage filters** |

Developer 2 has separate work: file storage, ClamAV, signed-offer upload, HR verification, and the `OFFER_SIGNATURE_*` outbox events your delivery layer will consume.

---

## Phase overview

| Phase | Name | Focus | Gate to next phase |
|---|---|---|---|
| **A** | Shortlist foundation | DB + backend shortlist state machine | Tests pass, migration clean |
| **B** | Shortlist frontend | UI actions, filters, nav simplify | Manual smoke against API |
| **C** | Panel email | Extend delivery processor with panel email on interview schedule/cancel/reschedule | Real email received by a panel user |
| **D** | ZeptoMail adapter | Replace nodemailer SMTP with ZeptoMail REST for all transactional email | Real ZeptoMail acceptance + webhook ping |
| **E** | Durable delivery models | Full `DeliveryMessage / DeliveryAttempt / DeliveryProviderEvent / EmailSuppression` schema | Migration + integration tests |
| **F** | Delivery monitoring UI + operations API | Admin/HR delivery list, dead letters, retry, suppression release | Permission tests pass |
| **G** | Developer 2 event integration | Consume `OFFER_SIGNATURE_*` outbox events; send candidate resubmission email | Joint smoke with Dev 2 |
| **H** | Acceptance | Persona tests, real provider evidence, production checklist | Business sign-off |

**Do not start Phase D before Phase C is verified.**  
**Do not start Phase E before Phase D has real ZeptoMail evidence.**

---

## Phase A — Shortlist foundation (backend)

**Goal:** `SHORTLISTED` status exists, state machine is correct, commands work.

### A1 — Database migration

File: `backend/prisma/migrations/YYYYMMDDHHMMSS_recruitment_shortlist/migration.sql`

```sql
-- Add SHORTLISTED to the enum
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'SHORTLISTED' AFTER 'APPLIED';

-- Add shortlistedAt timestamp to job_applications
ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "shortlistedAt" TIMESTAMP(3);
```

Then regenerate Prisma client: `pnpm prisma:generate`

### A2 — Update transition matrix

File: `backend/src/modules/recruitment/core/recruitment.utils.ts`

Change `allowedApplicationTransitions`:

```ts
[JobApplicationStatus.APPLIED]: [
  JobApplicationStatus.SHORTLISTED,   // <- new
  JobApplicationStatus.REJECTED,
  JobApplicationStatus.WITHDRAWN,
],
[JobApplicationStatus.SHORTLISTED]: [ // <- new block
  JobApplicationStatus.SCREENING,
  JobApplicationStatus.REJECTED,
  JobApplicationStatus.WITHDRAWN,
],
```

Remove `JobApplicationStatus.SCREENING` from `APPLIED` transitions (plan §4.2 — once shortlist is enabled, `APPLIED → SCREENING` is blocked).

Add `SHORTLISTED` to terminal set check guard (it is not terminal, so just ensure it is handled).

### A3 — Update allowed actions

File: `backend/src/modules/recruitment/transitions/recruitment-transition.types.ts`

Add `'shortlist'` to `JobApplicationAction`.

Update `getJobApplicationAllowedActions`:

```ts
case 'APPLIED':
  return ['shortlist', 'reject', 'withdraw'];   // was: start-screening, reject, withdraw
case 'SHORTLISTED':
  return ['start-screening', 'reject', 'withdraw'];
```

### A4 — Add shortlist() method to transition service

File: `backend/src/modules/recruitment/transitions/job-application-transition.service.ts`

```ts
async shortlist(
  jobApplicationId: string,
  comment?: string,
  expectedVersion?: number,
): Promise<JobApplicationTransitionResult> {
  return this.transition(jobApplicationId, 'SHORTLISTED', expectedVersion, {
    comment,
    shortlistedAt: new Date(),   // set only on first shortlist
  });
}
```

Also extend `transitionInTransaction` `meta` type and the `update` call to write `shortlistedAt`.

### A5 — Add controller endpoint

File: `backend/src/modules/recruitment/job-application/job-application.controller.ts`

```
POST /job-applications/:id/shortlist
```

Body:
```ts
{ expectedVersion: number; operationId: string; comment?: string }
```

Follow the same pattern as the existing `start-screening` endpoint.

### A6 — Feature flag guard

Add `RECRUITMENT_SHORTLIST_ENABLED` env check. When flag is off, return `APPLICATION_FEATURE_DISABLED`. When on, block `APPLIED → SCREENING` start-screening if feature is enabled for that company/branch.

### A7 — Unit tests

File: `backend/test/foundation/recruitment-shortlist.service.spec.ts`

Test cases:
- `APPLIED → SHORTLISTED` succeeds, sets `shortlistedAt`
- `SHORTLISTED → SCREENING` succeeds
- `APPLIED → SCREENING` blocked when flag enabled
- `APPLIED → REJECTED` still works
- `SHORTLISTED → REJECTED` works
- Idempotent shortlist with same `operationId`
- Stale version returns `APPLICATION_STALE_VERSION`

**Done when:** `pnpm test -- --testPathPatterns="recruitment-shortlist"` passes.

---

## Phase B — Shortlist frontend

**Goal:** HR can shortlist or reject from the application list. Navigation is simplified.

### B1 — Nav simplification

File: `frontend/config/navigation.ts`

Remove (or comment out) Interviews and Offers from the primary recruitment children array.  
Keep the routes — just remove them from nav so they still work as deep links.

Recruitment nav becomes:
```
Recruitment
├── Dashboard
├── Job Openings
├── Candidates
└── Applications
```

### B2 — Application list filters

File: `frontend/features/recruitment/applications/components/job-application-workspace.tsx`

Add filter options: `Shortlisted`, `Has interview`, `Offer sent`, `Ready to hire`.  
These map to `status=SHORTLISTED`, `status=INTERVIEW`, `status=OFFER_SENT`, `status=OFFER_ACCEPTED`.

### B3 — Application list row actions

File: `frontend/features/recruitment/applications/components/job-application-workspace.tsx`

For APPLIED rows: show **Shortlist** and **Reject** buttons (remove Start Screening button).  
For SHORTLISTED rows: show **Start Screening** and **Reject** buttons.  
Render buttons from `allowedActions` returned by the backend — never hardcode by status on the frontend.

### B4 — API service + hook

File: `frontend/features/recruitment/applications/services/`

Add `shortlistApplication(id, dto)` method calling `POST /job-applications/:id/shortlist`.  
Use `expectedVersion` and `operationId` on every call.  
On `409` refetch the row and show "Updated by another user, review new state."

### B5 — Shortlisted badge/label

Add `SHORTLISTED` to the status badge display in the application list and detail header.

**Done when:** HR can shortlist and start screening from the UI against the real API.

---

## Phase C — Panel email on interview events

**Goal:** When an interview is scheduled, rescheduled or cancelled, panel members receive an email in addition to the existing in-app notification.

### C1 — Identify the gap

File: `backend/src/modules/recruitment/services/recruitment-delivery.processor.ts`

Current `deliverCandidateEmail` only sends to the candidate.  
The existing `resolveInternalRecipients` sends in-app to HR roles from payload `recipientUserIds`.  
Panel member emails are not sent anywhere.

### C2 — Add panel email delivery

In `recruitment-delivery.processor.ts`, add a `deliverPanelEmails` private method:

1. On `recruitment.interview.scheduled`, `rescheduled`, `cancelled`:
   - Load `InterviewPanelMember` rows for the interview ID from the payload.
   - Filter: `isActive = true`, linked Employee in same Company/Branch, linked User is ACTIVE.
   - For each panel member, send an email via `TransactionalMailService.sendRecruitmentMessage` with:
     - Subject: `Your interview has been scheduled / updated / cancelled`
     - Body includes: candidate name, interview date/time, role/opening name, optional link.
     - `clientReference`: `panel-email:${interviewId}:${panelMemberId}:${event.dedupeKey}`
2. Log success/failure per member (do not fail the whole event if one panellist email fails).
3. Call `deliverPanelEmails` from `process()` after `deliverCandidateEmail`.

### C3 — Reload authoritative interview data

When constructing the email, reload the Interview, Application, and Candidate from the DB using IDs from the outbox payload. Do not trust raw candidate name from the payload.

### C4 — Tests

File: `backend/test/foundation/recruitment-panel-email.spec.ts`

Test:
- Panel member with active Employee + User in same branch receives email
- Removed/inactive panel member does not receive email
- Panel member from different branch does not receive email
- Candidate still receives separate email

**Done when:** Manually scheduled an interview on dev; a test panel user's inbox gets the email.

---

## Phase D — ZeptoMail REST adapter

**Goal:** Replace Nodemailer SMTP with ZeptoMail REST API for all transactional recruitment email.

### D1 — Install ZeptoMail

Check ZeptoMail's current Node.js package (official or use `axios`/`node-fetch` against their REST API directly per their docs).

```bash
pnpm add @zeptomail/sendmail-nodejs
```

Or implement a thin adapter using the documented `POST https://api.zeptomail.com/v1.1/email`.

### D2 — ZeptoMail adapter service

File: `backend/src/modules/mail/zeptomail-mail.service.ts`

```ts
@Injectable()
export class ZeptomailService {
  async send(input: {
    to: string;
    displayName: string;
    subject: string;
    html: string;
    text: string;
    clientReference: string;
  }): Promise<{ requestId: string; providerReference: string }> {
    // POST https://api.zeptomail.com/v1.1/email
    // Authorization: Zoho-enczapikey <ZEPTOMAIL_SEND_TOKEN>
    // track_opens: false, track_clicks: false
    // client_reference: clientReference
  }
}
```

Required env variables (add to `environment.ts` + `.env.example`):
```
ZEPTOMAIL_SEND_TOKEN=
ZEPTOMAIL_FROM_ADDRESS=
ZEPTOMAIL_FROM_NAME=
ZEPTOMAIL_WEBHOOK_SIGNING_SECRET=
```

### D3 — Switch `TransactionalMailService` to ZeptoMail

When `DELIVERY_V2_ENABLED=true`, route through `ZeptomailService` instead of nodemailer.  
Keep nodemailer as fallback path when flag is off (compatibility path only, not default).

### D4 — Webhook endpoint

File: `backend/src/modules/mail/zeptomail-webhook.controller.ts`

```
POST /webhooks/zeptomail
```

- Verify HMAC-SHA256 `producer-signature` header.
- Reject timestamps outside the configured replay window.
- Parse: delivered, soft bounce, hard bounce, feedback-loop events.
- Update `RecruitmentDeliveryAttempt` status for the matched `clientReference`.
- Ignore open/click events.
- Always return `200` after signature is valid (even if processing fails — log the error).

### D5 — Tests

- ZeptoMail adapter unit test with mocked HTTP.
- Webhook signature validation test (valid + tampered).
- Delivered event updates delivery attempt status.

**Done when:** Real ZeptoMail API call accepted, `requestId` returned, test email delivered to inbox.

---

## Phase E — Durable delivery models

**Goal:** Replace `RecruitmentDeliveryAttempt` (recruitment-specific) with the full generic `DeliveryMessage / DeliveryAttempt / DeliveryProviderEvent / EmailSuppression` schema from spec §5.

> **Note:** This is the largest change. Do not start until Phase D is working and real ZeptoMail evidence is in hand.

### E1 — Migration

Create migration: `YYYYMMDDHHMMSS_delivery_v2_foundation`

Add enums: `DeliveryChannel`, `DeliveryRecipientKind`, `DeliveryProvider`, `DeliveryMessageStatus`, `DeliveryAttemptOutcome`

Add tables (see plan §5.2–5.6 for full field list):
- `delivery_messages`
- `delivery_attempts`
- `delivery_provider_events`
- `email_suppressions`
- `delivery_command_receipts`

All constraints and indexes from the spec go in the same migration.

### E2 — Update Prisma schema

Add corresponding Prisma models under `backend/prisma/schema.prisma` in a new `## Delivery` section. Run `pnpm prisma:generate`.

### E3 — Delivery fan-out worker

File: `backend/src/modules/delivery/delivery-fanout.service.ts`

Claim `OutboxEvent` rows → resolve recipients → create one `DeliveryMessage` per recipient/channel → mark expansion done.

Fan-out must be idempotent: check for existing `DeliveryMessage` by `dedupeKey` before creating.

### E4 — Email worker

File: `backend/src/modules/delivery/delivery-email.worker.ts`

Poll `delivery_messages` where `status = QUEUED AND channel = EMAIL AND nextAttemptAt <= now`.  
Create `DeliveryAttempt` → call ZeptoMail → update `DeliveryMessage` status.  
Retry schedule: 1 min, 5 min, 15 min, 1 hr, 6 hr, 24 hr (plan §6.4).  
After exhaustion → `DEAD_LETTER` + ops alert.

### E5 — In-app worker

File: `backend/src/modules/delivery/delivery-inapp.worker.ts`

Poll `delivery_messages` where `status = QUEUED AND channel = IN_APP`.  
Call `UserNotificationService.create`.  
No retry beyond two attempts (in-app is best-effort).

### E6 — Webhook → provider event → message update

Link `DeliveryProviderEvent` to `DeliveryMessage` via `clientReference`.  
Update `DeliveryMessage.status` on delivered / bounce / complaint events.  
Complaint + hard bounce → create/update `EmailSuppression`.

### E7 — Suppress before send

Before sending any email, check `EmailSuppression` for the normalized address HMAC.  
If active suppression found → set message to `BYPASSED`.

### E8 — Integration tests

File: `backend/test/foundation/delivery-v2.integration.spec.ts`

Test (real PostgreSQL, gated behind `DELIVERY_V2_TEST=1`):
- Fan-out creates correct DeliveryMessage count per event.
- Duplicate fan-out does not create duplicate messages.
- Retry worker respects schedule.
- Webhook updates status.
- Hard-bounce creates suppression; next send is BYPASSED.
- Dead-letter fires after exhausting retries.

**Done when:** All integration tests pass against real DB; ZeptoMail real webhook received and processed.

---

## Phase F — Delivery monitoring UI and operations API

**Goal:** HR can see email delivery status for their applications; ops can manage dead letters and suppressions.

### F1 — Backend API

File: `backend/src/modules/delivery/delivery.controller.ts`

```
GET  /delivery/messages
GET  /delivery/messages/:id
GET  /delivery/messages/:id/attempts
GET  /delivery/dead-letters
GET  /delivery/health
POST /delivery/messages/:id/retry
POST /delivery/messages/:id/cancel
GET  /delivery/suppressions
POST /delivery/suppressions/:id/release
```

Permissions (add and seed):
- `platform.delivery.read`
- `platform.delivery.retry`
- `hr.recruitment.delivery.read`
- `hr.recruitment.delivery.retry`

Response: `DeliveryMessageSummary` (see spec §9.3). Never return email body, raw address, or token.

### F2 — Frontend routes

```
/hr/recruitment/delivery        ← HR scoped
/hr/recruitment/delivery/[id]
/admin/operations/delivery      ← platform ops
```

Views:
- Delivery list (filterable by status, channel, date)
- Dead-letter queue
- Suppression list (hard-bounced / complained addresses)
- Attempt timeline for a single message
- Retry / cancel / release dialogs (reason required)

Rules:
- Render buttons from `allowedActions` only.
- On `409` preserve input, refetch and ask user to review.
- Redact email addresses in all views.
- Never show message body or token.

### F3 — Tests

- HR user sees only their branch delivery messages.
- Ops user sees all.
- Retry blocked for hard-bounced address until suppression released.
- Cancel blocked for DELIVERED/terminal messages.

---

## Phase G — Developer 2 event integration

**Goal:** Your delivery layer handles the `OFFER_SIGNATURE_*` events that Developer 2 emits.

> Wait for Developer 2 to implement and emit these outbox events before starting.

### G1 — Register event handlers

In the delivery fan-out, add handlers for:

| Event | Channel | Recipient | Content |
|---|---|---|---|
| `offer.signature.submitted` | In-app | HR with `recruitment.offer.verify` | "Candidate submitted signed offer for [name]" |
| `offer.signature.verified` | Email + In-app | Candidate | "Your offer has been verified" |
| `offer.signature.rejected` | Email + In-app | Candidate | "Your signed offer needs to be resubmitted" |
| `offer.signature.resubmission.requested` | Email | Candidate | "Please resubmit your signed offer letter" |

### G2 — Candidate resubmission email

When `offer.signature.resubmission_requested` is received, send candidate email with the **original still-valid offer-response link** (loaded from the DB — do not generate a new token just for redelivery).

### G3 — Joint smoke test

Run with Developer 2:
1. HR sends offer → candidate gets offer email.
2. Candidate uploads signed PDF (Dev 2's UI).
3. HR receives in-app "signature submitted" notification.
4. HR verifies → candidate gets email confirmation.
5. HR rejects → candidate gets resubmission email.

---

## Phase H — Production acceptance

All must be true before enabling for real users.

### Checklist

- [ ] `SHORTLISTED` enum, migration and state machine verified by PostgreSQL integration test.
- [ ] Shortlist UI actions tested by persona: HR in correct branch can shortlist; HR in other branch gets 404.
- [ ] Candidate email received for application received, interview scheduled/rescheduled/cancelled, offer sent.
- [ ] Panel email received when interview scheduled/rescheduled/cancelled.
- [ ] Removed or inactive panel member does not receive email.
- [ ] ZeptoMail real API acceptance recorded (not mock or nodemailer bypass).
- [ ] ZeptoMail real delivered webhook received and processed.
- [ ] Sender domain verified in ZeptoMail dashboard.
- [ ] At least one hard-bounce event received and suppression created.
- [ ] Suppression blocks further send to that address until released.
- [ ] Dead-letter operations flow tested (exhaust retries, alert fires, manual retry works).
- [ ] Delivery monitoring UI tested by HR user (sees own branch only) and ops user (sees all, no body/token).
- [ ] `APPLIED → SCREENING` blocked when shortlist feature flag is on.
- [ ] Existing SCREENING/INTERVIEW/OFFER rows not back-migrated.
- [ ] Navigation simplified: Interviews and Offers removed from primary menu.
- [ ] Application list filters cover Shortlisted, Has interview, Offer sent, Ready to hire.
- [ ] No email address exposed in monitoring UI.
- [ ] No offer token or invitation token exposed in any API response.
- [ ] Migration rehearsal on disposable DB copy.
- [ ] Business sign-off on recorded release commit.

---

## Integration points with Developer 2

| What you consume from Dev 2 | When |
|---|---|
| `OFFER_SIGNATURE_SUBMITTED` outbox event | Phase G |
| `OFFER_SIGNATURE_VERIFIED` outbox event | Phase G |
| `OFFER_SIGNATURE_REJECTED` outbox event | Phase G |
| `OFFER_SIGNATURE_RESUBMISSION_REQUESTED` outbox event | Phase G |
| Agreed event payload shape (safe IDs only, no token/binary) | Before Phase G starts |

**Dev 2 must not send the offer-response token in the outbox payload.**  
You reload the token ciphertext from the DB using the offer ID from the payload.

---

## Key files to touch by phase

| Phase | Backend files | Frontend files |
|---|---|---|
| A | `schema.prisma`, `recruitment.utils.ts`, `recruitment-transition.types.ts`, `job-application-transition.service.ts`, `job-application.controller.ts` | — |
| B | — | `navigation.ts`, `job-application-workspace.tsx`, application service/hooks |
| C | `recruitment-delivery.processor.ts` | — |
| D | `transactional-mail.service.ts`, new `zeptomail-mail.service.ts`, `zeptomail-webhook.controller.ts`, `environment.ts` | — |
| E | `schema.prisma`, new `delivery/` module, migrations | — |
| F | `delivery.controller.ts`, permissions seed | New delivery UI pages |
| G | `delivery-fanout.service.ts` (new event handlers) | — |
| H | Tests + evidence | — |

---

## What not to do (from spec §3)

- Do not store document binaries or S3 credentials (that is Dev 2's work).
- Do not implement signed-offer verification state (Dev 2 owns that).
- Do not call the secure-file module HTTP controller from backend code.
- Do not generate a new offer or invitation token just because a delivery is retried.
- Do not add Teams/Graph/Outlook calendar integration in this release.
- Do not expose rendered email body, raw email address, offer token, or invitation token in any API response.
- Do not use payload recipient IDs without reloading the authoritative tenant record.
