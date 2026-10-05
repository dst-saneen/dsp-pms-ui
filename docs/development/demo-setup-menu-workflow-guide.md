# Demo Setup & Menu Workflow Guide

**Purpose:** Menu-wise list for demo prep and walkthroughs.  
**Audience:** Developers, QA, managers.  
**App URLs:** Frontend `http://localhost:3200` · Backend `http://localhost:4500`

---

## Before any demo (5-minute checklist)

| Step | What to do | Why |
|------|------------|-----|
| 1 | Log in with a user that has the right **role** (HR admin, manager, employee) | Menus hide/show by permissions |
| 2 | **Select a Company** in the org switcher (top bar) | Many modules fail with “Select a Company” without this |
| 3 | Optionally select a **Branch** if your demo is branch-specific | Leave, attendance, roster use branch context |
| 4 | Backend + frontend running (`pnpm run start:dev` / `pnpm run dev`) | — |
| 5 | Know which **feature flags** are on in `backend/.env` (see table below) | Off = menu may show but API returns “not enabled” |

### Feature flags (backend `.env`) — local demo

| Module | Env variable | Typical local demo |
|--------|--------------|-------------------|
| **Project Lite** | `PROJECTS_LITE_ENABLED=true` + HMAC keys | Required for Projects / timesheets |
| **Asset V2** | `ASSET_V2_ENABLED=true` + scope allowlist | Required for asset screens |
| **Payroll Lite** | `PAYROLL_LITE_ENABLED=true` | Shows Payroll menu + payslips |
| **Office Finance** | `OFFICE_FINANCE_LITE_ENABLED=true` | Shows Office Finance menu |
| **Onboarding V2** | `ONBOARDING_V2_ENABLED=true` | Optional onboarding enhancements |
| **Recruitment** | Usually on via app config | Recruitment submenu |

**Rule:** If a page says *“not enabled for this scope”* → check flag + company selection.

---

## Recommended demo story (full HRMS → Projects)

Show in this order so the story makes sense:

```
1. Setup org          → Administration (company, branch, dept)
2. Security           → Users, roles
3. Hire someone       → Recruitment flow
4. Onboard them       → Templates + employee onboarding
5. Day-to-day HR      → Leave, attendance, schedule
6. Assets             → Assign laptop etc.
7. Projects & time    → Project → tasks → timesheets → approve
8. Finance / Payroll  → (if flags enabled)
```

---

## 1. Dashboard

| Menu | Route | Who | What to show |
|------|-------|-----|--------------|
| **Dashboard** | `/dashboard` | Manager / HR | Summary widgets, team view |
| **My Workspace → Overview** | `/my-workspace` | Every employee | Personal hub: tasks, payslips card, quick links |
| **My Workspace → Onboarding** | `/my-workspace/onboarding` | New hire | Their onboarding checklist (employee view) |
| **My Workspace → Projects** | `/my-workspace/projects` | Employee on projects | **My assigned project tasks** (work as assignee) |
| **My Workspace → Timesheets** | `/my-workspace/timesheets` | Employee | **Log own hours** → submit week for approval |

**My Workspace vs HR menus:**  
My Workspace = **“what I do as me”**. HR menus = **“HR admin manages everyone”**.

---

## 2. Administration (foundation)

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Company Groups | `/administration/company-groups` | Platform admin | Top-level org groups |
| Companies | `/administration/companies` | Platform admin | Legal entities |
| Branches | `/administration/branches` | Org admin | Locations under a company |
| Departments | `/administration/departments` | Org admin | Org structure |
| Designations | `/administration/designations` | Org admin | Job titles |
| Shifts | `/administration/shifts` | Org admin | Shift definitions |
| Business Calendar | `/administration/business-calendar` | HR admin | Working days, holidays, versions, imports |

**Demo tip:** Create or pick **one company + one branch** first; use it for the rest of the demo.

---

## 3. Administration & Security

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Users | `/administration/users` | Security admin | Login accounts, invite users |
| Roles & Permissions | `/administration/security` | Security admin | Who can see which menus |
| Document Retention | `/settings/security/document-retention` | Security admin | File retention rules |
| Settings | `/settings` | — | Planned (not full demo yet) |

**Demo tip:** Use **two personas** if possible: HR admin + line manager + normal employee.

---

## 4. Human Resources — Employees & documents

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Employees | `/hr/employees` | HR | Employee directory |
| Employee (detail) | `/hr/employees/[id]` | HR | Profile, job info |
| Employee Documents → Categories | `/hr/employee-document-categories` | HR | Doc taxonomy |
| Employee Documents → Types | `/hr/employee-document-types` | HR | Doc types |
| Employee Documents → Documents | `/hr/employee-documents` | HR | Uploaded / linked employee docs |

