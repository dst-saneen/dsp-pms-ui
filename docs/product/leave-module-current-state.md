# Leave module — how it works today

**Audience:** Product / managers reviewing Leave before a major update  
**Scope:** Current live behaviour in this ERP (setup → balances → apply → approve → calendars → related pieces)  
**Date:** 2026-09-15  
**Status:** Current state only (not a future roadmap)

---

## 1. One-sentence picture

HR sets **leave types** and **how many days each role gets per year**, then **generates yearly balances**. Employees **apply leave** from My Workspace. Requests go to the **reporting manager first, then HR**. Approved leave shows on the **workforce calendar**. Holidays come from **Business Calendar**. Comp-off from overtime lands in a special leave balance.

---

## 2. Menu map (where everything lives)

### Human Resources → Leave

| Screen | Route | What it is for |
|--------|--------|----------------|
| **Requests** | `/hr/leave` | Approve / reject / cancel leave; manager queue and HR queue |
| **Employee Leave Balance** | `/hr/leave/balances` | See each employee’s leave buckets; generate balances for a year |
| **Calendar** | `/hr/leave/calendar` | Team month view, or one employee’s personal-style month |
| **Comp-off** | `/hr/leave/comp-off` | Credits earned from overtime; revoke unused credits |
| **Types** | `/hr/leave/types` | Define Casual, Sick, etc. (per company) |
| **Policies** | `/hr/leave/policies` | Set **days per year by designation** (matrix) + leave-type summary |
| **Holidays** | `/hr/leave/holidays` | Bridge to **Business Calendar** (legacy list only if office still LEGACY) |

### My Workspace

| What | What it is for |
|------|----------------|
| **Apply leave** | Employee creates / submits a leave request |
| **Leave balance card** | Quick view of entitlement / used / pending / available |
| **Upcoming leave** | Short snippet of upcoming leave |

### Employee profile

| What | What it is for |
|------|----------------|
| **Leave tab** | HR view of that person’s balances, upcoming leave, history |

---

## 3. End-to-end flow (happy path)

```text
1. Create Leave Types          (HR → Leave → Types)
2. Set Policies by role        (HR → Leave → Policies → Designation matrix)
3. Generate yearly balances    (HR → Leave → Employee Leave Balance → Generate)
4. Employee applies leave      (My Workspace → Apply leave)
5. Manager reviews             (HR → Leave → Requests → Manager review)
6. HR reviews (final)          (HR → Leave → Requests → HR review)
7. Balance updates             (pending → used when finally approved)
8. Shows on calendar           (HR → Leave → Calendar / employee views)
```

If any early step is missing (no type, no policy for that role, no balance generated), apply / generate will fail or skip that person.

---

## 4. Setup pieces (config)

### 4.1 Leave Types

**Where:** HR → Leave → Types  

**What:** Catalog of leave kinds for a **company** (Casual Leave, Sick Leave, Comp-off type, etc.).

Typical settings:

- Code + name (unique per company)
- Paid or unpaid
- Requires approval
- Allow half day
- Carry-forward allowed
- Active / inactive

**Rule:** Types are **company-wise**. Selecting a company filters the list. Edit does not move a type to another company.

---

### 4.2 Leave Policies (days per year by role)

**Where:** HR → Leave → Policies  

Policies answer: *“For this office, for this leave type, how many days does this designation get in a year?”*

#### Designation matrix (main setup)

- **Rows** = designations (Architect, HR Manager, …)
- **Columns** = leave types (CL, SL, …)
- **Cell** = days **per year** (decimals allowed, e.g. `18.5`)
- Checkbox off = that role does not get that leave type (policy disabled)

Example today:

| Designation | Casual Leave | Sick Leave |
|-------------|--------------|------------|
| Architect   | 24 / year    | 12 / year  |
| Studio Lead | 24 / year    | 12 / year  |

#### By leave type tab (summary only)

- Shows **one row per leave type** (per branch), not one row per designation
- Read-only summary (days/year, roles covered, carry-forward / negative if present)
- **Does not** replace the matrix for editing days

#### How the system picks the right policy

When calculating leave for an employee, the system chooses the **most specific** matching policy:

1. Branch + Department + Designation  
2. Branch + Designation  
3. Branch + Department  
4. Branch default  

If two policies tie at the same level → configuration conflict (must fix setup).

#### Important: saving policy ≠ updating balances

- Saving the matrix **updates policies only**
- It **does not** recalculate existing employee balances
- After policy changes, HR must use **Generate balances** for people who still need a balance row (generate does **not** overwrite existing yearly balances)

---

### 4.3 Holidays

**Source of truth:** Administration → **Business Calendar**  

**Leave → Holidays** is a bridge page:

- Prefer Business Calendar for holiday / non-working days
- Old holiday list remains only for offices still in **LEGACY** calendar mode

When counting leave days, non-working days and holidays are **excluded** from charged leave (using Business Calendar when that office is **ACTIVE**).

---

## 5. Employee Leave Balance

**Where:** HR → Leave → Employee Leave Balance  

For each employee and leave type (for a year), the system keeps:

| Field | Meaning |
|-------|---------|
| **Entitlement** | Days granted for the year (from policy + carry-forward / accruals) |
| **Used** | Days already taken (final approved) |
| **Pending** | Days reserved while a request is waiting approval |
| **Available** | What the employee can still spend |

### Generate balances

- HR picks year (and scope)
- For each employee × leave type **without** a balance yet:
  - Resolve policy for that person’s designation / office
  - Create entitlement (and carry-forward from prior year when allowed)
