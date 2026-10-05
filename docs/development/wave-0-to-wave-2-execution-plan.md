# Wave 0 → Wave 2 execution plan

**Sources**
- Manager order (2026-09-09): start with **W0 Production Gates and Recent Fixes**, not full UI redesign
- Excel: [`docs/reference/production-fix-improvement-plan-2026-09-09.xlsx`](../reference/production-fix-improvement-plan-2026-09-09.xlsx) (Master Tasks)
- Understanding doc: `docs/development/wave-0-common-ux-foundation-understanding.md`

**Goal through Wave 2**  
Hardened feature gates + Designation/Onboarding defect fixes → shared UX page pattern → Designation as first full-page UI pilot → frozen SHA on isolated production-like UAT.

**Out of scope until pilot passes:** W3–W18 (org polish, employees, recruitment, etc.).

---

## Already done (baseline — do not re-do blindly)

| Area | Status |
|---|---|
| Empty allowlist = all companies for Onboarding, Finance, Payroll, Projects, Assets, File Storage | Done in code; still needs **CFG profiles + Delivery exception + Payroll/Finance validation + UAT script** |
| Designation create/edit multi-select onboarding departments + table column + Select all | UI + Phase B: atomic create, Branch-aware, gates, inactive rules |
| Wave 0 understanding MD | Done (process/UX vocabulary) |

---

## Phase map (execute in order)

```
Phase A  CFG-001 → CFG-004          Feature-gate correction
Phase B  W0-03 → W0-10 (+ W0-02/11) Designation/Onboarding + gate hardening
Phase C  W1 UX-01 → UX-06           Shared UX standard (pattern only)
Phase D  W2 DES-01 → DES-07         Designation UI pilot
Phase E  REL/ENV UAT gate           Freeze SHA + isolated two-tenant UAT
```

Do **not** start Phase C/D until Phase A+B exit gates pass (manager: feature gates first, then Designation/Onboarding fixes).

---

## Phase A — Feature gates (CFG-001 → CFG-004)

**Status (2026-09-10):** Code + matrix in progress — see completion notes below.

**Intent:** Empty allowlists only enable **approved** modules globally; Delivery stays pilot-scoped; Payroll/Finance cannot silently disagree; UAT scripts match runtime.

| ID | Task | Concrete work | Exit | Done? |
|---|---|---|---|---|
| **CFG-001** | Three verified profiles | Matrix doc: `docs/development/cfg-001-feature-gate-profiles.md` | Matrix signed; A/B agree in all 3 profiles | Doc done; live A/B UAT pending |
| **CFG-002** | Delivery explicit pilot | Empty Delivery allowlist **fail-closed** (boot + runtime + claim) | Unlisted tenants never claimed; empty ≠ all for Delivery | **Code done** |
| **CFG-003** | Payroll ⊆ Finance | Startup rejects payroll empty-all when finance is restricted | Bad combo refuses start | **Code done** |
| **CFG-004** | File Storage UAT script | `uat-phase5-gate-evidence.mjs` empty = all + matrix cases | Script ≡ runtime | **Code done** |

---

## Phase B — Designation / Onboarding defects (W0-03 → W0-10)

**Status (2026-09-10):** Code done for W0-03…W0-07 + W0-09; W0-08/W0-10 closed via Phase A; W0-11 deferred.

**Intent:** Permissions, feature gate, atomic create+link, Branch-aware departments, inactive rules, reminder paging, script parity. (Manager list; Excel also has W0-02/W0-08/W0-11 overlapping CFG.)