**Flow:** Employee record is the **center** of HR — recruitment converts into this.

---

## 5. Human Resources — Recruitment (hire flow)

| Menu | Route | Who | Demo flow step |
|------|-------|-----|----------------|
| Dashboard | `/hr/recruitment` | Recruiter | Pipeline overview |
| Openings | `/hr/recruitment/openings` | Recruiter | Create job opening |
| Applications | `/hr/recruitment/applications` | Recruiter | Applications per opening |
| Candidates | `/hr/recruitment/candidates` | Recruiter | Candidate profiles |
| Interviews | `/hr/recruitment/interviews` | Recruiter / panel | Schedule & evaluate |
| Offers | `/hr/recruitment/offers` | Recruiter / HR | Send offer |
| Delivery | `/hr/recruitment/delivery` | Ops / HR | Email delivery queue for offers |

**Story to tell:**

```
Opening → Application → Candidate → Interview → Offer → (convert to Employee)
```

**Note:** Full production hire-to-employee still has hardening gaps; demo in **controlled/dev data**.

---

## 6. Human Resources — Onboarding

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Onboarding Templates | `/hr/onboarding-templates` | HR | Design checklist templates |
| Template designer | `/hr/onboarding-templates/[id]` | HR | Tasks, departments, dependencies |
| Employee Onboarding | `/hr/employee-onboarding` | HR | Start / track onboarding for hires |
| Employee onboarding detail | `/hr/employee-onboarding/[id]` | HR | Task progress per employee |

**Pair with:** My Workspace → Onboarding (employee completes their tasks).

**Story:**

```
HR publishes template → starts onboarding for new hire → employee completes tasks in My Workspace
```

---

## 7. Human Resources — Workforce (time & attendance)

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Work Schedule | `/hr/work-schedule` | HR / manager | Who works when |
| Attendance → Daily | `/hr/attendance` | HR | Daily attendance records |
| Attendance → Exceptions | `/hr/attendance/exceptions` | HR | Missing / wrong punches |
| Attendance → Period Closing | `/hr/attendance/periods` | HR | Close a payroll/attendance period |
| Overtime | `/hr/overtime` | Employee / manager | OT requests & approval |
| Leave → Requests | `/hr/leave` | Employee / manager | Apply & approve leave |
| Leave → Types | `/hr/leave/types` | HR | Annual, sick, etc. |
| Leave → Policies | `/hr/leave/policies` | HR | Rules per type |
| Leave → Employee Leave Balance | `/hr/leave/balances` | HR | Balances per employee |
| Leave → Calendar | `/hr/leave/calendar` | Manager | Team leave calendar |
| Leave → Holidays | `/hr/leave/holidays` | HR | Public / company holidays |
| Leave → Comp-off | `/hr/leave/comp-off` | HR | Comp-off credits |

**Story:**

```
Policy setup → employee requests leave → manager approves → balance updates
```

---

## 8. Human Resources — Payroll

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Payroll | `/hr/payroll` | HR / payroll admin | Salary components, runs, reports |

**Requires:** `PAYROLL_LITE_ENABLED=true` (and company scope).  
**Employee view:** My Workspace may show **payslips** when payroll is on.

**Status:** In codebase from master; enable flag for demo; production UAT separate.

---

## 9. Office Finance

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Dashboard | `/office-finance` | Finance user | Summary |
| Transactions | `/office-finance/transactions` | Finance user | Income / expense entries |
| Reports | `/office-finance/reports` | Finance user | Operational reports |
| Setup | `/office-finance/setup` | Finance admin | Categories, accounts, business parties |

**Requires:** `OFFICE_FINANCE_LITE_ENABLED=true`.  
**Links to Projects:** Client project finance summary waits on this module.

---

## 10. Assets & licences

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Categories | `/asset-management/asset-categories` | IT / HR | Asset grouping |
| Types | `/asset-management/asset-types` | IT / HR | Laptop, phone, etc. |
| Assets | `/asset-management/assets` | IT / HR | Asset register |
| Licences | `/asset-management/licenses` | IT | Software licences |
| Custodian Inbox | `/asset-management/inbox` | Custodian | Pending assignments |
| Assigned to employees | `/asset-management/employee-assets` | IT / HR | Who has what |
| Transfers | `/asset-management/transfers` | IT | Move asset between people/locations |
| Department grants | `/asset-management/department-grants` | IT admin | Dept-level access |
| Clearance waivers | `/asset-management/waivers` | HR | Exit clearance exceptions |

**Requires:** `ASSET_V2_ENABLED=true` + company in allowlist.  
**Story:** Onboarding can include “assign laptop” task → show asset assignment.

