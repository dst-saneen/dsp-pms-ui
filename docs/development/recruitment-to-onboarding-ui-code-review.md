# Recruitment-to-Onboarding Frontend/UI Code Review

## Review scope

- Repository: `C:\DataScape\HRMS\ERP`
- Branch: `main`
- Reviewed commit: `aa281d1`
- Comparison baseline: `d5dbd63`
- Review date: 2026-08-17
- Review type: frontend architecture, security, UX flow and automated-gate review
- Application code changes made by this review: none

This document reviews the UI implementation for:

`Job Opening → Candidate → Interview Sessions/Rounds → Evaluation → Selection → Offer Acceptance → Convert to Employee → Onboarding → Probation → Active Employee`

The approved UI contract remains [recruitment-to-onboarding-ui-plan.md](./recruitment-to-onboarding-ui-plan.md). Backend statuses, permissions, transitions and errors remain owned by the API contract and are not redefined here.

## Executive verdict

The UI includes most planned Recruitment routes and a broad working mock experience, but it is **not ready for production or client sign-off**. Raw offer-token handling, default mock behavior, simulated bot protection and mock-only browser testing are release blockers.

The current result should be treated as an integration-stage UI foundation, not proof that the complete client flow works with the real API and database.

## UI capabilities currently present

The latest code includes:

- Recruitment dashboard and navigation
- Job Opening list, detail and creation pages
- Candidate list/detail pages
- Application list/detail pages and transition actions
- Interview calendar, scheduling and evaluation forms
- Hiring Manager decision workspace
- Offer list, composer and version-history components
- Ready-to-hire preflight and conversion actions
- Public Careers listing and application pages
- Public offer-response page
- Employee Career timeline components
- Redirect/hardening of the legacy Add Employee entry point
- Recruitment feature flags, API services, React Query hooks and shared types
- Desktop and mobile Playwright smoke coverage

The presence of these screens does not establish integrated workflow completion.

## P1 production blockers

### UI-01: Recruitment mock mode defaults to enabled

Severity: **P1 — production behavior blocker**

