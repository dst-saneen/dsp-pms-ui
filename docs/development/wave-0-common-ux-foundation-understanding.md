# Wave 0 — Common UX foundation (simple understanding)

**Purpose:** Before a full visual redesign, make every page use the **same interaction patterns**. Fix “different drawer / table / empty state per module” first; then do brand/layout redesign later.

**Target flow (every persona):**  
Sign in → select Company/Branch → navigate → list → detail → action → confirmation → next action.

---

## What we already have (common building blocks)

These exist in the frontend and many pages already use them:

| Building block | What it is | Used a lot by |
|---|---|---|
| `WorkspaceShell` | Standard page frame | Most list/detail workspaces |
| `DataTable` | Shared table (sort / empty / error / retry) | Admin masters, many HR lists, assets, some recruitment |
| `FormSheet` / `FormDialog` | Right-side create/edit drawer (**same component**, two names) | Companies, branches, departments, designations, shifts, leave types, assets… |
| `LookupSelect` | Shared company/dept/etc dropdown | Many forms |
| `PageToolbar` / `PageHeader` | Title + search/actions area | Lists (two different page chrome styles) |
| `ConfirmActionDialog` | Delete / dangerous confirm | Admin CRUD, some employee/asset flows |
| `StatusBadge` | Status chip | Many tables (also many custom badges) |
| Sidebar + collapse | Left nav, collapse to icons | Whole app |
| Organization switcher | Company/Branch context | Header (**desktop only today**) |
| My Workspace | Daily employee work | Self-service |

**Bottom line:** We do **not** start from zero. We start from “shared kit exists, but not every page uses it the same way.”

---

## Where pages are NOT the same today

| Area | Common approach | Different / broken approach |
|---|---|---|
| Create / edit | Right drawer (`FormSheet`) | Recruitment / some projects use **center Dialog** |
| Dropdowns | `LookupSelect` | Many filters use raw `Select`; **two LookupSelect copies** exist |
| Tables | `DataTable` | Projects, delivery, onboarding designer use **hand-built tables** |
| Page header | `PageToolbar` | Some admin pages use `PageHeader` + `FilterPanel` instead |
| Empty / error | Built into `DataTable` | Custom pages often miss empty / retry |
| Confirm delete | `ConfirmActionDialog` | Recruitment uses custom dialogs |
| Breadcrumbs | Nav path only (e.g. HR → Employees) | Detail pages **don’t show entity name** (employee/opening/project) |
| Company/Branch | Header switcher | **Hidden on mobile/tablet** |
| Navigation | Groups exist | HR mixes **daily work** and **setup** in one tree |

---

## Wave 0 tasks — plain English vs our app

### CORE-01 — Persona and permission matrix
**Meaning:** Write who each role is (Owner, HR, Employee, Approver…) and which daily screens they need.  
**Today:** Permissions exist on APIs and nav items; no single Wave-0 matrix document.  
**Status:** Missing (doc work first).

### CORE-02 — Separate daily work / configuration / administration / operations
**Meaning:** Nav should not bury daily tasks next to setup screens.  
**Today:** My Workspace + Administration + Operations groups exist, but **HR still mixes** leave requests with leave types/policies, documents with categories, etc.  
**Status:** Mixed.

### CORE-03 — Better collapsed sidebar (keep URLs)
**Meaning:** Collapsed mode should stay usable; links must not change.  
**Today:** Collapse + tooltips work; state not remembered after refresh; nested groups still awkward.  
**Status:** Partially done.

### CORE-04 — Company/Branch usable on mobile/tablet
**Meaning:** User must change company/branch on phone/tablet without hunting.  
**Today:** Switcher is `hidden` until large screens.  
**Status:** Missing.

### CORE-05 — Meaningful breadcrumbs on detail screens
**Meaning:** Detail should read like `Employees → EMP-00032 Arun`, not only `HR → Employees`.  
**Today:** Header crumbs follow nav labels only.  
**Status:** Partially done (shell crumbs exist; entity crumbs missing).

### CORE-06 — Standard page titles and actions
**Meaning:** Same rules everywhere: one primary button, secondary outline, dangerous = red/confirm.  
**Today:** Patterns exist but modules invent their own button layouts.  
**Status:** Mixed.

### CORE-07 — Standard tables, filters, sorting, paging, filtered-empty
**Meaning:** Every list should feel the same (filter → sort → page → “no results for this filter”).  
**Today:** `DataTable` is good where used; other modules diverge.  
**Status:** Mixed — **highest impact for “common design” cleanup**.

### CORE-08 — Standard forms, validation, unsaved warnings, confirmations
**Meaning:** Same drawer/form behaviour; warn before losing edits; confirm deletes.  
**Today:** Admin drawers are consistent; recruitment dialogs differ; **unsaved-change warnings almost nowhere**.  
**Status:** Mixed.

### CORE-09 — Loading / empty / permission-denied / server-error / retry
**Meaning:** Same five states on every page, never a blank crash.  
**Today:** Some primitives exist; permission-denied and retry are not uniform.  
**Status:** Mixed.

### CORE-10 — Keyboard, focus, responsive, 200% zoom
**Meaning:** Accessible and usable when zoomed or on small screens.  
**Today:** Skip link, some focus restore, responsive shell; org switcher + zoom QA still gaps.  
**Status:** Partially done.

---

## Exit gate (when Wave 0 is “done”)

Each persona can reach **main daily tasks** without walking through unrelated setup modules.

Example of **not** meeting the gate today: an HR approver opens Leave and sees types/policies/config siblings before (or mixed with) the request queue.

---

## Suggested order (practical)

1. **CORE-01** — write persona matrix (Owner / HR / Employee / Finance / etc.).  
2. **CORE-02 + CORE-04** — nav separation + mobile Company/Branch.  
3. **CORE-07 + CORE-08 + CORE-09** — force shared table / drawer / state patterns (biggest “pages look different” fix).  
4. **CORE-05 + CORE-06** — breadcrumbs + action hierarchy.  
5. **CORE-03 + CORE-10** — sidebar polish + a11y/zoom pass.

Only after this foundation is stable should we do a **full visual redesign** (brand, colour, layout language).

---

## One-line summary for the team

Wave 0 is not a new theme — it is making **every page use the same shell, table, drawer, dropdown, empty/error, and action rules** we already partially have, then splitting navigation so daily work is not mixed with setup.
