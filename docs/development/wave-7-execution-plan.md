# Wave 7 — Recruitment execution plan

**Source:** Excel `W7 Recruitment` (REC-001…REC-008)  
**Baseline:** Waves 0–6 engineering done. Recruitment already has many pages — Wave 7 hardens them for production and closes gaps.  
**Your deploy:** Feature flags, S3/ClamAV, email/delivery (`ENV-002`) stay with you. Engineering delivers code + exit evidence.

Mirror prior waves: full pages for major edit, dialogs only for short confirms, URL filters + server paging where required, honest provider states.

```text
REC-001 → REC-002 → REC-003 → REC-004 → REC-005 → REC-006 → REC-007 → REC-008 → exit
```

---

## What Wave 7 is (simple)

| Area | Today | After Wave 7 |
|---|---|---|
| Flags / mock | Easy to misconfigure; mock opt-in | Prod rejects unsafe settings; mock never in prod |
| Job openings | Pages + checklist exist | Clearer sections, sticky save, unsaved warn, publish blockers linked |
| Public apply | Careers pages exist | Accessible steps, scan recovery, safe receipt |
| Applications | Detail + next action partial | Command center + server paging + URL filters |
| Interviews | List page; schedule via dialogs | Dedicated detail/evaluate routes; no silent reschedule |
| Hiring decision | Components exist, **not routed** | Routed queue + readiness gate |
| Offers / delivery | Pages exist; retry uses `window.prompt` | Full offer detail; reason dialogs; delivery history |
| Convert to employee | Dialog + preflight | Idempotent conversion + clear outcomes / remediation |

---

## Phase map (execute in order)

| Phase | Tasks | Intent | Priority | Status |
|---|---|---|---|---|
| **S** | REC-001 | Production flag matrix; mock=false forced; menu/API consistency | P0 | **Done** |
| **T** | REC-002 | Opening form sections + sticky actions + checklist → fields | P1 | **Done** |
| **U** | REC-003 | Public careers apply polish + upload/scan honesty | P0 | **Done** |
| **V** | REC-004 | Applications server paging + URL filters + next-action clarity | P1 | **Done** |
| **W** | REC-005 | Interview detail/evaluate pages; separate Schedule vs Reschedule | P1 | **Done** |
| **X** | REC-006 | Wire hiring-decision workspace; readiness summary before select | P1 | **Done** |
| **Y** | REC-007 | Offer detail page; replace delivery `prompt` with reason dialog | P0 | **Done** |
| **Z** | REC-008 | Conversion preflight + idempotent receipt + invitation/onboarding links | P0 | **Done** |
| **AA** | Exit gate | Checklists + `wave-7-exit-record.md` | — | **Done** |

Do **not** reorder (Excel chain REC-001→008).

---

## Phase S — REC-001 (production flags)

**Status:** Done (engineering). Live flag values remain your deploy (ENV-002).

**Touch:** `frontend/features/recruitment/constants/feature-flags.ts`, `backend/src/config/environment.ts`, recruitment feature gate / mock banner, nav Delivery gate.

**Work:**
- Document exact prod matrix: `RECRUITMENT_ENABLED`, `PUBLIC_CAREERS_ENABLED`, mock off, shortlist/delivery gates as Excel requires → [`rec-001-recruitment-flag-matrix.md`](./rec-001-recruitment-flag-matrix.md)
- Boot/startup rejects unsafe or missing prod settings where backend already validates
- Ensure mock banner + mock data cannot appear when `NODE_ENV=production`
- Enabled vs disabled scopes: consistent empty menu + API fail-closed

**Exit:** Prod cannot start with mock on; disabled scopes match UI and API.

**Your deploy:** Set live flags in production env.

---

## Phase T — REC-002 (openings form)

**Status:** Done

**Touch:** `job-opening-editor.tsx`, `job-opening-form.tsx`, publication checklist panel.

**Work:**
- Section the form: role, organization, hiring, dates, criteria
- Sticky Save/Cancel + `useUnsavedChanges`
- Checklist items deep-link / highlight invalid fields
- Publish remains server-gated; failures keep form data

**Exit:** Draft resumable; Publish impossible until checklist passes.

---

## Phase U — REC-003 (public careers)

**Status:** Done (engineering). ClamAV/S3 + optional Turnstile live proof remain your deploy.

**Touch:** `frontend/app/careers/`, public application form, recruitment document upload/scan.

**Work:**
- Accessible multi-step apply; required-file guidance; consent/privacy copy
- Upload/scan recovery aligned with Wave 6 DOC-002 patterns
- Success receipt without internal IDs
- Only open + in-date published jobs accept applications; recoverable duplicate/rate-limit/file errors

