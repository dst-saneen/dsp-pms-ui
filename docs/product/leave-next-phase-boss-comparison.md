# Leave next phase — current vs new suggestions

**Status:** Comparison only (no build until you say start)  
**Date:** 2026-08-11  
**Context:** Business Calendar + employee personal calendar are approved. Next: Leave.

---

## 1. What client asked (today)

1. Admin sets **leave policy**, **leave types**, and **holidays**.
2. **Role / designation wise** rules: which leave types, how many days per role.
3. Employee applies leave → goes to **his manager first**, then **HR**.
4. Leave must **show on calendar** (type, half/full day).
5. Click a calendar day → **side panel** about that day.
6. A **tab / view for leave-type balances**.
7. **Admin, HR, and the live manager** can open **each employee’s personal calendar**.

---

## 2. What we already have


| Area              | Today                                                                                 | Where                                      |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| Leave types       | Admin can create types (Casual, Sick, etc.)                                           | Leave → Types                              |
| Leave policy      | Company + branch + optional department + **optional designation** + days per year     | Leave → Policies                           |
| How many days     | Policy `annualEntitlement` is used when generating yearly balances                    | Leave → Balances → Generate                |
| Holidays          | Two places: old **Leave → Holidays** list, and new **Business Calendar** (approved)   | Leave / Administration                     |
| Apply leave       | Employee applies from My Workspace                                                    | My Workspace                               |
| Approval          | Workflow: **reporting manager → HR Manager** (if manager missing / not eligible)      | Leave → Requests                           |
| Employee calendar | Personal calendar shows leave **type**, pending/approved, **half/full**, holiday name | My Workspace                               |
| HR calendar       | Month grid; click day → list of people that day                                       | Leave → Calendar                           |
| Balances          | Separate balances page + My Workspace balance cards + employee leave profile          | Leave → Balances / My Workspace / Employee |


**Already true in backend:** designation on policy, manager-then-HR workflow, leave on personal calendar.

---

## 3. Comparison (client vs current)


| Boss want                                                             | Already there?       | Gap                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin sets leave types                                                | **Yes**              | Keep. Make copy more HR-friendly.                                                                                                                                                                                                      |
| Admin sets leave policy                                               | **Yes**              | Policy exists, but UI is a list of rows — not a clear “this role gets these leaves” picture.                                                                                                                                           |
| Holidays with leave/policy                                            | **Partly**           | Holidays now belong to **Business Calendar**. Leave → Holidays is the old list. Don’t maintain two holiday systems.                                                                                                                    |
| Role / designation: which types + how many days                       | **Partly**           | Designation is optional on policy. No simple **matrix** (rows = designations, columns = leave types, cells = days). System **Role** (Admin/HR) is not the same as **Designation** (Manager, Engineer). Boss means **job designation**. |
| Apply → manager → HR                                                  | **Yes (engine)**     | Works in workflow. Inbox is not clearly “my team’s leave” vs “HR queue”. Two-step (manager then HR) is not obvious on screen.                                                                                                          |
| Leave visible on calendar                                             | **Yes for employee** | Personal calendar done. HR/manager calendar still shows generic status more than leave name + half/full.                                                                                                                               |
| Click day → side detail                                               | **Partly**           | HR calendar has a side list. **Employee personal calendar does not** open a day panel yet.                                                                                                                                             |
| Leave-type balance tab                                                | **Partly**           | Balances exist as a **separate page / cards**, not as a tab next to the calendar.                                                                                                                                                      |
| See **each employee’s** personal calendar (Admin / HR / live manager) | **No (main gap)**    | HR calendar is a **team month**, not “open Kavya’s calendar like My Workspace”. Team API exists; no employee-picker personal view.                                                                                                     |


---

## 4. What is new / what to change (next phase)

Do **not** rebuild leave from scratch. Add and tidy.

### A. Policy by designation (new UI, same engine)

- Keep Leave Types + Policies.
- Add a simple **designation matrix**:  
Designation × Leave type → days per year.
- Example: Manager = 15 Casual + 12 Sick; Staff = 12 Casual + 8 Sick.
- Still generate yearly balances after policy is set (same as today).

### B. Holidays (change, don’t duplicate)

- Holidays = **Business Calendar** (already approved).
- Leave screens should **read** that calendar, not a second holiday master.
- Leave → Holidays can stay as a link/redirect, or be retired later.

### C. Approval UX (change)

- Keep manager → HR engine.
- Make screens match:  
  - Manager sees **only his team’s** pending leave.  
  - HR sees remaining / all after manager (or when manager is missing).
- Employee sees status: Submitted → Manager → HR → Approved.

### D. Calendars (add + align)

1. **Employee My Workspace**
  - Click a day → side panel: leave type, half/full, status, holiday name, balance for that type.
2. **Leave-type balance tab** next to personal calendar
  - Same numbers as today, just sitting with the calendar.
3. **Admin / HR / live manager**
  - New: pick an employee → see **their** personal calendar (same look as My Workspace).  
  - Manager: only reportees. HR/Admin: scoped company/branch.

### E. HR team calendar (polish)

- Use the same labels as personal calendar (leave name, half/full, holiday name).
- Click day already opens a side list — keep it, just richer.

---

## 5. Suggested build order


| #   | Item                                                         | Size   |
| --- | ------------------------------------------------------------ | ------ |
| 1   | Designation × leave-type days matrix (policy UI)             | Medium |
| 2   | Click-day side panel on personal calendar + balance tab      | Small  |
| 3   | Open one employee’s personal calendar (HR / Admin / manager) | Medium |
| 4   | Manager vs HR leave inbox (clearer queues)                   | Medium |
| 5   | Align HR team calendar labels with personal calendar         | Small  |
| 6   | Point leave holiday usage at Business Calendar               | Small  |


---

## 6. Out of scope unless client says so

- New leave types engine (types already exist).
- Replacing approval workflow with a new product.
- Payroll / salary impact of leave.
- Changing Business Calendar ACTIVE / SHADOW rules.

---

## 7. One-line summary

**Most of leave already exists.**  
The next phase is: **clear designation-wise entitlements**, **one holiday source (Business Calendar)**, **click-day details + balances on the calendar**, and **each employee’s personal calendar for manager / HR / admin**.