| ID | Task | Concrete work | Exit | Done? |
|---|---|---|---|---|
| **W0-03** | Permission visibility | Create button gated on `organization.structure.manage`; onboarding section on `hr.onboarding.manage` + `onboardingNav` | Button = page guard = API | **Code done** |
| **W0-04** | Enforce Onboarding feature gate | Link paths call `OnboardingFeatureGateService`; FE hides section when capability off | Disabled scope cannot create template/slice | **Code done** |
| **W0-05** | Atomic Designation + onboarding link | `POST /designations` accepts `onboardingDepartmentIds` + `branchId` in one transaction; FE create uses atomic payload | All-or-nothing | **Code done** |
| **W0-06** | Branch-aware department selection | Branch select before departments; server validates department Branch | Cross-branch mix rejected | **Code done** |
| **W0-07** | Inactive Designations | Block link while inactive (API + form copy) | No invisible linked templates | **Code done** |
| **W0-08** | Payroll/Finance scope | Same as CFG-003 | Startup + capabilities aligned | **Done in Phase A** |
| **W0-09** | Reminder pagination | Keyset `(dueDate, id)` batches of 200 | All due tasks eventually processed | **Code done** |
| **W0-10** | File Storage evidence script | Same as CFG-004 | Script ≡ runtime | **Done in Phase A** |

**Also harden with these Excel siblings (same wave):**
- **W0-02** — Delivery empty allowlist fail-closed (pairs with CFG-002) — **Done in Phase A**
- **W0-11** — One authoritative scope resolver per module — **Deferred** (not blocking Phase B exit for Designation/Onboarding)

**Phase B exit:** Designation create+link is safe under production gates; onboarding cannot leak outside feature/permission/branch rules.

---

## Phase C — W1 Shared UX standard (UX-01 → UX-06)

**Status (2026-09-10):** Pattern published + shared primitives shipped. Designation (Phase D) is first consumer — no module-wide rewrite in C.

**Intent:** Define **one reusable dedicated-page pattern**. Inventory drawers/dialogs. No module-wide rewrite yet — Designation (W2) is the first consumer.

| ID | Task | Concrete work | Exit | Done? |
|---|---|---|---|---|
| **UX-01** | Page vs dialog rule | Inventory + rule in `wave-1-shared-ux-standard.md` / `wave-1-ux-01-create-edit-inventory.md` | Reviewed inventory + pattern doc | **Done** |
| **UX-02** | Nav grouping | `navKind` metadata; daily-before-config reorder (Leave, Documents, Assets, Onboarding Templates); URLs unchanged | Personas reach top tasks without setup first | **Done** |
| **UX-03** | Entity breadcrumbs | `EntityBreadcrumbProvider` + `useSetEntityBreadcrumbs` + header merge | Detail crumbs identify record | **Done** |
| **UX-04** | Authz UX | `PermissionGate`, `AuthzState`; `ModuleCapabilityGate` + `payrollNav` | No mutation button that 403s later | **Done** |
| **UX-05** | Form chrome | `EntityFormPage`, `FormValidationSummary`, `useUnsavedChanges` | Pattern ready for DES | **Done** |
| **UX-06** | A11y gate | `wave-1-a11y-gate-checklist.md` | Checklist ready for W2 pilot sign-off | **Done** |

**Also:** CORE-01 persona matrix → `docs/development/wave-1-persona-permission-matrix.md`

**Phase C exit:** Shared pattern exists and is documented; Designation can implement against it without inventing a third style.

---

## Phase D — W2 Designation UI pilot (DES-01 → DES-07)

**Status (2026-09-10):** Code done for DES-01…DES-06; DES-07 checklist ready for live UAT / Phase E.

**Intent:** First real dedicated-page module. Replace create drawer. Both Designations + Onboarding Templates entry points. Prove permissions, flags, recovery, mobile, keyboard, 200% zoom.

| ID | Task | Concrete work | Exit | Done? |
|---|---|---|---|---|
| **DES-01** | Create page | `/administration/designations/new` + `EntityFormPage` | Direct URL, refresh, cancel/back, save | **Code done** |
| **DES-02** | Edit page | `/administration/designations/[id]/edit`; delete = confirm | Load by ID; unauthorized/not-found | **Code done** |
| **DES-03** | Dual entry + return | List + Onboarding Templates → same pages; safe `return`/`source` | Admin → list; Templates → templates | **Code done** |
| **DES-04** | Branch before departments | Form Branch select then dept multi-select | Same Branch only | **Done (B+D)** |
| **DES-05** | Conditional onboarding section | Capability + `hr.onboarding.manage` | Personas match backend | **Done (B+D)** |
| **DES-06** | Atomic command + next step | Create uses W0-05; toast **Open checklist** | Failure keeps form open | **Code done** |
| **DES-07** | Evidence UAT | `docs/development/wave-2-designation-pilot-uat.md` | Authorized complete; others blocked | **Checklist ready** |

