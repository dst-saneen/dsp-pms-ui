# Business Calendar — Simple Testing Guide

**For:** Manager / Product reviewer who is new to this feature  
**Pilot company:** COM-000002 — Datascape Technology Kowdiar  
**Pilot branch:** BR-000002 — Kowdiar (`Asia/Kolkata`)  
**App:** open your usual frontend URL (example: `http://localhost:3200`)

---

## What this feature is (30 seconds)

Think of **Business Calendar** as the **office holiday + working-day calendar**.


| Thing                      | Meaning                                                  |
| -------------------------- | -------------------------------------------------------- |
| Business Calendar holidays | Office holidays (Independence Day, Onam, half-day, etc.) |
| Leave                      | Employee leave applications (Casual Leave, etc.)         |


They are related but **not the same**:

- Holidays = company/branch calendar rules  
- Leave = employee requests

---

## Accounts you will use

### A) Main admin (create users & employees)


|                  |                                                             |
| ---------------- | ----------------------------------------------------------- |
| Email / username | Obtain from the approved secret store                         |
| Password         | Obtain from the approved secret store                         |
| Role             | Super Administrator                                         |
| Use for          | Create **Employee** records + **User** logins, assign roles |


### B) HR Manager (run Business Calendar)

Create this in Part 1 (below). Example names:


|                | Suggested                                             |
| -------------- | ----------------------------------------------------- |
| Employee name  | Test HR Manager                                       |
| User email     | `uat.bc.hrmanager@example.test`                       |
| Password       | (set when you create user — write it here) __________ |
| Role to assign | **HR Manager** for company **COM-000002**             |


### C) Normal Employee (check My Workspace / Leave)

Create this in Part 1:


|                | Suggested                               |
| -------------- | --------------------------------------- |
| Employee name  | Test Calendar Employee                  |
| User email     | `uat.bc.employee@example.test`          |
| Password       | (write here) __________                 |
| Role to assign | **Employee** for company **COM-000002** |
| Branch         | **Kowdiar (BR-000002)**                 |


> Tip: Keep a notepad of emails/passwords you create.

---

# PART 1 — Create people (main admin)

**Login as:** an authorized Super Administrator account obtained from the
approved secret store.

---

## Step 1.1 — Create HR Manager employee

1. Go to **Human Resources → Employees** (`/hr/employees`).
2. Create a new employee:
  - Name: e.g. `Test HR Manager`
  - Company: **Datascape Technology Kowdiar (COM-000002)**
  - Branch: **Kowdiar (BR-000002)**
  - Department / designation: any valid ones
3. Save. Note the **employee code** (e.g. EMP-00xxxx).+





**Pass if:** Employee appears in the list.

---

## Step 1.2 — Create HR Manager user login

1. Go to **Administration → Users** (`/administration/users`).
2. Create / invite user:
  - Email: e.g. `uat.bc.hrmanager@example.test`
  - Link to the employee from Step 1.1 (if the form asks)
3. Assign role:
  - Role: **HR Manager**
  - Company scope: **COM-000002**
4. Set password (or complete invite). Write password down.

**Pass if:** User can log in and sees **Administration → Business Calendar**.

---

## Step 1.3 — Create normal Employee + user

1. Still as main admin, create another **Employee** on Kowdiar.
2. Create a **User** with role **Employee** for COM-000002.
3. Link user ↔ employee.
4. Write login + password.

**Pass if:** Employee login works and opens **My Workspace** / Leave (no Business Calendar admin menu).

---

# PART 2 — Business Calendar happy path (HR Manager)

**Logout** main admin.  
**Login as:** your new HR Manager.

---

## Step 2.1 — Open offices

1. Go to **Administration → Business Calendar**.
2. Select company: **COM-000002 — Datascape Technology Kowdiar**.

**Check:**

- Company calendar exists (parent)  
- Kowdiar branch calendar exists under it  
- Timezone **Asia/Kolkata**  
- You may see mode badges: `LEGACY` / `SHADOW` / `ACTIVE`

**Pass if:** Both company + branch calendars are visible.

---

## Step 2.2 — Create draft → working week → holiday → publish

1. Open **Company Calendar**.
2. Click **New draft version** (dates e.g. full year 2026).
3. Set **Working week** (Mon–Fri working, Sat/Sun off) → save.
4. **Add event** → Holiday (full day), e.g. name `Manager UAT Holiday`, date `2026-11-14`.
5. Optional: **Submit for review**.
6. Click **Publish** → confirm.

**Pass if:** Version status = **PUBLISHED**.

---

## Step 2.3 — Preview a day

1. Tab **Business Day Preview**.
2. Company COM-000002, Branch Kowdiar.
3. Date = your holiday date.
4. Run preview.

**Pass if:** Day shows holiday / non-working with a clear reason.

---

## Step 2.4 — Edit published calendar (amendment)

1. Open Company Calendar → select **PUBLISHED** version.
2. Click **Edit published calendar**.
3. Enter reason + effective date → create draft.
4. Change something (add half-day holiday or rename event).
5. **Publish** → review **impact preview** → **Acknowledge & publish**.

**Pass if:** New version published; old history still listed.