---

## 11. Project Management (Project Lite)

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| **Projects** | `/projects/projects` | PM / HR admin | Create & manage projects |
| Project detail | `/projects/projects/[id]` | PM | Stages, team, tasks, docs, activate |
| **Team timesheets** | `/team/timesheets` | **Manager / approver** | Approve or return **team** timesheets |

**Requires:** `PROJECTS_LITE_ENABLED=true` + HMAC keys + **company selected**.

### Why two timesheet menus? (important for demo)

| Location | Route | Role | Action |
|----------|-------|------|--------|
| **My Workspace → Timesheets** | `/my-workspace/timesheets` | **Employee** | Create week, add lines (task or category), **submit** |
| **Project Management → Team timesheets** | `/team/timesheets` | **Manager** | Review **submitted** sheets, **approve** or **return** |

Same product, **two sides of one workflow** — not duplicate pages.

### Project Lite demo script (10 minutes)

```
1. Projects → New project (INTERNAL) → set PM, dates
2. Open project → add Stage → add Team member → add Task
3. Activate project (preflight must pass: PM, start date, ≥1 stage)
4. As PM: assign task to team member
5. As employee: My Workspace → Projects → start / submit task
6. As employee: My Workspace → Timesheets → add hours → submit
7. As manager: Project Management → Team timesheets → approve
```

**Permissions (short):**

| Permission | Allows |
|------------|--------|
| `projects.projects.read` | See projects list |
| `projects.projects.manage` | Create / edit / lifecycle |
| `projects.tasks.work` | My Workspace projects & tasks |
| `projects.timesheets.submit` | My Workspace timesheets |
| `projects.timesheets.approve` | Team timesheets |

---

## 12. Operations (platform admin)

| Menu | Route | Who | What it is |
|------|-------|-----|------------|
| Delivery Queue | `/admin/operations/delivery` | Platform admin | Outbound email queue |
| Dead Letters | `/admin/operations/delivery/dead-letters` | Platform admin | Failed deliveries |
| File Operations | `/administration/operations/files` | Platform admin | File storage ops |
| Suppressions | `/admin/operations/delivery/suppressions` | Platform admin | Blocked emails |
| Recipient Exceptions | `/admin/operations/delivery/recipient-exceptions` | Platform admin | Delivery overrides |

**When to show:** Recruitment offer email troubleshooting, not main HR demo.

---

## Quick reference — who sees what

| Persona | Main menus |
|---------|------------|
| **Platform / org admin** | Administration, Security, Business Calendar |
| **HR admin** | Employees, Recruitment, Onboarding, Leave policies, Documents |
| **Recruiter** | Recruitment subtree |
| **Line manager** | Dashboard, Leave approvals, Team timesheets, Attendance views |
| **Employee** | My Workspace (onboarding, my tasks, my timesheets) |
| **Project manager** | Projects + team/task management on project detail |
| **Finance** | Office Finance (if enabled) |
| **IT / assets** | Assets & licences |

---

## What is built vs what to say carefully

| Area | Demo as | Caveat |
|------|---------|--------|
| Org, employees, leave, attendance | **Working HRMS** | Needs company selected |
| Recruitment UI | **Working demo** | Not production-certified end-to-end |
| Onboarding | **Working demo** | Pair HR + employee workspace |
| Assets | **Working** if V2 flag on | Company must be in allowlist |
| **Project Lite** | **Working** if flag on | Local enable OK; shared DB migrations need care |
| Payroll / Office Finance | **Working** if flags on | New from master; pilot enablement |
| CRM, procurement, BIM, training | **Not in app** | Roadmap only |

**One-line for management:**

> “We demo a full HRMS core plus Project Lite, Assets, and optional Finance/Payroll modules — each gated by env flags and company scope; not yet production sign-off for the whole suite.”

---

## Suggested demo personas (create or reuse)

| Login role | Use for showing |
|------------|-----------------|
| HR Admin | Setup, recruitment, onboarding templates, employees |
| Manager | Leave approval, team timesheets, dashboard |
| Employee | My Workspace, leave request, my timesheets, my project tasks |
| PM (employee + manage permission) | Full project create → activate → assign flow |

---

## Related docs

- Project Lite remediation: `docs/development/project-lite-remediation-phases.md`
- Project Lite phases 3–8 record: `docs/development/project-lite-phases-3-8-completion-record.md`
- Overall product status: `docs/development/overall-product-development-status.md`
- ERP production UAT: `docs/testing/erp-production-workflow-manual-uat-guide.md`

---

*Last updated: 2026-08-31 — align feature flags with your local `backend/.env` before each demo.*