**Phase D exit:** Designation pilot signed; drawer create path removed (list/templates navigate to pages).

---

## Phase E — Freeze SHA + isolated production-like UAT

**Status (2026-09-15 Phase F):** Freeze SHA + tag recorded. Local health green. DES-07 engineering Conditional Pass. ENV-001 full isolation and manager browser sign-off still open; **engineering proceed W3+ = Yes**.

| ID | Task | Exit | Done? |
|---|---|---|---|
| **REL-001** | Freeze one Git SHA; deploy FE + API + workers from it | All evidence cites same SHA | **Frozen** `93eeeb1…` / `wave2-uat-freeze` (local deploy) |
| **ENV-001** | Isolated UAT: production `NODE_ENV`, separate DB/schema, private storage, 2 companies × branches, synthetic roles, provider sandboxes, **no customer data** | Cannot touch prod data | **Deferred** (pragmatism) |
| **ENV-002** | Secrets/providers ready (keys, S3, Redis, ZeptoMail sandbox as needed) | Ready healthy; no secrets in evidence | **Partial** — `/health` 200 |
| **DES-07 + CFG matrix** | Re-run Designation flow + three flag profiles on this env | Sign-off to proceed W3+ | **Conditional** — code/tests; live profiles + personas pending |

**Docs:** `docs/development/wave-2-phase-e-uat-runbook.md`, `docs/development/wave-2-freeze-record.md`

---

## Dependency diagram (simple)

```
CFG-001 ─┬─► CFG-002 / W0-02 (Delivery fail-closed)
         ├─► CFG-003 / W0-08 (Payroll ⊆ Finance)
         └─► CFG-004 / W0-10 (script parity)
                │
                ▼
         W0-03 → W0-04 → W0-05 → W0-06 → W0-07
                │              │
                │              └─► W0-09 (reminders, can parallel after gates)
                ▼
         W0-11 (single scope resolvers) ──► W1 (UX-01…06)
                                              │
                                              ▼
                                           W2 (DES-01…07)
                                              │
                                              ▼
                                      Freeze SHA + ENV UAT
```

---

## Recommended sprint slices (when you say execute)

| Sprint | Deliverables |
|---|---|
| **S1** | Phase A: CFG-002, CFG-003, CFG-004 + CFG-001 matrix draft |
| **S2** | Phase B: W0-03, W0-04, W0-05, W0-06, W0-07 |
| **S3** | Phase B finish: W0-09, W0-11; Phase C: UX-01, UX-04, UX-05 (+ persona matrix CORE-01) |
| **S4** | Phase C: UX-02, UX-03, UX-06; Phase D: DES-01…DES-06 |
| **S5** | Phase D: DES-07; Phase E: freeze SHA + isolated UAT sign-off |

Adjust lengths to team capacity; **do not reorder Phase A before B before C/D**.

---

## Definition of “Wave 2 complete”

1. Feature-gate profiles documented and verified (empty-all only where approved; Delivery pilot-only).  
2. Designation/Onboarding defects W0-03…W0-10 closed with evidence.  
3. Shared page pattern published; Designation create/edit are pages, not drawers.  
4. Dual entry points work with safe return.  
5. Isolated two-tenant UAT on one frozen SHA passes DES-07 + gate matrix.  
6. Manager/sign-off allows **W3+**.

---

## How we start coding

Reply with which block to execute first, for example:
- `execute Phase A` — feature gates  
- `execute Phase A then B` — gates + Designation/Onboarding backend defects  
- `execute S1` — first sprint only  

Default recommendation: **`execute Phase A`** (CFG-002 → CFG-003 → CFG-004 → CFG-001 matrix).
