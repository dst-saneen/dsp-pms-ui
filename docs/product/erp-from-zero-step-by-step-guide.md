# Fresh start guide — create everything new (no old UAT data)

**Purpose:** Learn the full ERP flow by creating **your own new organization** from scratch.  
**Do NOT use:** Kowdiar, COM-000002, `leave.uat.*`, or any existing test company.  
**Do NOT edit:** Old companies in the shared database — only create and use **your new names** below.

**How we work:** Complete **one step**, reply `STEP X: PASS` or paste the error. I fix it, then you continue.

---

## Rules (read first)

1. **Everything you create is new.** Old rows may still appear in dropdown lists — **always pick only your Learn Fresh names**.
2. **Write a notepad** with every login, password, company code, branch code, employee code you create.
3. **Backend + frontend must run** before any step.
4. **One step at a time** — do not jump to leave until company + people exist.

| App | URL | Command |
|-----|-----|---------|
| Frontend | http://localhost:3200 | `pnpm run dev` in `frontend` |
| Backend | http://localhost:4500 | `pnpm run start:dev` in `backend` |

---

## Your fresh naming (use these everywhere)

Pick one suffix so your data is easy to find (example uses `01` — change if you register twice):

| Layer | Your new name |
|-------|----------------|
| Organization (Company Group) | `Learn Fresh Org 01` |
| Company | `Learn Fresh Company 01` |
| Branch (office) | `Learn Fresh HQ 01` |
| Department | `General` |
| Designation | `Staff` |
| Shift | `Day Shift 01` |
| Employee — Manager | `Alex Manager` |
| Employee — HR | `Sam HR` |
| Employee — Staff | `Jamie Employee` |
| User emails (you choose passwords) | `learnfresh.mgr01@example.test` |
| | `learnfresh.hr01@example.test` |
| | `learnfresh.emp01@example.test` |
| Leave type | `Casual Leave` |
| Owner login (from register) | **Your real email** + password you set |

---

## Which path? (choose one)

### PATH A — Register (recommended — 100% fresh, like a new customer)

You create a **brand-new organization**. You become **Organization Owner**.  
No Super Admin needed. No old company data involved.

**Start at STEP 0A below.**

### PATH B — Super Admin creates a new Company Group (fallback)

Use only if register/OTP email fails in your environment.

| Login | Password | Role |
|-------|----------|------|
| Obtain from the approved secret store | Obtain from the approved secret store | Super Administrator |

Super Admin creates **new** Company Group + Company + Branch — still use Learn Fresh names only.

**Start at STEP 0B below** (section at end of this doc).

---

# PATH A — Register new organization (recommended)

## STEP 0A — Open registration

