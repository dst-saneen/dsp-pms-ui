# Project Lite Remediation Phases

**Source:** `project-lite-latest-code-review-and-fix-plan.md`  
**Decision until Gate 5:** keep `PROJECTS_LITE_ENABLED=false` for every Company  
**Rule:** Do not apply Project migrations to shared DB until Office Finance migration order is reconciled + disposable rehearsals pass.  
**Phases 3–8 code record:** `docs/development/project-lite-phases-3-8-completion-record.md`

---

## Phase 0 — Containment

**Status:** DONE — see `docs/development/project-lite-phase0-containment-record.md` (2026-08-21)

---

## Phase 1 — P0 receipt + company scope

**Status:** DONE in code (2026-08-21)

---

## Phase 2 — P0 legacy surfaces + build gates

**Status:** DONE in code (2026-08-21)

---

## Phase 3 — P0 executable UI flow

**Maps to:** Gate 1 UI · PRJ-P0-05, PRJ-P0-06  
**Status:** DONE in code (2026-08-21) — keep Lite disabled

- [x] Capability-driven create/edit: name, type, PM candidates, dates, description
- [x] Client type blocked until Business Party; only INTERNAL when Finance/BP unavailable
- [x] `EDIT` + lifecycle from server `allowedActions`; activation preflight blockers
- [x] PM task actions: assign / reassign / return / complete / cancel / start / submit (from `allowedActions`)
- [x] Never infer actions from role names

**Exit:** Internal create → edit → activate; PM assign/review path usable from UI (with Lite enabled in disposable env).

---

## Phase 4 — P1 database integrity

**Maps to:** Gate 2 · §6 · PRJ-P1-01…03 (+ DB parts of 06)  
**Status:** DONE in code (2026-08-21) — migration **not** applied to shared DB

- [x] Preflight fail-closed + exact counts + sampleIds; CLI nonzero on blockers
- [ ] Company-qualified unique keys / composite FKs (partial from earlier contract; remaining deferred to disposable reconcile)
- [x] Daily-hours concurrency-safe (TX `FOR UPDATE` + trigger backstop)
- [x] Terminal Work Log immutability (`20260821170000_project_lite_p1_integrity`)
- [x] Typed submission/review written on submit/return/complete paths
- [ ] Disposable PG: from-zero + upgrade rehearsal + catalog definition checks (**Phase 8**)

**Exit:** disposable migration rehearsals + concurrency hour tests pass (ops).

---

## Phase 5 — P1 backend domain completion

**Maps to:** Gate 3 · §7 · PRJ-P1-04…10  
**Status:** DONE in code (2026-08-21) — keep Lite disabled

- [x] Lifecycle activate preconditions (PM+user, startDate, stage, Client blocked)
- [x] Record-level Project Manager authority for nested manage / assign
- [x] Immutable submission/review rounds on nested APIs
- [x] HMAC receipt canonicalization + key version fail-closed when Lite enabled
- [ ] Timesheet effective-date / timezone / manager eligibility (XOR + manager snapshot exist; TZ polish deferred)
- [ ] Notification recipient revalidation + due-soon/overdue reminders (enqueue path exists; reminder worker deferred)
- [x] Finance seam: `enabled:false`; block Client activation until Office Finance

**Exit:** API persona + concurrency suites assert DB/audit/outbox (**Phase 8**).

---

## Phase 6 — P1 frontend completion

**Maps to:** Gate 4 · §8 · PRJ-P1-11  
**Status:** DONE in code (2026-08-21)

- [x] `GET /projects/workspace-capabilities` + create gating
- [x] Detail tabs including Documents with server actions
- [x] Timesheet Task/Category XOR UI + input preservation on error
- [x] Team name projections; remaining distinct-count / branch-TZ polish light
- [x] Input-preservation behavior on timesheet errors

**Exit:** frontend usable against API; Playwright personas (**Phase 8**).

---

## Phase 7 — P2 polish

**Maps to:** §9 · PRJ-P2-01…03  
**Status:** DONE in code for query DTOs (2026-08-21); remaining P2 items deferred

- [x] Query DTO enums, paging, sort allowlists
- [ ] Integrity checks via `pg_get_*` definitions (not names only) — deferred
- [ ] Align FileUploadSession indexes in Prisma — deferred
- [ ] UI paging/filters a11y polish — deferred

---

## Phase 8 — Evidence package + controlled enablement

**Maps to:** Gate 5 · §10–12  
**Status:** PARTIAL — unit evidence added; real PG / Playwright / UAT **not** done. **NO-GO** for enablement.

- [x] Backend unit/service evidence for Phases 1–2, 5 HMAC/PM, preflight
- [ ] Real PG migration + concurrency evidence
- [ ] API personas + Playwright personas recorded
- [ ] UAT migrate only after backup + checklist
- [ ] Technical + business sign-off on one commit
- [ ] Then (and only then) set allowlist + `PROJECTS_LITE_ENABLED=true` for pilot Company

**Exit:** production acceptance criteria in §12 all true.

---

## How to run

Ops still must not enable Lite or migrate shared RDS until Phase 8 checklist is green. See `project-lite-phases-3-8-completion-record.md`.
