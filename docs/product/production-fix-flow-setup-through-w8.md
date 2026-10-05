# Production fix story — Setup through W8 (connected guide)

**Who this is for:** You, colleague, and anyone joining late who wonders “did we skip W0–W8?”
**Short answer:** We did **not** skip them. Setup + W0–W7 were mostly **built and engineering-gated earlier**. On this tenant (`PFC-20260917`) the **persona UAT sprint** kicked hard at **W8 Onboarding**, then ran W9→W19. This page ties Setup→W8 into one story with links.

**Master tracker (all waves):** [`production-fix-wave-tracker.md`](./production-fix-wave-tracker.md)
**Later story (W8→W13 menus):** [`production-fix-flow-through-w13.md`](./production-fix-flow-through-w13.md)
**Final acceptance:** [`wave-19-acceptance-record.md`](../development/wave-19-acceptance-record.md)

Honesty rule (every wave): if the UI shows a control, it must work **or** be disabled with a clear why.

---

## One picture — why the order exists

```text
Setup          → Company + 4 people exist (Owner, HR, Manager, Employee)
     ↓
W0 Gates       → Flags / allowlists safe so modules don’t leak or boot wrong
     ↓
W1 Shared UX   → Forms, nav, permission gates look the same everywhere
     ↓
W2 Designation → Job title + onboarding template link (foundation for hire)
     ↓
W3 Org / login → Company structure + landing after login
     ↓
W4 Dashboard   → My Workspace / dashboards don’t lie when empty
     ↓
W5 Admin/Sec   → Users, roles, security basics
     ↓
W6 Employees   → People directory + secure documents
     ↓
W7 Recruitment → Opening → offer → convert (hands person to onboarding)
     ↓
W8 Onboarding  → New hire tasks until “ready for work”  ← persona Pass on this tenant
     ↓
W9…W19         → Calendar → punch → leave → assets → HR ops → projects → money → ops → sign-off
```

**Business meaning:**
W0–W5 = **platform is safe and usable**.
W6–W7 = **hire a person**.
W8 = **bring them into the company**.
W9+ = **run the company day-to-day**.

---

## Test company (shared for all waves)

