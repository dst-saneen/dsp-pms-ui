# Phase 1 — Collaborative Manual Test Sheet

**Execution ID:** `UAT-E2E-20260903-01`  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Date:** 3 September 2026  
**Completed:** 3 September 2026  
**Phase 1 overall:** **Pass**  
**How we work:** Agent does technical checks → You do browser clicks → Agent records bugs/fixes

**Website:** http://localhost:3200  
**Backend:** http://localhost:4500

---

## Phase 1 result (final)

| Task | What | Result |
|------|------|--------|
| 1 | Login / logout | **Pass** |
| 2 | Register org + OTP | **Pass** |
| 3 | Onboarding wizard | **Pass** |
| 4a | Branch timezone edit | **Pass** (after trigger fix) |
| 4b | Password ≠ email | **Pass** (after policy fix) |
| 4c | Companies, branches, departments, designations, shifts | **Pass** |
| 5 | Forgot / change password | **Pass** |

**Bugs found and fixed in Phase 1:**

1. Password could equal email — **fixed** (backend + register UI)  
2. Branch timezone update crashed (`NEW.branchId` trigger) — **fixed** (migration applied)

**Next:** [Phase 2 — People, Users, Roles](./phase-2-collaborative-test-sheet.md) · [Summary through Phase 3](./collaborative-uat-summary-through-phase-3.md)

---

## Part A — Agent technical checks (done for you)

| Check | Result | Notes |
|-------|--------|-------|
| Git commit recorded | **Pass** | `5916d458…` |
| Backend `/health/live` | **Pass** | `status: ok` |
| Backend `/health/ready` | **Partial** | Database **up**; Redis skipped; **objectStorage down**; ClamAV skipped |
| Prisma migrate status | **Pass** | DB `dsp_erp_dev` / schema `dsp_pms` — **145 migrations, up to date** |
| Website opens | **Pass** | Frontend responds |
| `/login` opens | **Pass** | HTTP 200 |
| `/register` opens | **Pass** | HTTP 200 |
| Mock recruitment off | **Pass** | `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false` |
| Mock login / auth bypass | **Pass** | No mock-auth / login-bypass flags found |
| Email enabled | **Pass** | `EMAIL_ENABLED=true` |
| Email dev bypass | **Pass** | `EMAIL_DEV_BYPASS=false` (real email path) |
| Password ≠ email rule | **Fail (bug confirmed)** | API accepted register when password = email (`201`) |

### What this means for you

- You **can** start login / register / onboarding browser tests now.
- File upload / payslip / malware scan stay **Blocked** until storage + ClamAV are healthy (later phases).
- OTP emails should be **real** (bypass is off). Use an inbox you can open.

---

## Part B — Your data for this run (type exactly)

Replace nothing except the password (keep password **outside** this file if you prefer).

| Field | Exact value to type |
|-------|---------------------|
| Execution ID | `UAT-E2E-20260903-01` |
| Organization name | `E2E Atlas Group UAT-E2E-20260903-01` |
| Owner display name | `Owner Atlas UAT-E2E-20260903-01` |
| Owner email | **YOU FILL** — a real inbox you can open (needed for OTP) |
| Password | Strong password, **12+ characters**, **MUST NOT equal the email** |
| First company | `E2E Atlas Services UAT-E2E-20260903-01` |
| First branch | `E2E Kochi HQ UAT-E2E-20260903-01` |
| First department | `Human Resources` |
| Timezone | `Asia/Kolkata` |
| Currency | `INR` |

### Optional existing login (for AUTH-001 only, if you already have access)

Use only if you already know these work in this DB. Do **not** invent passwords.

| Purpose | Email hint |
|---------|------------|
| Existing Learn Fresh HR | `learnfresh.hr01@example.test` |
| Existing org owner | `msaneen.dev@gmail.com` |

If those fail, skip to **Register** (Task 2) — that is the main Phase 1 happy path.

---

## Part C — Your browser tasks (tick as you go)

### Task 1 — Login & logout (AUTH-001)

1. Open http://localhost:3200/login  
2. Sign in with a known working user  
3. Confirm home/dashboard opens  
4. Look at top bar — note which Company is selected  
5. Open user menu → Sign out  
6. Press browser **Back**  

| Expected | Your result (Pass / Fail / Blocked) |
|----------|-------------------------------------|
| Login works with correct password | |
| Logout clears session | |
| Back does not show private pages | |
| Wrong password rejected | |

**Tell me:** Pass/Fail + screenshot note if Fail.

---

### Task 2 — Register new organization (REG-001) ★ main task today

1. Open http://localhost:3200/register  
2. Organization name: `E2E Atlas Group UAT-E2E-20260903-01`  
3. Owner name: `Owner Atlas UAT-E2E-20260903-01`  
4. Email: your real controlled inbox  
5. Password: strong, **different from email**, 12+ chars  
6. Confirm password matches  
7. Submit  
8. Open email → copy OTP  
9. Enter OTP on verify screen  

| Expected | Your result |
|----------|-------------|
| Registration accepted | |
| OTP email arrives | |
| Correct OTP opens `/onboarding` | |
| Wrong OTP rejected | |

**Negative checks (important):**

| Try this | Expected | Your result |
|----------|----------|-------------|
| Password **same as email** | Must be **rejected** | (Agent already saw API accept it = bug) |
| Password shorter than 12 | Rejected | |
| Wrong OTP | Rejected | |

