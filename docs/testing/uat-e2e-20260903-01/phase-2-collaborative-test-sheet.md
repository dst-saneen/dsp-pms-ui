# Phase 2 — People (rewritten for how the website actually works)

**Execution ID:** `UAT-E2E-20260903-01`  
**Company:** `E2E Atlas Services UAT-E2E-20260903-01`  
**Branch:** `E2E Kochi HQ UAT-E2E-20260903-01`

---

## Important (why you only saw Recruitment)

This ERP does **not** let you type Arun into Employees and click Save.

**Employees page = list of people already hired.**  
**New people enter through Recruitment.**

That is why the only big button is **Recruit Candidate**. That is not a bug.

There is a **Add Employee / New** form, but it is locked on purpose (legacy import only). Do **not** turn on any bypass flag.

---

## Two kinds of “person” (do not mix them)

| Word | Meaning | Where |
|------|---------|--------|
| **User** | Login account (email + password) | Administration → Users |
| **Employee** | HR job record (department, designation, manager) | Human Resources → Employees |
| **Candidate** | Person being hired | Human Resources → Recruitment |

You already have a **User** (you, the Owner).  
After you sign in, the Owner is also created as the **first Employee** (setup, not a hiring bypass). That person is the Hiring manager for the first job. Arun still comes in through Recruitment.

---

## Task 6A — Look at Employees (2 minutes, no create)

Do this first so you see the real screen.

1. Sign in as Owner. If you were already signed in, **refresh the page once** (this creates the Owner employee).  
2. At the **top bar**, select Company:  
   `E2E Atlas Services UAT-E2E-20260903-01`  
3. Left menu: **Human Resources** → **Employees**  
4. You should see:
   - search box  
   - **Refresh**  
   - orange/red button **Recruit Candidate**  
   - **one row**: Owner Atlas (employee code like `EMP-00000x`)  
5. There is **no** “Create Employee” / “Add Manager” button. That is expected.

**Pass:** Recruit Candidate is there, and the Owner is on the list.

---

## Task 6B — Try Recruitment (this is the real “add Arun” door)

### Click path (follow in order)

1. On Employees, click **Recruit Candidate**.  
2. A small window opens: **Recruit candidate**.  
3. Click **Browse job openings**.  
   (You can also go: left menu **Human Resources** → **Recruitment** → **Openings**.)  
4. URL should be: http://localhost:3200/hr/recruitment/openings  
5. Look for **New Opening** / **Create**.

### What you will type for the first job

| Field | Value |
|-------|--------|
| Title | `Software Engineer UAT-E2E-20260903-01` |
| Company | `E2E Atlas Services UAT-E2E-20260903-01` |
| Branch | `E2E Kochi HQ UAT-E2E-20260903-01` |
| Department | `Engineering` |
| Designation | `Software Engineer` |
| Hiring manager | **Owner Atlas** (the founding employee from 6A) |

**Pass:** Hiring manager is **not** empty. Pick the Owner, then you can save a Draft opening.

If the Hiring manager list is still empty after a refresh, tell me:

```text
Task: 6B
Result: Blocked
What I saw: Job opening needs hiring manager, list is empty
```

---

## Do NOT do these

- Do not look for “Add Arun” on Employees.  
- Do not enable `ALLOW_LEGACY_EMPLOYEE_CREATE` / mock flags.  
- Do not create people under Atlas Labs for this task.  
- Do not use Learn Fresh employees.

---

## After a Job Opening exists

The full hire path is:

```text
Create Opening (Draft)
  → Publish Opening
  → Candidate applies (or Internal application)
  → Interview
  → Offer
  → Candidate accepts
  → HR Convert to Employee
  → Person appears on Employees list
  → Invite User login
```

We will do that **slowly, one screen at a time**, with screenshots of each button.

---

## Start now (only this)

1. Refresh once while signed in as Owner  
2. Employees page → confirm Owner is listed + **Recruit Candidate**  
3. Click it → **Browse job openings**  
4. **New Opening** → Hiring manager should list the Owner  

Reply with **exactly** this:

```text
Task: 6A Employees page
Result: Pass / Fail
Owner on list: yes / no
What I saw: (Recruit Candidate yes/no)

Task: 6B Job opening
Result: Pass / Fail / Blocked
Hiring manager list: empty / has Owner
What I saw: ...
```

---

**Phase 2 overall:** **Pass** (recruitment → Arun employee)  
**Next:** [Phase 3 — Onboarding](./phase-3-collaborative-test-sheet.md) · [Summary through Phase 3](./collaborative-uat-summary-through-phase-3.md)