| Field | Value |
|-------|--------|
| Company | `PFC-20260917` — ProdFix 20260917 |
| Branch | `PFB-20260917` HQ |
| Create script | Historical one-off script removed; use the guarded QA reference-data workflow |
| Tracker setup section | [Test organization checklist](./production-fix-wave-tracker.md#test-organization-checklist-phase-0--done) |

| Slot | Role | Login (local) |
|------|------|----------------|
| A | Owner | `prodfix.owner.20260917@example.test` |
| B | HR | `prodfix.hr.20260917@example.test` |
| C | Manager | `prodfix.mgr.20260917@example.test` |
| D | Employee | `prodfix.emp.20260917@example.test` |

Password stays **out of git** (setup script / private note).

---

## Wave-by-wave (plain English + links)

### Setup — “We have a sandbox”

**Why:** Never test production-fix on live VTRIOS.
**Done when:** Four personas can log in; colleague Manager/Employee smoke Pass.
**Status:** **Done + colleague Pass** (2026-09-17).
**Details:** [Tracker — Setup](./production-fix-wave-tracker.md#test-organization-checklist-phase-0--done)

---

### W0 — Production gates — “Don’t turn on broken switches”

**Why:** Feature flags and allowlists decide who sees Projects, Finance, Payroll, Onboarding, Assets, Files, Delivery. Wrong combo = leak or silent empty.
**In one line:** Empty allowlist = all companies for most Lites; **Delivery V2 cannot** use empty allowlist (fail closed). Payroll scope ⊆ Finance.
**Status:** Engineering done; ENV-001 / ENV-002 / REL-002 still **ops-owned** for production GO.
**Click-check:** Sidebar hides OFF modules; visible buttons work or block clearly.
**Links:**
- [Tracker — W0](./production-fix-wave-tracker.md#w0--production-gates)
- [`cfg-001-feature-gate-profiles.md`](../development/cfg-001-feature-gate-profiles.md)
- [`wave-0-to-wave-2-execution-plan.md`](../development/wave-0-to-wave-2-execution-plan.md)
- Evidence script: `backend/scripts/uat-phase5-gate-evidence.mjs` (13 Pass / 0 Fail on CFG file-scope)

---

### W1 — Shared UX — “Same rules on every screen”

**Why:** Without shared form/nav/gates, every later wave feels random.
**In one line:** Major creates use pages (not only drawers); breadcrumbs; PermissionGate + ModuleCapabilityGate; unsaved-change warning; a11y checklist.
**Status:** Engineering done (feeds W2 designation pilot).
**Links:**
- [Tracker — W1](./production-fix-wave-tracker.md#w1--shared-ux)
- [`wave-1-shared-ux-standard.md`](../development/wave-1-shared-ux-standard.md)
- [`wave-1-a11y-gate-checklist.md`](../development/wave-1-a11y-gate-checklist.md)

---

### W2 — Designation — “Job title that onboarding can trust”

**Why:** Hire + onboarding need a designation linked to template/departments without fake buttons.
**In one line:** Create/edit designation on dedicated pages; onboarding departments atomic; Manager must **not** see fake Create that fails later.
**Status:** **Done (persona Pass)** — Owner create Pass; Manager no Templates = correct.
**Menus:** Administration → Designations (`/administration/designations/new`).
**Links:**
- [Tracker — W2](./production-fix-wave-tracker.md#w2--designation)
- [`wave-2-designation-pilot-uat.md`](../development/wave-2-designation-pilot-uat.md)
- [`wave-2-freeze-record.md`](../development/wave-2-freeze-record.md) (SHA `93eeeb1`)

---

### W3 — Entry and organization — “Land in the right place”

**Why:** After login/invite, users must reach Dashboard / intended page — not stuck empty onboarding.
**In one line:** Auth redirect matrix + org structure honesty (companies/branches/departments).
**Status:** Engineering done (bundled in W5 exit).
**Links:**
- [Tracker — W3](./production-fix-wave-tracker.md#w3--entry-and-organization)
- Covered in [`wave-5-exit-record.md`](../development/wave-5-exit-record.md) (AUTH / ORG)

---

### W4 — Dashboard and workspace — “Empty is honest”

**Why:** My Workspace and dashboards are where Employee/Manager live daily.
**In one line:** Empty widgets say empty / Retry / Not authorized — never a silent blank error.
**Status:** Engineering done.
**Menus:** My Workspace → Overview and related cards.
**Links:**
- [Tracker — W4](./production-fix-wave-tracker.md#w4--dashboard-and-workspace)
- [`wave-5-exit-record.md`](../development/wave-5-exit-record.md) (DASH / MY)

---

### W5 — Administration and security — “Roles match menus”

**Why:** After a role change, logout/login must show the right menus; security basics must hold.
**In one line:** Users/roles/admin screens + security checks (ADM/SEC).
**Status:** Engineering done.
**Links:**
- [Tracker — W5](./production-fix-wave-tracker.md#w5--administration-and-security)
- [`wave-5-exit-record.md`](../development/wave-5-exit-record.md)
- Plan: [`wave-2-to-wave-5-execution-plan.md`](../development/wave-2-to-wave-5-execution-plan.md)

---

### W6 — Employees and documents — “People + clean files only”

**Why:** Directory and documents are prerequisites for recruitment, onboarding, payroll.
**In one line:** Employee list/detail forms; document Category → Type → Document; only **Clean** files download; scan states honest.
**Status:** Engineering done (live S3/ClamAV proof still deploy-time).
**Menus:** HR → Employees; HR → Employee documents / categories.
**Links:**
- [Tracker — W6](./production-fix-wave-tracker.md#w6--employees-and-documents)
- [`wave-6-exit-record.md`](../development/wave-6-exit-record.md)
- Plan: [`wave-6-execution-plan.md`](../development/wave-6-execution-plan.md)

---

### W7 — Recruitment — “Hire, then hand off”

**Why:** Creates the employee who will enter onboarding (W8).
**In one line:** Opening → applications → interviews → decision → offer → convert (preflight) → onboarding handoff; delivery retry uses reason dialog (no `window.prompt`).
**Status:** Engineering done; live email/provider proof pending when Delivery V2 is on.
**Menus:** HR → Recruitment (openings, applications, offers, delivery).
**Links:**
- [Tracker — W7](./production-fix-wave-tracker.md#w7--recruitment)
- [`wave-7-exit-record.md`](../development/wave-7-exit-record.md)
- Plan: [`wave-7-execution-plan.md`](../development/wave-7-execution-plan.md)
- Flags: [`rec-001-recruitment-flag-matrix.md`](../development/rec-001-recruitment-flag-matrix.md)

---

### W8 — Onboarding — “New hire becomes productive”

**Why:** First full **persona Pass** chain on this tenant after hire.
**In one line:** Templates + designation link → Start Onboarding (preflight) → Department Queue assign → Employee completes on My Workspace → reminders (bell).
**Status:** **Done (persona + eng Pass)** 2026-09-17.
**Menus:**
| Who | Screen | Path |
|-----|--------|------|
| HR | Employee Onboarding | `/hr/employee-onboarding` (and templates) |
| HR | Department queue / assign | Onboarding workspace queues |
| Employee | My Onboarding | `/my-workspace` → Onboarding tabs |

**Links:**
- [Tracker — W8](./production-fix-wave-tracker.md#w8--onboarding-done)
- Gap explanation (if needed): [`onboarding-department-flow-gap-explained.md`](./onboarding-department-flow-gap-explained.md)

**What “Pass” meant here:** Assign path worked for you + colleague; Start Onboarding and template honesty Pass; reminders engineering Pass (in-app bell, not calendar).

---

## How W0–W8 connect to what you tested later

| After W8 you already proved | Depends on earlier waves |
|----------------------------|---------------------------|
| W9 Calendar / Work Schedule | Org (W3), designations (W2), employees (W6) |
| W10 Punch | W9 published working day |
| W11 Leave / OT | Employees + calendar |
| W12 Assets | Employees + permissions (W5) |
| W13 HR Request | Employees + documents upload honesty (W6 + later MIME fix) |
| W14–W15 Projects / Timesheets | Employees + designations |
| W16–W17 Finance / Payroll | Gates (W0) + employees |
| W18 Ops Delivery / Files | Gates (W0) + file storage honesty (W6/W18) |
| W19 Sign-off | Everything above + named signatures |

---

## Quick revisit checklist (optional 20 minutes)

Use if someone asks “prove W0–W8 still hold” without redoing Excel:

1. **W0** — Log in as Employee: a gated module that is OFF is hidden; one that is ON opens or explains block.
2. **W2** — Owner opens Designations → New; Manager does **not** get a fake template create.
3. **W4** — Employee My Workspace: empty cards say empty / not authorized.
4. **W6** — Employee documents: only Clean downloads.
5. **W7** — Recruitment menu visible to HR; convert/onboarding handoff still makes sense.
6. **W8** — Employee still sees Onboarding only if assigned; HR can open Employee Onboarding.

---

## Status snapshot (Setup → W8)

| Wave | Status on this program |
|------|-------------------------|
| Setup | **Done + colleague Pass** |
| W0 | Engineering done (ops ENV/REL still open for GO) |
| W1 | Engineering done |
| W2 | **Persona Pass** |
| W3–W5 | Engineering done ([exit](../development/wave-5-exit-record.md)) |
| W6 | Engineering done ([exit](../development/wave-6-exit-record.md)) |
| W7 | Engineering done ([exit](../development/wave-7-exit-record.md)) |
| W8 | **Persona + eng Pass** |

---

## What to read next

1. This page (Setup→W8) — you are here
2. [`production-fix-flow-through-w13.md`](./production-fix-flow-through-w13.md) — day-to-day HR path after onboarding
3. [`production-fix-wave-tracker.md`](./production-fix-wave-tracker.md) — W9→W19 scoreboard
4. [`wave-19-acceptance-record.md`](../development/wave-19-acceptance-record.md) — final GO / NO-GO
