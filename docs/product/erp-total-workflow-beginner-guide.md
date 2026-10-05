# ERP total workflow guide (simple — start to finish)

**For:** You joined mid-project and need to understand how everything connects, then test it yourself.  
**App:** Frontend `http://localhost:3200` · Backend `http://localhost:4500`  
**Pilot company to practice on:** Use your **own fresh org** — see step-by-step guide below (not Kowdiar / not `leave.uat.*`).

> **Create everything fresh (recommended):**  
> **[`erp-from-zero-step-by-step-guide.md`](./erp-from-zero-step-by-step-guide.md)** — register a new organization (`Learn Fresh Org 01`) and build company → people → calendar → leave → onboarding → attendance from scratch.

---

## Big picture (one diagram)

Think of the product as layers. **Each layer needs the one above it.**

```text
1. Organization (Company Group → Company → Branch → Dept → Designation → Shift)
        ↓
2. People (Employee record + User login + Role + link them together)
        ↓
3. Business Calendar (office holidays + working week)  ← publish this
        ↓
4. Leave (types → matrix → balances → apply → Manager → HR)
        ↓
5. Onboarding (template → publish → start for employee → tasks)
        ↓
6. Attendance (shifts → work schedule/roster → check-in/out → HR attendance)
        ↓
7. My Workspace (employee sees leave + calendar + attendance + onboarding in one place)
```

**Boss meaning:** backend already has this flow. Your job is to **create/check data in order**, then walk each screen so you understand how real work moves through the system.

---

## Before you start

1. Backend running on **4500** (`pnpm run start:dev` in `backend`).
2. Frontend on **3200**.
3. Open login: `http://localhost:3200/login`.
4. Follow the **fresh start** path in [`erp-from-zero-step-by-step-guide.md`](./erp-from-zero-step-by-step-guide.md) — register `Learn Fresh Org 01` and build everything new (do not use Kowdiar or `leave.uat.*`).

### Your fresh test accounts (you create these in STEP 8–9)

| Who | Login (example) | Used for |
|-----|-----------------|----------|
| Employee | `learnfresh.emp01@example.test` | My Workspace, apply leave |
| Manager | `learnfresh.mgr01@example.test` | Manager leave approve |
| HR | `learnfresh.hr01@example.test` | Matrix, HR leave approve, calendars |

You choose passwords when creating users — write them in a notepad.

**Organization Owner** (from `/register`) is your main admin login for creating structure and users.

---

## Chapter 0 — What is an “Employee” vs a “User”?

This confuses everyone at first.

| Thing | Meaning |
|-------|---------|
| **Employee** | The person in HR data (name, company, branch, manager, designation). Lives under **HR → Employees**. |
| **User** | The login account (username/email + password + roles). Lives under **Administration → Users**. |
| **Link** | User must be linked to an Employee, or **My Workspace** will say employee link is required. |

**Correct order when creating a person:**

1. Create **Employee** (with company, branch, department, manager).  
2. Create / invite **User**.  
3. Link User → that Employee.  
4. Assign role (Employee / HR Manager / etc.) scoped to the company or branch.

---

## Chapter 1 — Organization (the root)

### What this is
The skeleton of the tenant. Nothing else works without it.

### Order to create / check

| Step | What | Where in UI |
|------|------|-------------|
| 1 | Company Group (organization) | Administration → Company Groups |
| 2 | Company | Administration → Companies |
| 3 | Branch (office) — set **timezone** (e.g. Asia/Kolkata) | Administration → Branches |
| 4 | Department | Administration → Departments |
| 5 | Designation (job title / role row for leave matrix) | Administration → Designations |
| 6 | Shift (work timing template) | Administration → Shifts |

### New customer path (from zero)

1. `/register` → email OTP  
2. `/onboarding` wizard → Group → Company → Branch → Department → Finish  
3. Land on `/dashboard`

### What to check (your fresh company)

- [ ] `Learn Fresh Company 01` exists (your company code, e.g. COM-…)  
- [ ] `Learn Fresh HQ 01` branch exists and has timezone **Asia/Kolkata**  
- [ ] At least one department (`General`)  
- [ ] At least one designation (`Staff`) — needed for leave matrix rows  
- [ ] At least one shift (`Day Shift 01`) — needed later for attendance

**Why it matters:** Leave matrix is **branch × designation × leave type**. No designation → empty matrix.

---

## Chapter 2 — People (employees + logins)

### Where

- HR → **Employees** (`/hr/employees`)  
- Administration → **Users** (`/administration/users`)  
- Administration → **Security** (roles) (`/administration/security`)

### What to do

1. Open Employees — create Alex Manager, Sam HR, Jamie Employee on **Learn Fresh Company 01**.  
2. Set **Reporting manager** on Jamie → Alex (needed for leave Manager step).  
3. Open Users — create logins and **link** each to the matching employee.  
4. Confirm roles:
   - Employee → can open My Workspace  
   - Manager → can approve team leave (`hr.team.approve` style rights)  
   - HR Manager → leave + business calendar + HR queues  