1. Open http://localhost:3200/login  
2. Click **Create an organization** (or go to http://localhost:3200/register)  
3. You should see the registration form (organization name, your name, email, password)

**PASS when:** Registration page loads.

**If fail:** Send error + screenshot description.

---

## STEP 1A — Register + verify email (OTP)

1. Fill the form:
   - Organization name: `Learn Fresh Org 01`
   - Your name: (your name)
   - Business email: **use an email you can read** (OTP is sent there)
   - Password: choose a strong password — **write it down**
2. Submit  
3. Enter the **6-digit OTP** from email  
4. If email does not arrive: wait 60s → use Resend; check spam; in dev ask team if OTP is logged anywhere

**PASS when:** Browser redirects to **Organization onboarding** (`/onboarding`).

**Write down:** Owner email + password (this is your main login from now on for PATH A).

---

## STEP 2A — Onboarding: Company Group profile

You are now **Organization Owner** of a new tenant (new Company Group + first Company were created at registration).

1. On `/onboarding`, complete **Company Group** step  
2. Confirm name: `Learn Fresh Org 01`  
3. Save / Continue  

**PASS when:** Moves to Company step.

---

## STEP 3A — Onboarding: Company (legal entity)

1. Confirm / edit company name: `Learn Fresh Company 01`  
2. Registration/tax fields optional for learning  
3. Continue  

**PASS when:** Moves to Branch step.

**Write down:** Generated **company code** (e.g. `COM-...`) if shown.

---

## STEP 4A — Onboarding: Branch (office)

1. Branch name: `Learn Fresh HQ 01`  
2. Address / city optional  
3. Country code: use `IN` if India (or leave as shown)  
4. Continue  

**Note:** The onboarding Branch screen does **not** show a Timezone field. That is normal. After you finish onboarding, set timezone under **Administration → Branches → Edit** your branch → `Asia/Kolkata` (STEP 6A follow-up).

**PASS when:** Moves to Structure / Department step.

**Write down:** Branch code (e.g. `BR-...`).

---

## STEP 5A — Onboarding: Department (+ optional designation & shift)

1. Department name: `General`  
2. If the wizard offers **Designation**: add `Staff`  
3. If the wizard offers **Shift**: add `Day Shift 01` (e.g. 09:00–18:00)  
4. Continue  

**PASS when:** Review step shows Company + Branch + Department complete.

---

## STEP 6A — Finish onboarding

1. Review summary  
2. Click **Finish setup**  
3. You should land on **Dashboard** (`/dashboard`)

**PASS when:** Dashboard opens; left menu shows Administration + HR.

You now have a **fresh tenant**: new group, company, branch, department — nothing from Kowdiar.

---

## STEP 7 — Add Designation & Shift (if wizard skipped them)

Skip if already created in STEP 5A.

1. **Administration → Designations** → create `Staff` for **Learn Fresh Company 01**  
2. **Administration → Shifts** → create `Day Shift 01`  

**PASS when:** Both exist under your company only.

---

## STEP 8 — Create 3 Employees (order matters)

Open **HR → Employees → New** (`/hr/employees/new`).  
**Always select Learn Fresh Company 01 + Learn Fresh HQ 01** — not any other company.

### 8.1 Manager first

| Field | Value |
|-------|--------|
| Name | Alex Manager |
| Company | Learn Fresh Company 01 |
| Branch | Learn Fresh HQ 01 |
| Department | General |
| Designation | Staff |
| Reporting manager | *(leave empty)* |

Save → write **employee code** (EMP-…).

### 8.2 HR second

| Field | Value |
|-------|--------|
| Name | Sam HR |
| Same company/branch/dept | |
| Reporting manager | Alex Manager (optional) |

Save → write code.

### 8.3 Employee last

| Field | Value |
|-------|--------|
| Name | Jamie Employee |
| Same company/branch/dept | |
| Reporting manager | **Alex Manager** (required for leave) |

Save → write code.

**PASS when:** 3 employees exist; Jamie’s manager = Alex.

---

## STEP 9 — Create Users + link to Employees + roles

Open **Administration → Users**. Create **3 new users** (do not reuse old UAT logins).

For each user:

1. **Invite / Create user**  
2. Email = one of your `learnfresh.*@example.test` addresses  
3. **Link to the matching Employee** (Alex / Sam / Jamie)  
4. Assign role + scope:

| User | Role | Scope |
|------|------|--------|
| learnfresh.mgr01 | Needs team approve for leave — often **HR Manager** or role with `hr.team.approve` (if UI confusing, stop and ask me at this step) | Your **company** or **branch** |
| learnfresh.hr01 | **HR Manager** | Learn Fresh Company 01 |
| learnfresh.emp01 | **Employee** | Learn Fresh Company 01 or branch |

5. Complete invitation → set password → write login + password in notepad  

**PASS when:** You can log out and log in as each of the 3 users.

**Common errors**

| Error | Fix |
|-------|-----|
| My Workspace: “Employee link required” | User not linked to employee |
| Leave submit: no eligible HR | HR user needs HR_MANAGER on this company |
| Manager queue empty | Jamie’s manager must be Alex; Alex’s user must be linked to Alex employee |

---

## STEP 10 — Login smoke (your 3 users only)

| Login | Check |
|-------|--------|
| learnfresh.emp01 | `/my-workspace` shows Jamie, Learn Fresh company |
| learnfresh.mgr01 | Leave → Requests opens |
| learnfresh.hr01 | Leave → Policies, Business Calendar |

**PASS when:** All three work.

---

## STEP 11 — Business Calendar (your company only)

1. Login as **learnfresh.hr01**  
2. **Administration → Business Calendar**  
3. Select **Learn Fresh Company 01** (ignore other companies in list)  
4. Open company calendar → **New draft**  
5. Set working week (Mon–Fri working)  
6. **Add holiday** on a future weekday  
7. **Publish**  
8. **Preview** → branch Learn Fresh HQ 01 → that date = holiday  

**PASS when:** Preview shows non-working / holiday.

---

## STEP 12 — Leave types + matrix + balances

### 12.1 Leave type

**HR → Leave → Types** → create `Casual Leave` for **Learn Fresh Company 01**.

### 12.2 Policy matrix (days **per month**)

**HR → Leave → Policies → Matrix**

- Company: **Learn Fresh Company 01**
- Branch: **Learn Fresh HQ 01**
- Enable **Staff × Casual Leave**
- Enter **days per month** (not per year). Example: **2** = 2 days every month → yearly entitlement = **2 × 12 = 24 days** for the year
- Save with reason (min 3 chars)

**Important:** Saving the matrix **does not** create employee balances automatically. You will see: *“Existing leave balances were not auto-updated.”*

Try **0 days** on an enabled cell → must **reject**.

### 12.3 Employee balances (generate once)

**HR → Leave → Balances** — this page **lists employees and their balances** (expand a row to see leave types).

If Jamie shows **“No employee leave balances”**:

1. Click **Generate balances** (top-right button)
2. Year: **2026** (or current year)
3. Company: **Learn Fresh Company 01** (optional but recommended)
4. Keep **Dry run only** checked → **Run dry run** → check “To create” count looks right
5. Uncheck dry run → **Generate**
6. Click **Refresh** — expand **Jamie Employee** → should show **Casual Leave** with entitlement = monthly × 12 (e.g. 2/month → **24** entitlement)

**PASS when:** Jamie has a Casual Leave balance row for the year.

---

## STEP 13 — Leave flow (Manager → HR)

1. **Jamie** → My Workspace → Apply leave on a **working day** (not your holiday) → Submit  
2. **Alex (mgr)** → Leave → Requests → **Manager review** → Approve **once**  
   - Status should stay **SUBMITTED**, stage moves toward HR (not fully approved yet)  
3. **Alex** → Approve same request again → should **fail** (conflict / not allowed)  
4. **Sam (hr)** → Leave → **HR review** → Final approve → **APPROVED**  
5. **Jamie** → cannot approve own request  

**PASS when:** Full chain works on **your** company only.

---

## STEP 14 — Onboarding (your employees)

There is **no New button** on Onboarding Templates. Templates are built **per designation** (your `Staff` row).

### 14.1 Configure template for Staff

1. Login as **Sam HR** (`learnfresh.hr01@example.test`)  
2. **HR → Onboarding Templates**  
3. On the **Staff** row, click **“1 Department”** so the list **expands on this same page** (it should not jump away)  
4. In the expanded list:
   - **Add Department** → attach another department if needed  
   - Click department name **General** → only then open that department’s editor  
5. **Add Task Group** → `Day 1` / `DAY1` → Add  
6. **+ Add Task** under Day 1 → `Submit ID copy` → fill required fields → save  
7. **Validate** → **Publish**

### 14.2 Start for Jamie

1. **HR → Employee Onboarding** → **Start Onboarding**  
2. Employee: **Jamie Employee**  
3. Pick the published **Staff** template  
4. Set start date → Start  

### 14.3 Complete a task

My Workspace shows the task as **PENDING** but has **no Complete button** yet (read-only summary). Calendar also does **not** show onboarding tasks.

Complete from HR instead:

1. Login as **Sam HR**  
2. **HR → Employee Onboarding** → click Jamie’s row  
3. Detail page should load (if you see “not found”, refresh — that was a bug loading by wrong id)  
4. On **Submit ID copy** → **Start** → **Complete**  

**PASS when:** Template published, Jamie onboarding started, at least one task completed.

---

## STEP 15 — Attendance (your branch)

There is **no separate “pick employees” screen**. Generation includes **all active employees on that branch** (Jamie, Alex, Sam if they are on Learn Fresh HQ 01).

### What Draft / Publish means

| Status | Meaning |
|--------|---------|
| **DRAFT** | Shell only, or entries not live yet — employees usually **cannot** check in against it |
| **PUBLISHED** | Live schedule HR published — used for attendance |
| **Create draft** | Empty roster box (0 entries) — **not enough by itself** |
| **Generate / Regenerate** | Fills employee × date **entries** into the draft |
| **Publish** | Orange button on the roster detail (when status is DRAFT) |

### 15.1 Confirm shift

**Administration → Shifts** → **Day Shift 01** exists.

### 15.2 Fill and publish roster

**Why entries stay 0:** Generate only creates rows when it can resolve a **shift**. New tenants often have no employee↔shift assignment UI, so generation used to **skip** everyone. The app now falls back to the company **default shift** (Day Shift 01).

1. Login as **Sam HR** → **HR → Work Schedule**  
2. Company **Learn Fresh Company 01**, branch **Learn Fresh HQ 01**  
3. Confirm **Day Shift 01** exists under Administration → Shifts (and is default if possible)  
4. Select your **DRAFT** roster → **Regenerate**  
5. **Dry run** → Planned entries / to create should be **> 0**  
6. **Commit generation** → **Roster entries** lists Jamie (and other branch employees)  
7. Orange **Publish** → status **PUBLISHED**  

If Dry run still shows 0, check warnings (timezone / no employees on branch).

### 15.3 Employee punch

1. Login as **Jamie** → **My Workspace** → **Check in** (then **Check out** if shown)

### 15.4 HR sees attendance

1. Login as **Sam** → **HR → Attendance** → Jamie’s punch for today  

**PASS when:** Attendance row appears for Jamie.

---

## You finished when

- [x] New org registered (PATH A) or new group created (PATH B)  
- [x] Your company + branch + dept + designation + shift  
- [x] 3 employees + 3 users linked  
- [x] Calendar published with a holiday  
- [x] Leave matrix + balance + Manager→HR approve  
- [x] Onboarding instance started  
- [x] Attendance check-in seen by HR  

**Fresh path complete (Learn Fresh Org 01).** You built the full ERP loop from register → org → people → calendar → leave → onboarding → attendance.

---

# PATH B — Super Admin (only if register fails)

Use this if STEP 1A OTP/register does not work.

## STEP 0B — Login Super Admin

1. http://localhost:3200/login  
2. Sign in with an authorized Super Administrator account from your approved
   secret store. Do not copy credentials into this guide, tickets, or source
   control.

**PASS when:** Dashboard + Administration visible.

## STEP 1B — Create NEW Company Group

1. **Administration → Company Groups** → Create  
2. Name: `Learn Fresh Org 01`  
3. Save — **do not pick existing Datascape/Atlas groups**

## STEP 2B — Create NEW Company

1. **Administration → Companies** → Create  
2. Group: **Learn Fresh Org 01**  
3. Name: `Learn Fresh Company 01`  

## STEP 3B–15B

Same as STEP 4A–15 above (branch, dept, designation, shift, employees, users, calendar, leave, onboarding, attendance) — **always Learn Fresh names only**.

Then continue reporting steps to me the same way.

---

## Error report template (copy to chat)

```text
STEP: (e.g. STEP 4A)
PATH: A or B
WHAT I DID:
EXPECTED:
ACTUAL ERROR: (exact message)
PAGE URL:
LOGIN USED:
MY COMPANY NAME: Learn Fresh Company 01
```

---

## Start now

1. Start backend + frontend  
2. Open http://localhost:3200/register  
3. Do **STEP 0A**  
4. Reply: `STEP 0A: PASS` or paste error using template above  

Do **not** open Kowdiar or old leave UAT accounts. Your learning path is **100% Learn Fresh** data only.
