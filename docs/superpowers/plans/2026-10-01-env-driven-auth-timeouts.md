# Environment-Controlled Auth Timeouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make future authentication timeout increases configurable through environment variables without changing source code for each increase.

**Architecture:** Replace the small fixed ceilings for the four authentication timeout settings with auth-specific duration validation. Validate whole seconds, safe arithmetic, representable expiry dates, and relationships between durations. Continue loading settings at backend startup and using the existing JWT, session, and refresh-cookie consumers.

**Tech Stack:** NestJS, TypeScript, dotenv, Jest, existing ConfigService and SessionService.

**Spec:** This chat's request for future environment-controlled increases. The current requested settings are a two-hour access token, four-hour idle timeout, twelve-hour absolute session, and thirty-minute activity-write interval. This document is a proposed implementation plan; it does not apply those settings.

## Global Constraints

- Environment values remain numeric seconds; human-readable values such as `2 hour` are not accepted.
- Preserve fallback defaults when variables are omitted: access 600, idle 1800, absolute 43200, activity interval 300 seconds.
- Preserve current minimums: access 60, idle 300, activity interval 30 seconds.
- Require idle timeout to be no greater than absolute timeout.
- Require activity-write interval to be strictly smaller than idle timeout, so ordinary requests can extend an active session before it expires.
- Reject unsafe numeric values and durations that cannot produce a valid expiry date. These are technical bounds, not short business-policy ceilings.
- Limit changes to authentication duration validation and its documentation/tests; retain validation limits for unrelated configuration.
- Do not implement runtime configuration reload, database migrations, or automatic extensions of existing sessions.

## Review Focus

- Longer TTLs must survive validation and reach ConfigService as numbers.
- Omitted/blank values must preserve defaults; nonnumeric, fractional, nonfinite, and unsafe integer inputs must be rejected.
- Cross-setting combinations must not allow idle expiry beyond absolute expiry or an activity-write interval too long to extend an idle session.
- Large otherwise numeric durations must not overflow expiry-date construction.
- Updating configuration must not suggest that an already-issued JWT or stored absolute session deadline is extended automatically.

## Task 1: Allow Future Auth Duration Increases

**Files:**
- Modify: `backend/src/config/environment.ts`.
- Test: `backend/test/foundation/environment.spec.ts`.

**Interfaces:**
- Consumes: `validateEnvironment(config: Record<string, unknown>): Environment` and the four existing environment keys.
- Produces: the same numeric Environment fields, now supporting longer durations within technical bounds.
- Add an internal `readAuthDuration(config: Record<string, unknown>, key: string, defaultValue: number, minimum: number): number` helper. Preserve omitted/blank-value default handling while checking safe whole seconds. Keep the existing `readInteger` helper and unrelated callers unchanged.

- [ ] **Step 1: Add focused validation tests.** Test the requested values `7200 / 14400 / 43200 / 1800`; a future valid combination `86400 / 604800 / 1209600 / 300`; unchanged defaults for omitted/blank values; invalid duration strings such as `2 hour`; fractions, nonfinite and unsafe integers; values below the preserved minimums; idle greater than absolute; activity interval greater than or equal to idle; and expiry-date overflow. Exercise `validateEnvironment` directly using the existing valid fixture.
- [ ] **Step 2: Verify longer settings fail under the existing fixed ceilings.** From `backend`, run `pnpm.cmd exec jest --config ./test/jest-foundation.json --runInBand --runTestsByPath test/foundation/environment.spec.ts`. Confirm the failure comes from the existing auth range validation.
- [ ] **Step 3: Implement auth-specific duration validation.** Read access, idle, absolute and activity intervals once. Validate integer safety and the stated relationships. Use the absolute duration to verify that `Date.now() + duration * 1000` produces a finite, representable future expiry; check access expiry separately too. Remove the fixed one-hour access, one-day idle and thirty-day absolute ceilings for these auth readers. Return the validated values through the existing Environment fields.
- [ ] **Step 4: Run the focused environment tests again.** Expect all cases to pass and existing default/template checks to remain passing.
- [ ] **Step 5: Confirm the existing auth consumers still use these values.** Inspect JWT signing, session creation/touch/refresh and refresh-cookie maxAge. If longer durations expose a consumer limit, add a reproducing test and fix that limit before claiming support. Run `pnpm.cmd exec jest --config ./test/jest-foundation.json --runInBand --runTestsByPath test/foundation/environment.spec.ts test/foundation/session-rotation.spec.ts test/foundation/auth.controller-cookie.spec.ts` from `backend`; expect all selected suites to pass.

## Task 2: Document and Apply the Requested Settings

**Files:**
- Modify: `backend/.env.example`.
- Modify locally: `backend/.env`, only when this plan is implemented; do not commit secrets or the local environment file.
- Modify: this plan's completion checklist if execution status is recorded.

**Interfaces:**
- Consumes: the validated environment keys from Task 1.
- Produces: documented numeric settings and the requested local configuration.

- [ ] **Step 1: Add comments to `.env.example` explaining seconds, preserved defaults, duration relationships, backend restart requirements and how existing sessions behave.** Keep the template's existing defaults so an omitted variable and the documented baseline stay consistent.
- [ ] **Step 2: Apply only these four local environment values:**

```env
AUTH_ACCESS_TOKEN_TTL_SECONDS=7200
AUTH_SESSION_IDLE_TTL_SECONDS=14400
AUTH_SESSION_ABSOLUTE_TTL_SECONDS=43200
AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS=1800
```

- [ ] **Step 3: Rerun the focused environment suite to confirm the committed template still validates.** Verify the local auth keys without printing unrelated environment values or secrets.
- [ ] **Step 4: Document the future workflow:** edit the four environment values, restart the backend, and sign in again to receive a new access token and a session with the new absolute deadline. Existing JWT expiry claims and stored absolute deadlines do not change retroactively. Idle activity writes use the new interval on subsequent requests, but expired sessions are not revived.
- [ ] **Step 5: Record the requested interval's effect:** thirty-minute activity-write batching means idle expiry can occur up to thirty minutes before four hours have elapsed since the last actual request. Successful refreshes update activity immediately. Changing this interval does not schedule automatic writes while the app is idle.

## Execution Status

- [x] Proposed plan documented.
- [ ] Backend implementation applied.
- [ ] Requested local environment settings applied.
- [ ] Tests verified after implementation.

Use native execution in this chat if implementation is requested; this is a small change with sequential validation and configuration steps.
