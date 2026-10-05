# Designation pilot UAT (DES-07)

**Module:** Designation create/edit pages  
**Depends on:** Phase B (gates/atomic) + Phase C (page chrome)  
**A11y:** also complete `docs/development/wave-1-a11y-gate-checklist.md`

**Phase F freeze SHA:** `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` (`wave2-uat-freeze`)

---

## Routes under test

| Route | Expect | Engineering check (2026-09-15) |
|---|---|---|
| `/administration/designations` | List; New hidden without `organization.structure.manage` | **Pass** — `designation-toolbar.tsx` gates create |
| `/administration/designations/new` | Create page; unauthorized without manage | **Pass** — page + `PermissionGate` |
| `/administration/designations/[id]/edit` | Edit page; unauthorized without manage; not-found for bad id | **Pass** — permission gate + load path present |
| `/hr/onboarding-templates` → Create Designation | Same create page with `source`/`return` | **Pass** — `designationCreateHref` + safe `resolveDesignationReturnPath` |

---

## Persona matrix

| Persona | Create | Edit | Onboarding dept section | Cross-tenant | Phase F |
|---|---|---|---|---|---|
| Structure manage only | Yes | Yes | Hidden (no onboarding manage / nav) | Own company only | **Code path** — section gated in form; **browser not run** |
| Onboarding manage + nav only | No (button/page blocked) | No | N/A | — | **Code path** — structure.manage required; **browser not run** |
| Combined structure + onboarding | Yes | Yes | Visible; Branch then depts | Own company only | **Code path** — Branch before depts + API `branchId`; **browser not run** |
| Structure read-only | No | No | — | Own company only | **Code path**; **browser not run** |
| Second tenant | Own only | Cannot open other tenant id | — | No leak | **Code path** (org scope services); **browser not run** |

---

## Functional checks

- [x] Direct URL to `/new` works after refresh — route `app/(dashboard)/administration/designations/new/page.tsx` exists (page load in browser: pending human)
- [x] Cancel with dirty form warns; Cancel clean returns via `return` — `useUnsavedChanges` + `resolveDesignationReturnPath` allowlist
- [x] Save with onboarding depts is all-or-nothing — `DesignationService.create` single `$transaction`; inactive/branch validated before write
- [x] Success toast offers **Open checklist** when template linked — `designation-editor.tsx`
- [x] Failure keeps form open (no success toast) — mutations use `suppressToast` + error path keeps editor
- [x] Delete still uses confirm dialog from edit page — `ConfirmActionDialog`
- [x] Inactive designation cannot link departments (UI + API) — form copy + `ConflictException` in service

**Browser click-through of the seven bullets:** not executed in Phase F session (no multi-persona credentials exercised). Marked from **code + service review** against freeze SHA.

---

## Sign-off

| Field | Value |
|---|---|
| SHA (must match Phase E freeze) | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` |
| Tester | Engineering (Phase F) |
| Date | 2026-09-15 |
| Result | **Conditional Pass** (engineering); full persona browser UAT **Pending manager** |
| Notes | Local FE+API healthy. Proceed W3+ under pragmatism; re-run this sheet on isolated UAT when ENV-001 is ready. |

See also: `docs/development/wave-2-phase-e-uat-runbook.md`, `docs/development/wave-2-freeze-record.md`.
