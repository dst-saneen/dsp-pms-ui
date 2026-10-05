# Wave 7 — Exit record (Recruitment)

Engineering exit for Excel **W7 Recruitment** (REC-001…008), executed **2026-09-16**.

**Plan:** `docs/development/wave-7-execution-plan.md`  
**Prior:** Waves 0–6 engineering Conditional Pass (`wave-6-exit-record.md`)

---

## Identity

| Field | Value |
|---|---|
| Branch | `UI-SA-150926` |
| Wave 7 product SHA | **Pending commit** — backfill after commit; optional tag `wave7-engineering-exit` |
| Exit date | 2026-09-16 |
| Filled by | Engineering (Phase S–AA) |

---

## Environment smoke

| Check | Result |
|---|---|
| Frontend `tsc --noEmit` | **Pass** |
| Recruitment unit tests (23 files, 65 tests) | **Pass** |
| `window.prompt` in delivery retry/cancel | **Absent** — replaced by `DeliveryReasonDialog` |
| Real flags / S3 / ClamAV / email (ENV-002) | **Your deploy** — matrix in `rec-001-recruitment-flag-matrix.md`; live proof pending |

---

## REC checklist

| ID | Check | Result |
|---|---|---|
| REC-001 | Prod flag matrix; mock forced off; menu/API fail-closed | **Pass (engineering)** — `assertRecruitmentFlagMatrix`; FE mock disabled in production; matrix doc |
| REC-002 | Opening form sections, sticky save, checklist → fields | **Pass (engineering)** — publication checklist focus links |
| REC-003 | Public careers apply; upload/scan honesty; safe receipt | **Pass (engineering)** — deploy-time S3/ClamAV proof pending you |
| REC-004 | Applications server paging + URL filters + command center | **Pass (engineering)** — one primary next action per status |
| REC-005 | Interview detail/evaluate routes; no silent reschedule | **Pass (engineering)** — `/hr/recruitment/interviews/[id]` + evaluate |
| REC-006 | Hiring decision routed + readiness gate | **Pass (engineering)** — `/hr/recruitment/hiring-decisions` + headcount gate |
| REC-007 | Offer detail page; delivery reason dialog; safe candidate response | **Pass (engineering)** — `/hr/recruitment/offers/[id]`; live email proof pending you |
| REC-008 | Convert preflight + idempotent receipt + onboarding handoff | **Pass (engineering)** — remediation links, outcome card, mock `operationId` replay |

---

## Exit gate smoke (Phase AA)

| Check | Evidence |
|---|---|
| Prod flags / no mock | `rec-001-recruitment-flag-matrix.md`; `feature-flags.test.ts`; backend `environment.spec.ts` |
| Opening publish checklist | `publication-checklist*.test.ts`; checklist focus → form fields |
| Public apply + scan states | `safe-public-receipt.test.ts`, `file-validation.test.ts`; **live scan proof = your deploy** |
| Applications paging + next action | `application-actions.test.ts`, `application-navigation.test.ts` |
| Interview detail (no silent reschedule) | `/hr/recruitment/interviews/[id]` + `evaluation-readonly.test.ts` |
| Hiring decision routed + gated | `hiring-readiness.test.ts`; routes `/hr/recruitment/hiring-decisions` |
| Offer delivery reason dialog | `delivery-reason-dialog.test.ts`; no `window.prompt` in repo |
| Convert hire idempotent | `ready-to-hire-mock-store.test.ts`; backend state-idempotent on `application.employeeId` |

---

## Key routes delivered

| Area | Route |
|---|---|
| Hiring decisions queue | `/hr/recruitment/hiring-decisions` |
| Hiring comparison | `/hr/recruitment/hiring-decisions/[openingId]` |
| Offer detail | `/hr/recruitment/offers/[id]` |
| Interview detail | `/hr/recruitment/interviews/[id]` |
| Interview evaluate | `/hr/recruitment/interviews/[id]/evaluate` |
| Delivery (HR) | `/hr/recruitment/delivery` |
| Candidate offer response | `/offer-response?token=…` |

---

## Decision

| Field | Value |
|---|---|
| Engineering W7 result | **Conditional Pass** |
| Proceed to W8+ | **Yes (engineering)** when you ask |
| Hold | Commit W7 SHA; live ENV-002 (flags, S3/ClamAV, email) UAT on your deploy; browser persona UAT |

---

## Simple “what’s new” (frontend)

1. Production recruitment flags are documented and enforced — mock cannot run in prod builds.  
2. Job opening form has clearer sections, sticky save, and checklist items that jump to fields.  
3. Public careers apply is multi-step with honest upload/scan states and a safe success receipt.  
4. Applications list uses server paging + URL filters; detail shows one clear next action.  
5. Interviews have dedicated detail and evaluate pages — row click no longer silently reschedules.  
6. Hiring decisions are on their own route with readiness summary and headcount-gated select.  
7. Offers have a full detail page; delivery retry uses a reason dialog (no browser prompts).  
8. Convert-to-employee shows preflight remediation links, an outcome card, and idempotent replay.

---

## Your deploy checklist (ENV-002)

1. Set backend recruitment + delivery flags per `rec-001-recruitment-flag-matrix.md`.  
2. Rebuild frontend with matching `NEXT_PUBLIC_*` values.  
3. Confirm mock banner absent on production URL.  
4. Prove live email delivery (offer send + invitation after convert).  
5. Prove S3 upload + ClamAV scan on public apply and employee documents.  
6. Optional: enable shortlist / delivery nav when allowlists and providers are ready.
