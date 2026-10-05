# Wave 2 remainder → Wave 5 execution plan

**Sources**
- Excel: [`docs/reference/production-fix-improvement-plan-2026-09-09.xlsx`](../reference/production-fix-improvement-plan-2026-09-09.xlsx) (Master Tasks)
- Prior plan: `docs/development/wave-0-to-wave-2-execution-plan.md`
- Freeze templates: `wave-2-phase-e-uat-runbook.md`, `wave-2-freeze-record.md`

**Goal through Wave 5**  
Close Wave 2 exit gate → harden entry/onboarding (W3) → Dashboard + My Workspace (W4) → Admin masters + Users/Roles pages (W5).

**Out of scope until Wave 5 exit:** W6+ (Employees, Recruitment, Attendance, Leave UI waves, etc.).

---

## Current baseline (2026-09-15)

| Area | Status |
|---|---|
| Wave 0 CFG / Designation-Onboarding defects (Phases A–B) | **Code done** (W0-11 deferred) |
| Wave 1 shared UX (Phase C) | **Done** |
| Wave 2 Designation pages DES-01…DES-06 (Phase D) | **Code done** |
| Wave 2 DES-07 live UAT + Phase E freeze/ENV | **Phase F done (conditional)** — freeze `93eeeb1…` / tag `wave2-uat-freeze`; engineering DES-07 Pass; ENV-001 + persona browser still pending manager |
| Wave 3 (Phase G) AUTH/ORG | **Code done** |
| Wave 4 (Phase H) Dashboard / My Workspace | **Code done** |
| Wave 5 Admin masters (Phase I) ADM-01…04 | **Code done** — readiness panel + Companies/Branches/Departments `/new` `/edit` pages |
| Wave 5 Security (Phase J) Users / Roles | **Code done** — invite/access/role pages + effective-access summary + assignment audit before/after |
| Wave 5 exit (Phase K) | **Done (engineering Conditional Pass)** — `docs/development/wave-5-exit-record.md`; W6+ may open; browser/ENV still pending manager |

---

## Phase map (execute in order)

```
Phase F   Close Wave 2          DES-07 + REL-001 + ENV checklist (pragmatic)
Phase G   Wave 3 Entry          AUTH-01 → ORG-01 → ORG-02 → ORG-03 → ORG-04
Phase H   Wave 4 Workspace      DASH-01 → DASH-02 → MY-01 → MY-02
Phase I   Wave 5 Admin masters  ADM-01 → ADM-02 → ADM-03 → ADM-04
Phase J   Wave 5 Security       SEC-01 → SEC-02 → SEC-03
Phase K   Wave 5 exit gate      Targeted UAT + evidence pack for W3–W5
```

Do **not** start Phase G until Phase F exit is agreed (even if UAT is “dev/local evidence” rather than full isolated prod stack — see pragmatism note).

---

## Pragmatism note (Phase F)

Full Excel ENV-001/002 (isolated prod-like UAT, secret store, ClamAV, two tenants) needs **ops**. For “complete up to Wave 5” in this engineering track:

| Must do in Phase F | Can defer with explicit note |
|---|---|
| Commit/tag a freeze SHA for A–D (REL-001 identity) | Full disposable prod-like stack if ops unavailable |
| Run DES-07 checklist on current/dev UAT and record pass/fail | OBS-001 / REL-002 backup rehearsal |
| CFG-001 three profiles documented + smoke where possible | Live Delivery provider send |

Manager must still accept that W3+ proceeds on this evidence level.

---

## Phase F — Close Wave 2

**Intent:** Stop treating Wave 2 as “code done, gate open.” Record one SHA and DES-07 evidence.

| ID | Work | Exit |
|---|---|---|
| **F1** | Commit remaining A–D work if dirty; record SHA in `wave-2-freeze-record.md`; optional tag `wave2-uat-freeze` | One SHA identity |
| **F2** | Execute `wave-2-designation-pilot-uat.md` (DES-07) on available env | Checklist filled |
| **F3** | Smoke CFG profiles from `cfg-001-feature-gate-profiles.md` as far as env allows | Notes in freeze record |
| **F4** | Decision line: proceed W3+ Yes/No | Written in freeze record |

**Phase F exit:** Freeze record has SHA + DES-07 result + proceed flag.

---

## Phase G — Wave 3 Entry and organization

**Intent:** After login/register/setup, users do not lose destination; org setup is resumable; first Dashboard is trustworthy.