> Note: Impact “roster overlaps” are warnings, not a hard block after acknowledge.

---

## Step 2.5 — Government pack (optional but useful)

1. Tab **Imports**.
2. Select company + calendar + a **DRAFT** version.
3. Government pack: Country `IN`, Subdivision `IN-KL`, Year `2026` → Fetch.
4. Validate → select rows → **Apply to draft** (do not expect auto-publish).
5. Publish the draft when ready (same as 2.2 / 2.4).

**Pass if:** Holidays land on draft first, then publish when you choose.

---

## Step 2.6 — Employee must NOT manage calendars

1. Logout HR.
2. Login as normal **Employee**.
3. Check left menu.

**Pass if:** **Business Calendar** admin is **not** in the menu.  
(If they paste the URL, they should not be able to manage calendars.)

---

# PART 3 — Where things appear (very important)

## Business Calendar holidays show here


| Screen                                          | Who         | What                                                |
| ----------------------------------------------- | ----------- | --------------------------------------------------- |
| Business Calendar → Preview                     | HR          | Exact holiday result                                |
| Business Calendar → Offices / Versions / Events | HR          | Setup & history                                     |
| My Workspace → **Personal calendar**            | Employee    | Day label **HOLIDAY** (when office is **ACTIVE**)   |
| Leave request charging                          | Employee/HR | Holidays excluded from leave days (when **ACTIVE**) |


## Employee leave applications show here


| Screen                                 | Who      | What                             |
| -------------------------------------- | -------- | -------------------------------- |
| My Workspace → Leave history           | Employee | DRAFT / SUBMITTED / APPROVED     |
| My Workspace → Upcoming approved leave | Employee | Future approved leave            |
| My Workspace → Leave balances          | Employee | Balance numbers                  |
| My Workspace → Personal calendar       | Employee | **ON_LEAVE** / **PENDING_LEAVE** |
| HR → Leave                             | HR       | Manage leave requests            |


**Remember:**  

- Holiday on calendar ≠ Leave history row  
- If leave and holiday fall on same day, Personal calendar usually shows **leave** first

---

# PART 4 — Consumer check (Leave + My Workspace)

## Step 4.1 — While LEGACY / before ACTIVE

If office badge is still **LEGACY**:

- Leave may still follow old holiday master  
- That is OK and safe

## Step 4.2 — After ACTIVE (Kowdiar)

If Offices show **ACTIVE_MODE** for Kowdiar:

1. Login as **Employee**.
2. Open **My Workspace**.
3. Personal calendar should load.
4. Look at a published holiday date (e.g. Independence Day / Onam / your UAT holiday).
5. Open Leave → create a request that includes that holiday.
6. Check charged days — holiday should be excluded.

**Pass if:** Calendar loads; holiday affects leave charge; leave list still shows applications.

---

# PART 5 — Suggested test order (do this in order)

1. Main admin creates HR + Employee (Part 1)
2. HR opens Business Calendar offices (2.1)
3. HR publishes a holiday (2.2 + 2.3)
4. HR amends published calendar (2.4)
5. Employee cannot open Business Calendar admin (2.6)
6. Employee checks My Workspace + Leave (Part 3 + 4)
7. Optional: government import (2.5)
8. Optional: file CSV/Excel/ICS imports later (not required for first review)

---

# Pass / Fail sheet (copy for sign-off)


| #   | Check                                            | Pass / Fail | Notes |
| --- | ------------------------------------------------ | ----------- | ----- |
| 1   | Main admin can create employee                   |             |       |
| 2   | Main admin can create user + role                |             |       |
| 3   | HR sees Business Calendar                        |             |       |
| 4   | Company + Kowdiar calendars visible              |             |       |
| 5   | Draft → publish holiday works                    |             |       |
| 6   | Day preview correct                              |             |       |
| 7   | Edit published (amendment) works                 |             |       |
| 8   | Employee cannot manage Business Calendar         |             |       |
| 9   | Employee My Workspace calendar loads             |             |       |
| 10  | Holidays vs Leave locations understood           |             |       |
| 11  | ACTIVE leave charge excludes holiday (if ACTIVE) |             |       |


**Tester name:** __________  
**Date:** __________  
**Overall:** Pass / Fail  

---

# Common problems (simple fixes)


| Problem                                                         | Likely cause                                              | What to do                                                |
| --------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| No Business Calendar menu                                       | User is not HR/Admin                                      | Assign **HR Manager** + calendar permissions              |
| Publish error                                                   | Temporary / coverage issue                                | Retry; if same start date amendment, refresh and retry    |
| Personal calendar error “No effective company calendar version” | Published version date range does not cover the month     | Publish/amend so coverage includes the full year needed   |
| Holiday not in Leave history                                    | Expected                                                  | Holidays are not leave applications                       |
| Holiday not visible on Personal calendar                        | Office still LEGACY, or leave on same day, or wrong month | Check ACTIVE badge; check month; check leave on that date |


---

# One sentence for stakeholders

> HR sets office holidays in Business Calendar; employees apply leave in Leave; My Workspace shows both — holidays as HOLIDAY days and leave as leave status — and ACTIVE mode makes Leave charging follow Business Calendar.

---

*End of testing guide.*