[`isRecruitmentMockEnabled`](../../frontend/features/recruitment/constants/feature-flags.ts#L10) returns true whenever `NEXT_PUBLIC_RECRUITMENT_USE_MOCK` is absent or has any value other than `false`.

Many feature services branch on this helper, including openings, applications, interviews, Hiring Manager decisions, offers, Careers and dashboard data.

Impact:

- Enabling Recruitment without explicitly setting the mock flag to `false` silently uses mock/local browser data.
- HR users can believe changes were saved while no backend record exists.
- Environment misconfiguration can reach production without failing closed.

Required correction:

- Default mock mode to false.
- Permit it only in development/test builds.
- Show an unmistakable development-only mock banner.
- Add a unit test proving an omitted flag selects the real API.

### UI-02: Raw offer-response tokens are persisted in session storage

Severity: **P1 — offer security blocker**

The historical `rememberOfferResponseUrl` helper stored the complete Candidate response URL in `sessionStorage`. That helper was removed; the current delivery-only UI is [`candidate-offer-response-link.tsx`](../../frontend/features/recruitment/offers/components/candidate-offer-response-link.tsx).

This directly violates the approved requirement: never persist the raw token in local storage, session storage, analytics, logs or error reports.

Impact:

- Browser extensions, injected scripts or later same-origin code can recover the token.
- The HR browser becomes part of Candidate offer-secret delivery.
- Token secrecy depends on clearing one browser session correctly.

Required correction:

- Remove raw token and tokenized URL storage from the HR UI.
- Do not return the token to HR-facing API consumers.
- Let the backend create and deliver the Candidate link through the email-delivery workflow.
- Return only delivery status and safe offer metadata to HR.

### UI-03: Production Turnstile is a simulated placeholder

Severity: **P1 — public security blocker**

[`TurnstileField`](../../frontend/features/recruitment/careers/components/turnstile-field.tsx#L18) displays the site-key prefix and a **Simulate verification** button that emits `mock-turnstile-token`.

Required correction:

- Integrate the actual Turnstile client component.
- Handle success, expiry, error and reset states.
- Require server-side token verification; client validation alone is not security.
- Never expose a simulation control in production builds.

### UI-04: Public anti-abuse fields are not an integrated contract

Severity: **P1 — public launch blocker**

The Careers service sends an idempotency key and Turnstile token, but the backend currently ignores them. The honeypot value is not sent by the service. There is no confirmed server rate-limit/error contract.

Impact:

- Bot protection can appear enabled in the UI while offering no server protection.
- Double submissions and replay behavior are not reliably controlled.
- Public Careers cannot safely be exposed on the internet.

Required correction:

- Finalize one typed API contract for Turnstile, honeypot, idempotency and rate-limit responses.
- Render actionable but non-enumerating errors.
- Verify behavior with real server responses rather than mock services.

### UI-05: Offer delivery depends on an unusable browser handoff

Severity: **P1 — end-to-end flow blocker**

[`OfferService.send`](../../frontend/features/recruitment/offers/services/offer-service.ts#L119) extracts a token from the HR API response, builds a Candidate URL and remembers it locally.

The backend does not yet provide a complete Candidate-email pipeline. Therefore, the Send/Retry UI can report a queued action without proving that the Candidate received a usable offer link.

Required correction:

- Make backend delivery status the UI source of truth.
- Display queued, sent, failed and retry-available states from persisted delivery attempts.
- Never expose or manually retain the Candidate token in HR screens.

## P2 UX and contract deviations

### UI-06: Public offer terminal states cannot be presented accurately

The UI is designed to show expired, revoked and already-responded states, but the current API generally normalizes these cases to an invalid token. The UI cannot reliably infer these states itself.

Required correction:

- Consume a sanitized API terminal-state response.
- Keep invalid/unrecognized tokens indistinguishable where enumeration risk exists.
- Do not invent state from local storage or HTTP status alone.

### UI-07: Probation override is exposed too broadly

The Career service permits early override behavior for the normal HR flow. The UI/API contract does not establish a separate permission for early activation.

Required correction:

- Show early confirmation only for the separately authorized role/permission.
- Require an explicit structured reason and confirmation warning.
- Keep normal confirmation unavailable until the probation end date.

### UI-08: Career timeline is not yet a complete employee-history view

The Career tab exists, but the backend does not yet supply every required Recruitment and Onboarding milestone. The UI must not fill these gaps using inferred client-side events.

Required correction:

- Render only backend-recorded immutable career events.
- Maintain separate HR-confidential and employee-sanitized projections.
- Verify that interview scores, confidential notes and compensation never reach employee self-service payloads.

### UI-09: Current lint failures block the release gate

Direct frontend lint reported four errors and twelve warnings. Current errors include:

- Synchronous state updates inside effects in [`applications/[id]/page.tsx`](<../../frontend/app/(dashboard)/hr/recruitment/applications/[id]/page.tsx#L20>)
- Synchronous state updates inside effects in [`applications/page.tsx`](<../../frontend/app/(dashboard)/hr/recruitment/applications/page.tsx#L17>)
- Synchronous form-reset state updates in [`confirm-active-dialog.tsx`](../../frontend/features/employee-career/components/confirm-active-dialog.tsx#L52)
- Empty interface equivalent to its supertype in [`job-offer.ts`](../../frontend/features/recruitment/offers/types/job-offer.ts#L103)

The warnings also identify React Compiler incompatibility and dependency-stability concerns in several Recruitment forms.

Required correction:

- Clear all lint errors.
- Review warnings rather than suppressing them globally.
- Rerun lint, TypeScript, component tests and production build together.

## Browser-test gap

[`recruitment-hardening.spec.ts`](../../frontend/e2e/recruitment-hardening.spec.ts#L1) contains seven smoke scenarios run across desktop and mobile projects, resulting in fourteen passing checks.

However:

- Playwright explicitly enables `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=true`.
- The backend was unavailable during the reviewed run, yet all tests passed.
- Several assertions accept broad alternatives such as Recruitment, Sign in or Welcome back.
- The suite does not create real records in a release API/database.
- It does not execute the approved twelve-persona-step flow.

Therefore, **14/14 passing is smoke evidence only, not end-to-end acceptance evidence**.

## Required integrated Playwright flow

The release suite must use the real API and a disposable database to prove:

1. HR creates and publishes a valid opening.
2. A public Candidate applies with a real validated CV.
3. HR screens the Application and schedules required interviews.
4. Assigned panel members submit immutable evaluations.
5. The correct Hiring Manager selects the Candidate.
6. HR prepares and sends an offer.
7. The Candidate receives the email and accepts through a real token.
8. HR sees the accepted Candidate as ready to hire.
9. HR runs preflight and converts the Candidate exactly once.
10. The Employee accepts the User invitation.
11. The Employee completes mandatory Onboarding and enters Probation.
12. Authorized HR confirms Active after probation.

The suite must additionally cover unauthorized URLs, sibling-tenant IDs, token expiry/replay, failed email delivery/retry, file rejection, mobile/tablet layout, keyboard/focus behavior and confidential timeline filtering.

## Automated verification results

| Gate | Result | Qualification |
|---|---:|---|
| TypeScript `--noEmit` | Passed | Direct compiler execution |
| Frontend unit/component tests | Passed | 13 files; 24 tests |
| Production build | Passed | Next.js compiled and generated routes |
| Frontend lint | Failed | 4 errors and 12 warnings |
| Playwright smoke | Passed | 14 checks, mock mode, no backend integration |
| Full Recruitment persona | Not implemented | No real API/database lifecycle test |
| Accessibility review | Not evidenced | Requires manual and automated review |
| Client UAT | Not performed | Complete lifecycle has not been demonstrated |

## Required UI completion order

1. Default mock mode off and separate mock tooling from production runtime.
2. Remove raw offer-token handling from HR browser storage and screens.
3. Integrate real Turnstile and the finalized server anti-abuse contract.
4. Consume backend delivery status for Candidate emails and retries.
5. Align terminal offer, conversion, probation and career-event responses with the API contract.
6. Clear TypeScript/lint/component/build gates.
7. Replace mock-only smoke coverage with the real twelve-step persona flow.
8. Complete responsive, keyboard, focus, loading, failure and accessibility reviews.
9. Run technical UAT, then client business UAT for the complete Recruitment-to-Active lifecycle.

## UI release decision

**Do not enable Recruitment or Public Careers in production yet.**

UI approval requires all P1 findings closed, lint and release gates green, secure backend email/token integration, real Turnstile verification, a passing real-API Playwright persona and client sign-off on the complete flow.