| ID | Task | Concrete work | Exit |
|---|---|---|---|
| **AUTH-01** | Preserve `next` / return destination | Validated internal redirect through login, password-change, org onboarding; Dashboard fallback; block open redirects | Original permitted route restored |
| **ORG-01** | Clarify onboarding steps | Rename/remove empty “Team” pass-through; explain Company Group / Company / Branch prerequisites; progress count = real work | Each step says what/optional/next |
| **ORG-02** | Resumable structure setup | Server-confirmed step state; item-specific retry; no duplicate creates on refresh | Fail mid-flow → resume safely |
| **ORG-03** | Founding Employee linkage UX | Distinct awaiting / repair / support-code states; safe idempotent retry | Visible failure + repair path |
| **ORG-04** | Refresh context before Dashboard | Reload auth session, module capabilities, owner Employee before first shell; readiness for blocked modules | No silent missing menus |

**Phase G exit:** Auth redirect safe; onboarding resumable; post-setup Dashboard correct without hard reload.

**Status (2026-09-15):** Implemented AUTH-01 → ORG-04 in code.
- AUTH-01: `frontend/lib/auth-next-path.ts` + login / change-password / AuthenticatedApp
- ORG-01: hub copy, level guide, Team → “After you open / Invite later”
- ORG-02: server `currentStep` sync + create preflight (no duplicate when already done)
- ORG-03: `ownerEmployeeLink` + `POST /organization-onboarding/repair-owner-employee` + My Workspace repair CTA
- ORG-04: `refreshSession` + invalidate module capabilities before Dashboard

**Suggested order:** AUTH-01 → ORG-01 → ORG-02 → ORG-03 → ORG-04.

---

## Phase H — Wave 4 Dashboard and My Workspace

**Intent:** Persona-relevant work entry; honest empty vs error; Overview not a junk drawer.

| ID | Task | Concrete work | Exit |
|---|---|---|---|
| **DASH-01** | Persona widgets + deep links | Compose by permission/capability; KPI → scoped filtered queue | Actionable counts match destinations |
| **DASH-02** | Per-widget availability metadata | API/UI distinguish empty / not enabled / not authorized / error+Retry | One widget failure does not blank others |
| **MY-01** | Slim Overview | Today + urgent only; histories stay on child routes | Short priority sequence |
| **MY-02** | Employee-link / capability states | Distinct messages + permitted actions only | No fake repair for unauthorized users |

**Phase H exit:** Dashboard and Overview honest and persona-scoped; child URLs unchanged.

**Status (2026-09-15):** Implemented DASH-02 → DASH-01 → MY-02 → MY-01.
- DASH-02: per-widget `ok|empty|not_enabled|not_authorized|error` in data-provider + `DashboardWidgetShell`
- DASH-01: KPI/pending deep links; persona hide for onboarding/leave/timesheets widgets
- MY-02: owner link states AWAITING_SETUP / NEEDS_REPAIR / Retry; no fake repair for others
- MY-01: Overview trimmed to Today + urgent + quick links into existing `/my-workspace/*` children

**Suggested order:** DASH-02 (honesty) → DASH-01 (links) → MY-02 → MY-01 (or MY-02 with ORG-03 if overlapping).

---

## Phase I — Wave 5 Administration masters

**Intent:** Same dedicated-page pattern as Designation for Company / Branch / Department; readiness checklist.

Reuse: `EntityFormPage`, breadcrumbs, unsaved warning, `PermissionGate`, Designation page patterns.

| ID | Task | Concrete work | Exit |
|---|---|---|---|
| **ADM-01** | Admin readiness panel | Lightweight checklist: Company Group → Company → Branch → Department → Designation → Shift → Calendar with links | Next missing prerequisite visible |
| **ADM-02** | Companies pages | `/administration/companies/new`, `[id]/edit`; list stays; status destroy = dialog | Direct URL, cancel, unsaved warn |
| **ADM-03** | Branches pages | Full pages; Company explicit; post-create **Configure working days** link to existing sheet/flow | Scope-safe edit |
| **ADM-04** | Departments pages | Full pages; Company then Branch; dependent reset | Filtered list return |

**Phase I exit:** Three masters are pages; readiness panel shipped; drawers removed for create/edit of those masters.

**Status (2026-09-15):** **Done.** `AdminStructureReadiness` on Companies / Branches / Departments / Designations lists; create/edit via dedicated pages (dialogs left unused for those masters; status/destroy may still use dialogs).

