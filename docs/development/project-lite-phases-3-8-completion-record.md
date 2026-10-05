/**
 * Project Lite remediation Phases 3–8 completion record (2026-08-21).
 *
 * Feature remains DISABLED until Gate 5 / Phase 8 controlled enablement:
 * `PROJECTS_LITE_ENABLED=false`, empty company allowlist.
 * Do not `migrate deploy` Project Lite onto shared AWS RDS until Office Finance
 * migration history is reconciled into this branch.
 */

## Phase 3 — P0 executable UI (DONE in code)

- Create: INTERNAL-only, PM candidates, dates, description; capabilities gate
- Detail: EDIT from `allowedActions`; activation preflight before Activate
- Tasks: assign/reassign/return/complete/cancel/start/submit from `allowedActions` only
- Backend: `GET /projects/workspace-capabilities`, `GET /projects/manager-candidates`,
  `GET /projects/:id/activation-preflight`

## Phase 4 — P1 database integrity (DONE in code; not applied to shared DB)

- Migration: `20260821170000_project_lite_p1_integrity`
  - Terminal work-log header/line immutability triggers
  - Daily-hours trigger backstop
- App TX: `FOR UPDATE` on work log header before line mutations
- Preflight: more checks blocking; exact `COUNT(*)` + `sampleIds`

## Phase 5 — P1 backend domain (DONE in code)

- Activate preconditions: PM+active user, startDate, ≥1 stage, Client blocked
- CLIENT create blocked until Business Party / Office Finance
- PM-only assign/reassign/unassign; ACTIVE nested manage via record PM
- submit-review creates `TaskSubmission`; return/complete create `TaskReview` rounds
- Receipt HMAC canonicalization + `PROJECTS_IDEMPOTENCY_HMAC_*` (required when Lite on)
- Finance summary remains `enabled: false`

## Phase 6 — P1 frontend (DONE in code)

- Workspace capabilities hook + create gating
- Documents tab; team displayName; timesheet Task/Category XOR with input preserve

## Phase 7 — P2 polish (DONE in code)

- `SearchProjectsDto`: `@IsEnum` status, sortBy/sortDir allowlist, page/limit ints

## Phase 8 — Evidence + controlled enablement (PARTIAL)

### Completed in this branch

- Unit/foundation suites for Phases 1–2, preflight, HMAC/PM authority
- Containment: Lite remains off

### Still required before any enablement (ops / disposable env)

- [ ] Pull/reconcile Office Finance migrations (`20260821120000`… clash) into this branch
- [ ] Disposable PG: from-zero + upgrade rehearsal of all Project Lite migrations
- [ ] Real-DB concurrency proof for daily hours + receipt trigger
- [ ] API persona suites + Playwright (mock off) for Internal create→activate→PM assign→review
- [ ] UAT sign-off, DB backup, then allowlist enable one Company only

**Decision:** NO-GO for production enablement until the checklist above is green.
**/
