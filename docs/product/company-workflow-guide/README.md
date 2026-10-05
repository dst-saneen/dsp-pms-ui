# Company workflow guide

Beginner playbook for standing up **your own company** in this ERP and then using every live module, in the order the product actually needs.

Fictional practice company used in screenshots and examples: **Northstar Labs**. Swap the names for yours. The clicks stay the same.

This Markdown directory is the source of truth. Compressed snapshots are generated artifacts and are not retained in Git.

**Local app**

| App | URL |
|-----|-----|
| Website | http://localhost:3200 |
| API | http://localhost:4500 |

---

## How to read this

1. Start at [00 — How to use this guide](./00-how-to-use-this-guide.md).
2. Copy names from [Sample company](./sample-company.md) into a notepad (not into git).
3. Follow **Track 1** until people can log in. Then pick extra modules from Track 2.

If a later page is empty, go **back** one chapter. Almost every empty screen means a missing company, branch, person, or unpublished calendar.

---

## Track 1 — Own company (start here)

Use this to run the app as a real small company.

| Step | Chapter | You will |
|------|---------|----------|
| 1 | [Register and first setup](./01-register-and-first-setup.md) | Create the organization, verify email, finish the setup hub |
| 2 | [Company structure](./02-company-structure.md) | Companies, branches, departments, designations, shifts |
| 3 | [Employees](./04-employees.md) | Create people in HR (Meera, Arun, Rohan) |
| 4 | [Users, roles, security](./03-users-roles-security.md) | Invite logins and link each login to an employee |
| 5 | [Calendar and work schedule](./05-calendar-and-work-schedule.md) | Office working days, then who works when |
| 6 | [Attendance](./09-attendance.md) | Check in / check out |
| 7 | [Leave and overtime](./10-leave-overtime.md) | Leave types, balances, apply, approve |
| 8 | [My Workspace](./17-my-workspace-daily-work.md) | Daily employee home |

---

## Track 2 — Full product test

Do Track 1 first. Then add these when you want to test hiring, kit, projects, and money.

| Chapter | Module |
|---------|--------|
| [06 Recruitment](./06-recruitment.md) | Vacancy → offer → convert to employee |
| [07 Onboarding](./07-onboarding.md) | Joining checklist for a new hire |
| [08 Employee documents](./08-employee-documents.md) | Categories, types, files |
| [11 Assets and licences](./11-assets-and-licences.md) | Laptops, phones, software licences |
| [12 HR requests and separations](./12-hr-requests-and-separations.md) | Letters while employed; leaving the company |
| [13 Projects and timesheets](./13-projects-and-timesheets.md) | Projects, tasks, time |
| [14 Office Finance](./14-office-finance.md) | Income / expense / transfer |
| [15 Payroll](./15-payroll.md) | Salary components and runs |
| [16 Operations](./16-operations.md) | Email delivery queue and file ops (admin) |

---

## One picture of the whole product

```text
Register + setup hub
        ↓
Company Group → Company → Branch → Department → Designation → Shift
        ↓
Employees → Users (logins) → Roles
        ↓
Business Calendar (publish) → Work Schedule (publish)
        ↓
           ┌── Direct: create Employee (Track 1, faster)
Hire ──────┤
           └── Full: Recruitment → Offer → Convert (Track 2)
        ↓
Onboarding checklist → Documents → Assets
        ↓
Attendance → Leave / Overtime → HR requests
        ↓
Projects → Timesheets
        ↓
Office Finance → Payroll
        ↓
My Workspace (daily)   Operations (admin, optional)
```

---

## Field glossary

Plain-English meaning of important options: [99 — Field glossary](./99-field-glossary.md).

Chapters 01–17 have live screenshots of the main list pages, My Workspace, onboarding, finance setup, and the shift / apply-leave side panels. Some nested URLs 404 if pasted in local Turbopack — use the sidebar or the orange Add/New button.

---

## What this is not

- Not the production-fix UAT scoreboard (`production-fix-wave-tracker.md`).
- Not a place to store passwords, OTP codes, or real personal data.
- Settings (`/settings`) is still planned. Ignore it for company setup.