### Quick check with your Learn Fresh trio

| Login | Should see |
|-------|------------|
| `learnfresh.emp01` | My Workspace; **not** full admin leave matrix (or limited) |
| `learnfresh.mgr01` | Leave → Requests → Manager review |
| `learnfresh.hr01` | Leave policies, HR review, business calendar |

- [ ] Emp has a manager  
- [ ] Mgr can log in  
- [ ] HR is a **different** person than emp and mgr  

**Why it matters:** Leave submit needs Manager, then HR. Same person for all three will break or confuse the chain.

---

## Chapter 3 — Business Calendar (office holidays)

### What this is
The **office calendar**: which days are working days, week offs, holidays.  
This is **not** employee leave. Leave = “I want time off.” Calendar = “office is closed for Onam.”

### Modes (you will see these words)

| Mode | Meaning |
|------|---------|
| **LEGACY** | Old holiday master (`/hr/leave/holidays`) still editable |
| **SHADOW** | Business Calendar exists; leave may still use old rules for duration in some cases |
| **ACTIVE** | Leave day-count follows Business Calendar (holidays not charged as leave days) |

### Where

Administration → **Business Calendar** (`/administration/business-calendar`)

### Happy path to test

1. Login as **learnfresh.hr01** (Sam HR).  
2. Open company calendar for **Learn Fresh Company 01**.  
3. **New draft version**.  
4. Set **working week** (Mon–Fri working, etc.).  
5. **Add event** → Holiday (full day) on a weekday.  
6. **Publish**.  
7. Open **Preview** → pick **Learn Fresh HQ 01** + that date → should show holiday / non-working.  
8. As Employee → My Workspace calendar → that date should look like a holiday (when ACTIVE).

### Related page

HR → Leave → **Holidays** (`/hr/leave/holidays`) — legacy bridge. If office is ACTIVE/SHADOW, creating legacy holidays may be blocked; use Business Calendar instead.

- [ ] Draft created  
- [ ] Holiday added  
- [ ] Published  
- [ ] Preview matches  

**Why it matters next:** Leave duration and workforce calendar use this when ACTIVE.

---

## Chapter 4 — Leave (types → matrix → balance → approve)

### Flow in one line

```text
Leave Type → Policy Matrix (days per designation) → Generate Balances
    → Employee applies → Manager approves → HR final approves → balance consumed
```

### 4.1 Leave types

**Where:** HR → Leave → Types (`/hr/leave/types`)  
**Check:** `Casual Leave` exists for **Learn Fresh Company 01**.

### 4.2 Policy matrix

**Where:** HR → Leave → Policies (`/hr/leave/policies`) → **Matrix** tab  

1. Login `learnfresh.hr01`.  
2. Company **Learn Fresh Company 01**, branch **Learn Fresh HQ 01**.  
3. Grid = **rows designations**, **columns leave types**, cells = days.  
4. Turn on a cell, enter days **> 0**, save with a reason.  
5. Try **0 days** while enabled → must be rejected.

**Important:** Saving the matrix does **not** automatically rewrite existing employee balances.

### 4.3 Balances

**Where:** HR → Leave → Balances (`/hr/leave/balances`)  

1. Generate balances → dry run first.  
2. Apply only if you need missing rows for the year.

### 4.4 Full leave request path (must do this once)

| Step | Who | Where | What happens |
|------|-----|-------|----------------|
| 1 | Emp | My Workspace → Apply leave | Draft → Submit → status **SUBMITTED**, days go to **pending** |
| 2 | Mgr | Leave → Requests → **Manager review** | Approve once → still SUBMITTED, stage becomes **HR** (not fully approved) |
| 3 | Mgr again | Same request | Second approve should **fail** / conflict |
| 4 | HR | Leave → Requests → **HR review** | Final approve → **APPROVED**, used↑ pending↓ |
| 5 | Emp | Own request | Cannot approve self |

### Also look at

- HR → Leave → Calendar (team month)  
- HR → Leave → Comp-off (later)

- [ ] Matrix save works  
- [ ] Emp submit works  
- [ ] Mgr → HR chain works  
- [ ] Final approve updates balance  

---

## Chapter 5 — Onboarding

### What this is
Checklist for a new joiner (documents, tasks, training). Separate from leave, but uses the **same employee**.

### Flow

```text
Design template (Draft) → Validate → Publish
    → Start onboarding for an employee → Complete / skip tasks → Finish
```

### Where

| What | Page |
|------|------|
| Templates | HR → Onboarding Templates (`/hr/onboarding-templates`) |
| Live instances | HR → Employee Onboarding (`/hr/employee-onboarding`) |
| Employee view | My Workspace (onboarding tasks) |

### What to test

1. Create or open a template → add department / tasks.  
2. Publish a version.  
3. Start onboarding for **Jamie Employee** (Learn Fresh).  
4. Complete a task as HR or as the employee from My Workspace.  
5. Confirm in-flight onboarding keeps its snapshot if you later edit the template.

- [ ] Template published  
- [ ] Instance started  
- [ ] Task completed  

