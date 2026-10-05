# Wave 1 UX-06 — Accessibility gate checklist

Use this checklist to sign off a module pilot (first: **Designation**, DES-07).  
Fail any **Must** item → do not call the module Wave-2 complete.

---

## Must

| # | Check | Pass? | Notes |
|---|---|---|---|
| A1 | Skip link reaches `#main-content` | Pending live | Shell has skip link; not re-clicked in Phase F |
| A2 | All primary actions reachable by keyboard (Tab / Shift+Tab) | Pending live | Native controls on page form |
| A3 | Focus visible on interactive controls | Pending live | |
| A4 | After opening dialog/sheet, focus moves inside; Esc closes; focus returns | Code OK | Delete uses `ConfirmActionDialog` only |
| A5 | Form labels associated (or `RequiredLabel` / aria) | Code OK | `DesignationForm` labeled fields |
| A6 | Errors announced — validation summary or field messages linked | Code OK | `FormValidationSummary` |
| A7 | No keyboard trap on create/edit page | Pending live | Full page (not sheet) reduces trap risk |
| A8 | Meaningful page title / breadcrumbs identify Create vs Edit vs entity | Code OK | `useSetEntityBreadcrumbs` |
| A9 | Mobile (&lt;768px): form usable without horizontal scroll of main fields | Pending live | |
| A10 | Tablet: Company/Branch context reachable (or documented gap with owner) | Pending live | Known Wave-0 gap: switcher hidden on small screens |
| A11 | **200% browser zoom** (Chromium): primary Save/Cancel still visible without clipping critical fields | Pending live | |
| A12 | Destructive actions require confirm; not on Enter by accident in unrelated field | Code OK | Confirm dialog for delete |

---

## Should

| # | Check | Pass? | Notes |
|---|---|---|---|
| B1 | Hit areas ≥ 44px on touch for primary actions | Pending live | |
| B2 | Color not sole status signal (text/icon too) | Pending live | |
| B3 | Loading / empty / error / unauthorized states present | Code OK | Unauthorized gate + validation summary |
| B4 | Unsaved warning on Cancel when dirty | Code OK | `useUnsavedChanges` |

---

## Sign-off

| Field | Value |
|---|---|
| Module | Designation (W2) |
| Build / SHA | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` |
| Tester | Engineering (Phase F) |
| Date | 2026-09-15 |
| Result | **Conditional** — code Must items OK; live keyboard/zoom/mobile **pending** |
| Follow-ups | Complete live A1–A3, A7, A9–A11 on isolated UAT before calling a11y fully closed |
