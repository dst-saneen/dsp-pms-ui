# Recruitment UI — remaining work for Jebin (after Phase A)

## Purpose

Frontend Phase A is **done**. This file lists only the **remaining UI work** so backend + leftover frontend can be finished in one place without re-reading the full manager review.

- Contract: [`recruitment-to-onboarding-ui-plan.md`](./recruitment-to-onboarding-ui-plan.md)
- Full UI review (context): [`recruitment-to-onboarding-ui-code-review.md`](./recruitment-to-onboarding-ui-code-review.md)
- Full API review (your blockers): [`recruitment-to-onboarding-api-code-review.md`](./recruitment-to-onboarding-api-code-review.md)

**Do not enable Recruitment / Public Careers in production until P1 API + remaining UI P1s below are closed.**

---

## Already completed (Phase A) — do not redo

| Item | What was done |
|------|----------------|
| **UI-01** Mock default | Mock is **off** unless `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=true`, and **never** on in production. Amber banner when mock is on. Tests in `frontend/features/recruitment/constants/feature-flags.test.ts`. |
| **UI-02** Offer token storage | Removed `sessionStorage` offer-link helpers. HR no longer builds/stores/displays raw candidate response tokens/URLs after send. |
| **UI-09** Lint errors (4) | Fixed set-state-in-effect on applications pages, confirm-active dialog remount, empty `CreateOfferDraftDto` interface. |

Useful touchpoints after Phase A:

- `frontend/features/recruitment/constants/feature-flags.ts`
- `frontend/features/recruitment/components/recruitment-mock-banner.tsx`
- `frontend/features/recruitment/offers/services/offer-service.ts`
- `frontend/features/recruitment/offers/components/candidate-offer-response-link.tsx` → delivery notice only (no token URL)
- `frontend/features/recruitment/offers/components/application-offer-panel.tsx`

Local live API: omit mock flag or set `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false`. Playwright still forces mock=`true` for smoke — change that in Phase D below.

---

## Remaining UI work (your list)

Work in this order. Many items **wait on API P1/P2** from the API code review.

### Phase B — Public security + offer delivery UI (P1)

Depends on: API anti-abuse contract, Candidate email delivery, delivery status / retry (API-08 and related).

| ID | Work | Notes / files |
|----|------|----------------|
| **UI-03** | Replace Turnstile **Simulate verification** with real Turnstile client | `frontend/features/recruitment/careers/components/turnstile-field.tsx` — success / expiry / error / reset; **no** sim button in production builds. Server must verify the token (client alone is not security). |
| **UI-04** | Wire honeypot + Turnstile + idempotency to the **finalized** public apply API | `frontend/features/recruitment/careers/services/careers-service.ts`, public application form. Map rate-limit / abuse errors safely (no Candidate enumeration). Verify against **real** API, not mock. |
| **UI-05** | Offer Send / Retry UI driven only by **persisted delivery status** from API | Panel already shows delivery notice; finish when API returns queued / sent / failed / retry-available. No HR handoff of candidate token. Toasts in `offers/hooks/use-offers.ts`. Remove or keep **dev-mock-only** response link gated by `isRecruitmentMockEnabled()`. |

### Phase C — Contract polish (P2)

Depends on: API-10 terminal offer states, API-11 probation permission, API-12 career events.

| ID | Work | Notes / files |
|----|------|----------------|
| **UI-06** | Public offer-response: render sanitized terminal states from API | Expired / revoked / already-responded vs invalid. Do **not** invent state from HTTP status or local storage alone. `frontend/features/recruitment/offer-response/` |
| **UI-07** | Probation early override only when API/permission allows | Hide early confirm for normal HR; require structured reason + warning when authorized. `frontend/features/employee-career/` (confirm active / career services). |
| **UI-08** | Career tab = backend events only | No client-inferred milestones. Separate HR vs employee-sanitized projections from API. Hide scores / notes / compensation from employee self-service. |

Also clear remaining **lint warnings** (React Compiler / hook deps) if still failing the release gate — review said fix errors first (done); clear warnings rather than blanket suppress.

### Phase D — Release gates

Depends on: API P1 closed, disposable DB, email/storage/ClamAV configured.

| Work | Detail |
|------|--------|
| Gates | TypeScript, ESLint, unit/component tests, production build — all green. |
| Playwright | Stop relying on mock-only smoke as acceptance. Point suite at **real API** + disposable DB. Implement the **12-step persona** flow from the UI review (create opening → apply → interview → evaluate → select → offer email → accept → convert → invite → onboarding → probation → active). Extra: unauthorized URLs, token replay, failed delivery/retry, file rejection, a11y/keyboard, confidential timeline. |
| UAT | Responsive + a11y review; technical then client business UAT for full Recruitment → Active. |

---

## Suggested order for you

```text
1. Finish API P1s (scope, conversion, CV, documents, email/notifications)
2. UI Phase B (Turnstile + public apply contract + delivery status UI)
3. API P2 (offer terminal states, probation auth, career events)
4. UI Phase C (consume those contracts)
5. UI Phase D (real Playwright + gates + UAT)
```

---

## What “done” looks like for remaining UI

- No production Turnstile simulation; public apply protected end-to-end with server verification.
- HR offer screens never show or store raw response tokens; delivery/retry matches API.
- Offer-response and career/probation UIs match server projections only.
- Lint/TS/build green; Playwright proves full flow on real API (not mock-only smoke).
- Product sign-off on Recruitment → Active; flags still off until that passes.

---

## Out of scope for this handoff

- Department onboarding inbox / head-assign flow (`docs/product/onboarding-department-flow-gap-explained.md`) — separate product track after Recruitment release.
- Reworking Phase A mock/token/lint fixes unless a regression appears.