**Why after leave:** Same people; onboarding often runs while leave/attendance also exist.

---

## Chapter 6 — Attendance (shifts → roster → punch)

### What this is
“Who works when” + “who punched in/out”.

### Flow

```text
Shifts (master) → Assign employees to shifts → Work Schedule / Roster (publish)
    → Employee Check-in / Check-out (My Workspace)
    → HR Attendance daily / exceptions / period close
```

### Where

| What | Page |
|------|------|
| Shift masters | Administration → Shifts |
| Roster / work schedule | HR → Work Schedule (`/hr/work-schedule`) |
| Daily attendance | HR → Attendance (`/hr/attendance`) |
| Exceptions | HR → Attendance → Exceptions |
| Periods | HR → Attendance → Periods |
| Employee punch | My Workspace |

### What to test

1. Confirm shifts exist.  
2. HR → Work Schedule → create/generate a roster for **Learn Fresh HQ 01** for a short period → publish.  
3. Login as employee → My Workspace → **Check in** / **Check out** on a workday.  
4. HR → Attendance → see the punches; open Exceptions if something is missing.  
5. Optional later: Overtime (`/hr/overtime`), Comp-off.

- [ ] Roster published  
- [ ] Check-in visible to HR  
- [ ] Exception path understood  

**Depends on:** Branch timezone + calendar (holidays / week offs) + employee + shift.

---

## Chapter 7 — My Workspace (employee home)

### What this is
One page for the employee: identity, calendar, leave, attendance, onboarding, documents/assets (if enabled).

**Where:** `/my-workspace`

### What to check as `learnfresh.emp01` (Jamie)

- [ ] Name / company / branch correct  
- [ ] Calendar Month / List / Balances tabs  
- [ ] Click a day → side panel  
- [ ] Apply leave works  
- [ ] Check-in/out appears if roster allows  
- [ ] No Manager/HR approve buttons on own leave  
- [ ] Onboarding tasks show if an instance exists  

If you see **Employee link required** → User is not linked to an Employee (go back to Chapter 2).

---

## Recommended practice order (do this over 1–2 days)

Do **not** jump to attendance first. Follow this checklist in order.

### Day path A — understand structure (your org owner)

1. Login as **Organization Owner** (from register)  
2. Walk Companies → Branches → Departments → Designations → Shifts  
3. Walk Employees + Users for **Learn Fresh Company 01**  
4. Confirm `learnfresh.*` users exist and are linked to employees  

### Day path B — calendar + leave (HR / Emp / Mgr)

1. HR: Business Calendar draft → holiday → publish → preview  
2. HR: Leave types + matrix + balances  
3. Emp: apply leave  
4. Mgr: manager approve  
5. HR: final approve  
6. Emp: confirm balance / calendar  

### Day path C — onboarding + attendance

1. HR: publish onboarding template → start for one employee  
2. Emp: see/complete a task in My Workspace  
3. HR: publish work schedule  
4. Emp: check-in / check-out  
5. HR: attendance screen  

---

## How modules connect (cheat sheet)

| If this is missing… | Then this breaks… |
|---------------------|-------------------|
| Company / Branch | Everything |
| Designation | Leave matrix rows empty |
| User ↔ Employee link | My Workspace |
| Manager on employee | Leave Manager step |
| Scoped HR Manager | Leave HR step / submit may fail “no eligible HR” |
| Published Business Calendar (ACTIVE) | Holiday exclusion in leave duration / calendars |
| Leave matrix + balances | Employee cannot apply leave |
| Shifts / roster | Realistic attendance |

---

## Menu map (where to click)

### Administration
- Company Groups, Companies, Branches, Departments, Designations, Shifts  
- Users, Security  
- Business Calendar (+ preview, imports, impacts)

### HR
- Employees  
- Leave (Requests, Types, Policies, Balances, Calendar, Holidays, Comp-off)  
- Onboarding Templates, Employee Onboarding  
- Work Schedule, Attendance, Overtime  
- Documents (related)

### Employee
- My Workspace  
- Dashboard  

---

## Extra reading (when you want depth)

| Topic | Doc |
|-------|-----|
| Leave UI steps | `docs/product/leave-next-phase-ui-testing-guide.md` |
| Leave UAT run sheet | `docs/product/leave-policy-matrix-migration-phase8-run-sheet.md` |
| Business Calendar testing | `docs/product/business-calendar-manager-testing-guide.md` |
| Formal full UAT gates | `docs/testing/erp-production-workflow-manual-uat-guide.md` (if present) |
| Org wizard | `docs/getting-started/organization-onboarding.md` |

---

## One sentence to remember

**Create the company world → create people and logins → publish the office calendar → configure leave and run Manager→HR → run onboarding → publish roster and punch attendance → confirm it all on My Workspace.**

Start at **[`erp-from-zero-step-by-step-guide.md`](./erp-from-zero-step-by-step-guide.md) STEP 0A** — register a fresh org. When something fails, use the cheat sheet: almost always a missing prerequisite above that step.
