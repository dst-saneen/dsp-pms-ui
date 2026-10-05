# Wave 1 — Shared UX standard (UX-01 → UX-06)

**Status:** Phase C pattern published (2026-09-10). Designation (Phase D) is the first consumer.  
**Sources:** `wave-0-to-wave-2-execution-plan.md`, `wave-0-common-ux-foundation-understanding.md`

**Goal:** One dedicated-page pattern so modules stop inventing a third style. No module-wide rewrite in Phase C.

---

## UX-01 — Page vs dialog rule

| Surface | Use for | Do not use for |
|---|---|---|
| **Dedicated page** (`/…/new`, `/…/[id]/edit`) | Major create/edit of masters and long forms (Designation, Employee edit, Opening, Onboarding template) | Quick confirms |
| **FormSheet** (right drawer; `FormDialog` is an alias) | Short config edits still on list pages until migrated; nested template slices | Primary Designation create/edit after Phase D |
| **Center Dialog** | Approve/reject, short assign, reason, schedule, one-field actions | Multi-section master CRUD |
| **ConfirmActionDialog** | Delete, deactivate, publish, irreversible lifecycle | Data entry forms |

**Inventory:** `docs/development/wave-1-ux-01-create-edit-inventory.md`

**Designation contract (DES):** Create/Edit become pages; delete stays `ConfirmActionDialog`.

---

## UX-02 — Nav grouping (URLs stable)

Four **kinds** (metadata `navKind` on nav items):

| Kind | Meaning | Examples |
|---|---|---|
| `daily` | Queue / do-work screens | Leave requests, attendance daily, employee onboarding queue, custodian inbox |
| `config` | Policy / template / taxonomy setup | Leave types/policies, onboarding templates, asset categories |
| `admin` | Org structure & security | Companies, branches, designations, users, roles |
| `ops` | Platform operations | Delivery queue, file ops, suppressions |

**Rules**
- Preserve existing `href`s.
- Within a mixed group, list **daily before config**.
- Designations stay under **Administration** (`admin`).

**Target HR leave order:** Requests → Balances → Calendar → Comp-off → Types → Policies → Holidays.  
**Persona matrix:** `docs/development/wave-1-persona-permission-matrix.md`

---

## UX-03 — Entity breadcrumbs

Shell crumbs today: **Group → … → Nav item** (`getBreadcrumbs(pathname)`).

Entity pages append via `EntityBreadcrumbProvider` / `useSetEntityBreadcrumbs`:

`Administration → Designations → New Designation`  
`Administration → Designations → DES-00012 Senior Engineer → Edit`

List crumb must link back to the list `href`. Current page crumb has `href: null`.

---

## UX-04 — Authz UX

Shared primitives:

| Component / hook | When |
|---|---|
| `PermissionGate` | Hide or replace children when permission missing |
| `ModuleCapabilityGate` | Module not enabled for Company/Branch |
| `AuthzState` | Full-page unauthorized / context-required / not-found |

**Rules:** Do not show a primary mutation that will 403. Prefer hide; use disabled + hint only when teaching “why”.

Designation: create needs `organization.structure.manage`; onboarding link needs `hr.onboarding.manage` + `onboardingNav`.

---

## UX-05 — Dedicated form page chrome

Use `EntityFormPage` + `useUnsavedChanges` + `FormValidationSummary`:

1. **PageHeader** — title, short description, optional secondary link (“Open checklist”).
2. **Sticky footer** — secondary Cancel/Back (outline), primary Save/Update, optional destructive Delete (opens confirm).
3. **Validation summary** — list of blocking errors above the form when submit fails.
4. **Unsaved warning** — `beforeunload` + `confirmLeave()` on Cancel/Back.
5. **Conflict** — surface 409/`rowVersion` with retry copy (page keeps form open).
6. **Success next-step** — toast + optional CTA (e.g. Open checklist); do not treat partial link failure as success (W0-05).

Drawer `FormActions` remains for unmigrated sheets.

---

## UX-06 — A11y gate

Module sign-off checklist: `docs/development/wave-1-a11y-gate-checklist.md`  
Required for W2 Designation pilot (DES-07): keyboard, focus, mobile/tablet, **200% zoom**.

---

## Code map (frontend)

| Pattern | Location |
|---|---|
| Entity crumbs | `providers/entity-breadcrumb-provider.tsx`, `AppHeader` |
| Permission gate | `components/common/permission-gate.tsx` |
| Authz page state | `components/common/authz-state.tsx` |
| Form page shell | `components/common/entity-form-page.tsx` |
| Unsaved changes | `hooks/use-unsaved-changes.ts` |
| Validation summary | `components/forms/form-validation-summary.tsx` |
| Nav kind | `types/navigation.ts` → `navKind` |

---

## Phase C exit

Shared pattern documented and primitives available. Phase D implements Designation pages against this standard without inventing new chrome.