**Suggested order:** ADM-01 (cheap orientation) → ADM-02 → ADM-03 → ADM-04 (mirrors Designation dual-entry lessons).

---

## Phase J — Wave 5 Security (Users / Roles)

**Intent:** Invitation and role editing get room; effective-access preview before save.

| ID | Task | Concrete work | Exit |
|---|---|---|---|
| **SEC-01** | Users invite / access pages | Full pages for invite + access edit; revoke/session = dialogs | Linkage/roles/scope reviewed pre-submit |
| **SEC-02** | Roles full-page editor | Searchable, module-grouped permissions; system roles protected | No mutate system roles |
| **SEC-03** | Effective-access summary | Before save: human summary of Companies/Branches, role delta, session revoke; audit before/after | Preview matches post-save authz |

**Phase J exit:** Users/Roles no longer sheet-only for major edits; SEC-03 preview + audit evidence.

**Status (2026-09-15):** **Done.** Roles `/administration/security/new` + `[id]/edit` (searchable permissions; system roles blocked); Users invite `/administration/users/new` + access `/users/[id]/access`; sessions stay as sheet; client effective-access summary; assignment replace audits before/after snapshots.

**Suggested order:** SEC-02 (permission chrome) → SEC-01 → SEC-03 (preview depends on both).

---

## Phase K — Wave 5 exit gate

| Check | Evidence |
|---|---|
| AUTH-01 redirect matrix (login → intended route) | Short checklist |
| Org setup resume after forced mid-step failure | Note in evidence doc |
| Dashboard widget empty vs error | Screenshot or UAT note |
| Companies/Branches/Departments page create/edit smoke | DES-style checklist |
| Users invite + role edit + access summary | Checklist |
| Same freeze SHA or follow-on SHA recorded | `wave-5-exit-record.md` (create when executing K) |

**Phase K exit:** W3–W5 marked complete for engineering; manager can open W6+.

**Status (2026-09-15):** **Done (Conditional Pass).** Evidence: `docs/development/wave-5-exit-record.md`. Local health + typecheck + AUTH-01 unit tests Pass; browser/ENV-001 still pending. W3–W5 product SHA pending commit (backfill on tag `wave5-engineering-exit`).

---

## Dependency diagram

```
[Wave 2 code A–D]
        │
        ▼
   Phase F (DES-07 + freeze)
        │
        ▼
   Phase G  AUTH-01 ─► ORG-01 ─► ORG-02 ─► ORG-03 ─► ORG-04
        │                                      │
        │                                      └──► feeds MY-02 / DASH readiness
        ▼
   Phase H  DASH-02 ─► DASH-01 ─► MY-02 ─► MY-01
        │
        ▼
   Phase I  ADM-01 ─► ADM-02 ─► ADM-03 ─► ADM-04
        │
        ▼
   Phase J  SEC-02 ─► SEC-01 ─► SEC-03
        │
        ▼
   Phase K  exit evidence → W6+
```

---

## Recommended daily slices

| Slice | Deliverables |
|---|---|
| **Day 1** | Phase F (freeze + DES-07 as far as env allows) + start AUTH-01 |
| **Day 2** | Finish Phase G (ORG-01…04) |
| **Day 3** | Phase H (DASH + MY) |
| **Day 4** | Phase I (ADM-01…04) |
| **Day 5** | Phase J (SEC-01…03) + Phase K evidence |

Adjust if DES-07/ops or Security pages take longer — **do not reorder phases**.

---

## Definition of “Wave 5 complete”

1. Wave 2 freeze identity + DES-07 result recorded.  
2. AUTH-01 + ORG-01…04 acceptance criteria met.  
3. Dashboard/My Workspace distinguish empty vs error; persona links work.  
4. Companies, Branches, Departments create/edit are dedicated pages.  
5. Users invite/access and Roles edit are dedicated pages with effective-access preview.  
6. Phase K evidence pack exists; W6+ not started until you say so.

**Engineering (2026-09-15):** Items 1–6 satisfied for code + Phase K pack (Conditional Pass). Manager live UAT and commit/tag of W3–W5 SHA remain open — see `wave-5-exit-record.md`.

---

## How we start

Reply with one of:
- `execute Phase F` — close Wave 2 first (**recommended**)
- `execute Phase F then G` — freeze + Wave 3
- `execute through Wave 5` — run F→K in order without stopping for per-phase prompts (still pause only on blockers)

Default: **`execute Phase F`**.