- Employees who **already** have a balance for that year are **left unchanged**
- Employees with **no matching policy** are reported as issues / skipped

So: **policy change after generate does not auto-fix old balances**.

---

## 6. Applying leave (employee)

**Where:** My Workspace → **Apply leave**

Employee chooses:

- Leave type  
- From / to dates  
- Half day (if the type allows)  
- Reason  

Then either:

- **Submit now** → enters approval, or  
- Save as **draft** (if supported on the form)

### How days are counted

- Only **working days** are charged  
- Holidays / weekly offs are excluded  
- Half-day can charge `0.5` when allowed  
- Branch timezone is required for correct day math  

### Balance on submit

- If approval is required, days move into **Pending** (reserved)  
- Available goes down immediately so the same days cannot be double-booked  
- Final HR approve moves pending into **Used**  
- Reject / cancel returns pending (or used, when cancelling approved leave as allowed) back to available  

---

## 7. Approval (manager → HR)

**Where:** HR → Leave → Requests  

Workflow today:

```text
Employee submits
    → Reporting manager review
    → HR review (final)
    → Approved / Rejected
```

Behaviour:

- Only the **current** approver can decide  
- Manager step can be skipped if there is no eligible reporting manager  
- Queues separate **Manager review**, **HR review**, completed, and all  
- Balances stay **reserved (pending)** until **final HR approve**  

Cancel is available for draft / submitted (and further cancel paths for approved leave where the service allows it).

---

## 8. Calendars

### HR / team calendar

**Where:** HR → Leave → Calendar  

- Month view of the team (who is on leave that day)  
- Or pick **one employee** and see their personal-style month (leave type, half/full, holiday, pending/approved)  
- Click a day → side detail  

### My Workspace personal calendar

- A full personal leave calendar component exists in code  
- On the current My Workspace home, employees mainly see **Apply leave** + **balance cards**, not the full month grid mounted as a primary block  

(Use HR Calendar’s employee picker when someone needs to open one person’s calendar.)

---

## 9. Comp-off

**Where:** HR → Leave → Comp-off  

How it connects to leave:

1. Overtime is approved  
2. System creates a **comp-off credit** against a company leave type of category **COMP_OFF**  
3. That credit increases that type’s leave **entitlement / available**  
4. Employee can later take leave against that type (allocations may be reserved / consumed)  
5. HR can **revoke** a credit only if it is still unused / unreserved  

Comp-off is part of the leave balance story, not a separate attendance module.

---

## 10. What each persona does

| Persona | Typical actions |
|---------|-----------------|
| **HR / Admin** | Types, policies (matrix), generate balances, HR approve queue, calendar, holidays via Business Calendar, comp-off revoke |
| **Manager** | Approve / reject team leave in Manager review; view team calendar |
| **Employee** | Apply leave; see own balances; see upcoming leave |

---

## 11. Backend building blocks (for technical readers)

| Module | Responsibility |
|--------|----------------|
| `leave-type` | Company leave type CRUD |
| `leave-policy` | Policies, designation matrix, policy resolution, leave day calculation |
| `leave-request` | Create / submit / approve / reject / cancel |
| `employee-leave-balance` | Balance list, generate, ledger transactions |
| `employee-leave` | Employee leave profile (summary, history, upcoming) |
| `holiday` | Legacy holidays + mode bridge |
| `comp-off` | Credits, revoke, allocation vs leave requests |
| Related | `workforce-approval` (LEAVE_APPROVAL), `business-calendar` (ACTIVE offices) |

---

## 12. Current rules managers should remember

1. **Days are per year** in setup (not per month). Example: `24` = 24 days for the year.  
2. **Matrix edits policies only** — it does not rewrite existing balances.  
3. **Generate** creates missing balances; it does not refresh entitlement on existing rows.  
4. After changing policy days, plan how to handle people who already have a balance for that year (manual process / future product work).  
5. **By leave type** tab is a **summary**, not the editor.  
6. Approval is **manager then HR**; pending holds days until final approve.  
7. Holidays for leave counting come from **Business Calendar** when the office is ACTIVE.  
8. Comp-off feeds a leave balance type; it is not separate “extra leave” outside that model.

---

## 13. Simple glossary

| Term | Meaning |
|------|---------|
| **Leave type** | Kind of leave (CL, SL, Comp-off, …) |
| **Designation** | Job role (Architect, Studio Lead, …) |
| **Policy** | Rule: this office + role + leave type → days/year |
| **Balance** | One employee’s yearly bucket for one leave type |
| **Pending** | Reserved while waiting approval |
| **Used** | Fully approved leave taken |
| **Available** | Still usable days |
| **Matrix** | Grid of roles × leave types for setup |
| **Business Calendar** | Official holidays / working days source |

---

## 14. Suggested demo path (to walk someone through)

1. Open **Types** → show company Casual / Sick.  
2. Open **Policies → Designation matrix** → show 24 / 12 by role.  
3. Open **By leave type** → show short summary (not per designation).  
4. Open **Employee Leave Balance** → expand one person → show entitlement / used / pending / available → mention Generate.  
5. As employee: **My Workspace → Apply leave**.  
6. As manager/HR: **Requests** → approve path.  
7. Open **Calendar** → see the leave on the month.  
8. Mention **Holidays** = Business Calendar, and **Comp-off** if OT is in use.

---

*This document describes current Leave behaviour for planning the next major Leave update. It is not a change proposal.*
