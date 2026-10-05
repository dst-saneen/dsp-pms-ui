# Wave 1 UX-01 — Create/edit inventory

**Date:** 2026-09-10  
**Rule:** Major create/edit → **dedicated pages**. Dialogs only for confirm, approve/reject, short assign, remarks.

> `FormDialog` re-exports `FormSheet` — named “dialog” imports are still **right drawers**.

---

## Dedicated pages (already)

| Module | Route | Notes |
|---|---|---|
| Employees | `/hr/employees/new`, `/hr/employees/[id]/edit` | Legacy new; edit is full page |
| Onboarding templates | `/hr/onboarding-templates/new` | Create page; designer is detail |
| Job openings | `/hr/recruitment/openings/new`, `[id]` | Full editor |

---

## FormSheet drawer (dominant masters)

Companies, company groups, branches, departments, **designations**, shifts, users/security sheets, leave types/policies, holidays, employee documents taxonomy, assets catalog, payroll/finance setup & transactions, attendance period helpers, onboarding nested task/dept sheets.

**Phase D target:** Designation create/edit leave this list.

---

## Center Dialog outliers

Projects (create/detail nested), HR requests / separations, recruitment intake & action dialogs, asset command reasons, timesheet dialogs.

Migrate only when a module enters a later wave — do not invent a fourth pattern.

---

## ConfirmActionDialog

Delete / deactivate / publish / archive / transfer / approve / complete. Keep for Designation **delete**.

---

## Designation today → target

| Today | Target (DES) |
|---|---|
| List + `DesignationDialog` FormSheet | List + `/administration/designations/new` + `/[id]/edit` |
| Multi-step link risk (fixed W0-05 atomic) | Same atomic API on page |
| Create from Onboarding Templates toolbar | Same create page with safe return (`source`) |