**Exit:** Safe public apply with honest file/provider states.

**Your deploy:** ClamAV/S3 + optional Turnstile live proof.

---

## Phase V — REC-004 (applications)

**Status:** Done

**Touch:** applications workspace + editor/detail.

**Work:**
- Server paging + totals (stop fixed `limit: 100` only)
- URL-persisted filters (status, opening, branch, dates, search)
- Detail as command center: lifecycle stepper, current owner, **one** next action (or terminal explanation), linked interview/offer
- Unauthorized transitions hidden + API rejected

**Exit:** Filters survive refresh; next action unambiguous.

---

## Phase W — REC-005 (interviews)

**Status:** Done

**Touch:** interview dialogs + application interviews panel; add `/hr/recruitment/interviews/[id]` (evaluate as needed).

**Work:**
- Dedicated interview detail + evaluation page
- Keep only short cancel/confirm dialogs
- Separate Schedule / Reschedule / Complete / Evaluate — row click never silently opens Reschedule
- Panel/lead ownership visible; only assigned panel edits evaluation; submitted = read-only

**Exit:** No confusing row→reschedule; evaluations ownership-safe.

---

## Phase X — REC-006 (hiring decision)

**Status:** Done (engineering).

**Touch:** `hiring-decisions-workspace.tsx` / comparison view; routes; application command center.

**Work:**
- Mounted queue at `/hr/recruitment/hiring-decisions` and comparison at `/hr/recruitment/hiring-decisions/[openingId]`
- Decision-readiness summary: required interviews, submitted evals, scores, headcount, decision owner
- Select gated on READY_FOR_DECISION + assigned hiring manager + available headcount (reject still allowed when headcount is exhausted)
- Nav + recruitment dashboard + application primary action link into the workspace

**Exit:** Comparison + decide is a single gated flow on a reachable page.

---

## Phase Y — REC-007 (offers + delivery)

**Status:** Done (engineering). Live email delivery proof remains your deploy.

**Touch:** offer panels/dialogs, `/hr/recruitment/offers/[id]`, `/hr/recruitment/delivery`, admin delivery ops, `/offer-response`.

**Work:**
- Full-page offer detail/composer at `/hr/recruitment/offers/[id]` with staged UI (compose & send approval, delivery, candidate response, signature)
- Application Offer tab thinned to embedded summary + deep link
- Replaced all delivery `window.prompt` retries/cancels with `DeliveryReasonDialog` + attempt history on detail pages
- Offer delivery retry requires a reason; mock reissue invalidates prior candidate tokens (one valid link)
- Candidate expired/replayed links already fail safely; accept remains single-consume

**Exit:** Offer + delivery operable without browser prompts; safe candidate response.

---

## Phase Z — REC-008 (convert to employee)

**Status:** Done (engineering). Onboarding deep handoff soft-links to Wave 6 employee + `/hr/employee-onboarding/{id}` until Wave 8.

**Touch:** ready-to-hire panel/dialog, conversion APIs/mappers, invitation retry.

**Work:**
- Preflight checklist shows remediation links for blocked/warning checks (offer, opening, templates, users, document types)
- Convert uses `operationId` command receipt in mock — repeat submit → one Employee + one career seed; live API remains state-idempotent on `application.employeeId` and repairs invitation delivery on replay
- Explicit outcome card: Employee / User-invitation state + onboarding and career handoff links
- Failed invitation retryable via security resend (when `userId` known) or idempotent convert repair — no duplicate employee/invitation

**Exit:** Safe convert; remediation links when blocked.

---

## Phase AA — Wave 7 exit

**Status:** Done (engineering). Live ENV-002 proof remains your deploy.

| Check | Evidence |
|---|---|
| Prod flags / no mock | Startup + UI note |
| Opening publish checklist | Smoke |
| Public apply + scan states | Deploy-time with your providers |
| Applications paging + next action | Checklist |
| Interview detail (no silent reschedule) | Smoke |
| Hiring decision routed + gated | Smoke |
| Offer delivery reason dialog | Smoke |
| Convert hire idempotent | Smoke / API note |

Deliverable: [`wave-7-exit-record.md`](./wave-7-exit-record.md)

**Wave 7 complete when:** REC-001…008 code done, exit record filled, you can deploy with recruitment + storage + email enabled.

---

## Wave 7 engineering complete

All phases S–AA are **Done (engineering)**. Next waves (Onboarding, Workforce, Attendance, Leave, …) start only when you ask.