**Tell me:** Did OTP arrive? Did onboarding open? Did same-as-email get rejected in UI?

---

### Task 3 — Finish first-time setup (ORG-001)

On `/onboarding` wizard, complete in order:

1. Company Group stays / matches: `E2E Atlas Group UAT-E2E-20260903-01`  
2. Company: `E2E Atlas Services UAT-E2E-20260903-01`  
3. Branch: `E2E Kochi HQ UAT-E2E-20260903-01`  
4. Department: `Human Resources`  
5. Add a designation if asked (example: `HR Manager`)  
6. Add a shift if asked (example: `09:00–18:00`, break 60 min)  
7. Finish setup  

| Expected | Your result |
|----------|-------------|
| Dashboard opens | |
| New company is active | |
| You can see Administration menus | |

**Write down and send me:** any codes/IDs shown for Group / Company / Branch.

---

### Task 4 — Master data (ORG-002) — after Task 3 Pass

Create under Administration (left sidebar):

| Menu | Create |
|------|--------|
| Companies | `E2E Atlas Labs UAT-E2E-20260903-01` |
| Branches | Edit Kochi HQ timezone `Asia/Kolkata`; create `E2E Bengaluru Delivery UAT-E2E-20260903-01` |
| Departments | Human Resources, Information Technology, Finance, Projects, Engineering, Administration |
| Designations | HR Manager, Recruiter, Hiring Manager, Project Manager, Software Engineer, Finance Officer, General Employee |
| Shifts | Day `09:00–18:00` (60m break); Night `21:00–06:00` (60m break) |

| Expected | Your result |
|----------|-------------|
| Records save under correct company | |
| Switching company does not mix children wrongly | |

---

### Task 5 — Password change / forgot password (AUTH-002 / AUTH-003)

Do **after** Tasks 2–3 work (so you have a real new user).

1. Forgot password → use your owner email → reset via email link  
2. New password must **not** equal email  
3. Old password must fail  
4. Optional: change password from account page; check sessions  

---

## Part D — How to report back to me

After each task, reply with this short format:

```text
Task: 2
Result: Pass / Fail / Blocked
What I saw: (1–2 sentences)
Email used: (masked ok, e.g. a***@gmail.com)
Bug?: Yes/No
```

If Fail, also send:

- Steps you clicked  
- Expected vs actual  
- Screenshot if possible (no passwords/OTP)

---

## Known bug — FIXED (retest with you)

| Field | Value |
|-------|-------|
| Phase | 1 — Auth / Registration |
| Feature | Password policy |
| Steps | Register with password identical to email |
| Expected | Reject with password-policy error |
| Actual (before) | `201` success |
| Severity | **P1** |
| Root cause | `PasswordService.validatePassword` only checked length |
| Fix applied | Backend rejects password equal to email/username on register, invite accept, reset, and change password; FE register + change-password also block |
| Agent retest | email=password → **400**; distinct password still accepted; unit tests **4/4 Pass** |

---

## Bug — Branch timezone update — FIXED

| Field | Value |
|-------|-------|
| Phase | 1 — ORG-002 / Branches |
| Feature | Edit Branch timezone |
| Steps | Edit Kochi HQ → set Timezone `Asia/Kolkata` → Update |
| Expected | Branch saves with timezone Asia/Kolkata |
| Actual (before) | `500` “The database operation could not be completed.” (request `6e5cbbf2…`) |
| Severity | **P1** |
| Root cause | Shared DB trigger `organization_reparent_guard` on `branches` referenced `NEW.branchId`, but branches have no `branchId` column |
| Fix applied | Migration `20260903110000_fix_branch_reparent_trigger` — table-specific trigger functions |
| Agent retest | Branch `a50fbdfd-…` update timezone → **Pass** (`Asia/Kolkata` saved) |

**Note:** Kochi HQ timezone is already set to `Asia/Kolkata` from agent retest. Please confirm in the UI, then finish the rest of Task 4.

---

## Your remaining Task 4 checklist (retest + finish)

### 4a — Retest branch edit (quick)

1. Open **Administration → Branches**
2. Open **E2E Kochi HQ UAT-E2E-20260903-01**
3. Confirm Timezone shows `Asia/Kolkata` (or set it again and click Update)
4. Expected: saves successfully, no red error

### 4b — Password ≠ email (you already Pass)

Already confirmed by you.

### 4c — Finish master data (still to do)

| Menu | Create / check |
|------|----------------|
| Companies | `E2E Atlas Labs UAT-E2E-20260903-01` (you said you created a company — confirm name) |
| Branches | Create `E2E Bengaluru Delivery UAT-E2E-20260903-01` (timezone `Asia/Kolkata`) |
| Departments | Human Resources, Information Technology, Finance, Projects, Engineering, Administration |
| Designations | HR Manager, Recruiter, Hiring Manager, Project Manager, Software Engineer, Finance Officer, General Employee |
| Shifts | Day `09:00–18:00` (60m break); Night `21:00–06:00` (60m break) |

Reply:

```text
Task: 4a branch edit retest
Result: Pass / Fail
What I saw: ...

Task: 4c master data
Result: Pass / Fail / Partial
What I created: ...
Bug?: Yes/No
```

After **4a + 4c Pass**, we start **Task 5** (forgot / change password).
