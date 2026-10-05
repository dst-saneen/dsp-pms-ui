# DSP ERP Current → New Comparison

Generated: 2026-09-22 (Asia/Kolkata)

## Compared baselines

| Side | Code | Database | Meaning |
|---|---|---|---|
| Current | `origin/master` at `e2716c8bffafd038ae3c1bc28bdfc99850754a0e` | `dsp_erp_dev`, schema `dsp_pms` | Current/master application baseline requested for comparison. This is a development database schema, not independently verified production RDS. |
| New | `PMS-170926` working tree based on `b4acc41` | `dsp_erp_dev`, schema `dsp_pms_stg` | Workflow-hardening and new development/test baseline, including the resolved Settings placeholder and Company Modules & Features workflow. |

Evidence used:

- Graphify 0.9.65 incremental graph refreshed at 2026-09-22 13:52 IST was used to scope the original comparison. The current launcher refresh fails because its executable still embeds a removed Python 3.12 path, so this incremental update used the narrowed source files, tests and Git diff and records the graph refresh as pending.
- Git trees and diffs for the two exact refs above. No branch checkout was performed.
- Read-only PostgreSQL catalog, migration-ledger, role and permission queries. Connections enforced `default_transaction_read_only=on`.
- Primary sources: `frontend/config/navigation.ts`, frontend `app/**/page.tsx`, `backend/prisma/schema.prisma`, migration SQL, module-capability services and the relevant module services/tests.

## Executive result

| Measure | Current | New | Delta |
|---|---:|---:|---|
| Navigation sections | 8 | 12 | Task-first regrouping into Dashboard, My Work, People, Recruitment, Workforce, Payroll, Projects, Finance, Assets & Licences, Setup, Operations and Security. |
| Navigation entries | 69 | 69 | Approval workflows was added; the hidden, unimplemented `/settings` placeholder was removed. |
| Frontend page files | 128 | 130 | Added Approval workflows and Company Modules & Features pages. |
| Unique frontend URLs | 127 | 129 | Added `/administration/approval-workflows` and `/administration/companies/[id]/modules`. No implemented URL was removed. |
| Route URL changes | — | — | Zero existing implemented URLs changed. Existing bookmarks and links remain valid. |
| Database tables | 183 | 185 | `company_module_entitlements` plus staging-only `qa_environment_sentinel`. |
| Database columns | 2,880 | 2,895 | 15 added: two legal-country columns, six entitlement columns and seven staging-sentinel columns. |
| Database indexes | 1,046 | 1,051 | Four entitlement indexes plus the staging-sentinel primary key. |
| Repository migrations (`PMS-170926`) | 161 | 161 | Both comparisons use the new repository migration list for lineage analysis. |
| Applied unique migrations | 156 | 161 | Current is missing five New-only migrations; the new development/test schema is complete. |
| System roles | 9 | 9 | Same role catalog. |
| System-role permission links | 331 | 331 | The Project Manager clearance migration is applied in the new development/test schema. |

The navigation change is predominantly an information-architecture change, not a route rewrite. Pages are moved under clearer task-first sections, configuration pages are collected under Setup, recovery functions are collected under Operations, and security administration is separated.

## Complete menu structure

### Current: `origin/master` + `dsp_pms`

1. **Dashboard** (9)
   - Dashboard
   - My Workspace → Overview, My calendar, My leave, Onboarding, HR requests, Approvals & clearance, Projects, Timesheets
2. **Administration** (7)
   - Company Groups, Companies, Branches, Departments, Designations, Shifts, Business Calendar
3. **Human Resources** (29)
   - Employees
   - Recruitment → Dashboard, Openings, Applications, Candidates, Interviews, Hiring decisions, Offers, Delivery
   - Employee Onboarding, HR Requests, Employee Separations
   - Employee Documents → Documents, Document Types, Categories
   - Work Schedule
   - Attendance → Daily, Exceptions, Period Closing
   - Overtime
   - Leave → Requests, Employee Leave Balance, Calendar, Comp-off, Types, Policies, Holidays
   - Payroll, Onboarding Templates
4. **Office Finance** (4)
   - Office Finance → Dashboard, Transactions, Reports, Setup
5. **Assets & licences** (9)
   - Custodian Inbox, Assigned to employees, Assets, Licences, Transfers, Clearance waivers, Categories, Types, Department grants
6. **Project Management** (2)
   - Projects, Team timesheets
7. **Operations** (5)
   - Delivery Queue, Dead Letters, File Operations, Suppressions, Recipient Exceptions
8. **Administration & Security** (4)
   - Users, Settings (planned/hidden), Roles & Permissions, Document Retention

### New: `PMS-170926` + `dsp_pms_stg`

1. **Dashboard** (1)
   - Dashboard
2. **My Work** (8)
   - Overview, My calendar, My leave, Onboarding, HR requests, Approvals & clearance, My projects, My timesheets
3. **People** (5)
   - Employees, Employee onboarding, HR requests, Employee separations, Employee documents
4. **Recruitment** (7)
   - Dashboard, Openings, Applications, Candidates, Interviews, Hiring decisions, Offers
5. **Workforce** (8)
   - Work schedule
   - Attendance → Daily attendance, Exceptions
   - Overtime
   - Leave → Requests, Employee leave balance, Calendar, Comp-off
6. **Payroll** (1)
   - Payroll
7. **Projects** (2)
   - Projects, Team timesheets
8. **Finance** (3)
   - Dashboard, Transactions, Reports
9. **Assets & Licences** (6)
   - Custodian inbox, Assigned to employees, Assets, Licences, Transfers, Clearance waivers
10. **Setup** (18)
    - Organization → Company groups, Companies, Branches, Departments, Designations
    - HR → Document types, Document categories, Onboarding templates, Approval workflows
    - Workforce → Shifts, Business calendar, Leave types, Leave policies, Holidays
    - Finance
    - Assets & licences → Asset categories, Asset types, Department grants
11. **Operations** (7)
    - Attendance period closing, Recruitment delivery, Delivery queue, Dead letters, Suppressions, Recipient exceptions, File operations
12. **Security** (3)
    - Users, Roles & permissions, Document retention

## Complete Current → New menu/route mapping

Access notation: `ALL` means every listed permission is required; `ANY` means one listed permission is sufficient; `CAP` is the Company/module capability that must also be enabled. Unless a delta is stated, the permission codes themselves are unchanged.

| Current location | New location | Route | New access gate | Brief page workflow / relevant data |
|---|---|---|---|---|
| Dashboard → Dashboard | Dashboard → Dashboard | `/dashboard` | `dashboard.read` | Open role-aware summary and navigate to permitted work; aggregates scoped people/workforce/project/finance status. |
| Dashboard → My Workspace → Overview | My Work → Overview | `/my-workspace` | `hr.self.read` | Employee self-service summary; links to calendar, requests, onboarding, projects and assets. |
| Dashboard → My Workspace → My calendar | My Work → My calendar | `/my-workspace/calendar` | `hr.self.read` | View personal working days, holidays, shifts and approved/pending leave. |
| Dashboard → My Workspace → Apply leave | My Work → My leave | `/my-workspace/leave` | `hr.self.read`; application actions require `hr.self.manage` | Review KPIs, balances, and history; select leave dates, validate calendar and balance, and submit through configured approval routing. |
| Dashboard → My Workspace → Onboarding | My Work → Onboarding | `/my-workspace/onboarding` | `hr.self.read` + `CAP onboardingNav` | View and complete assigned onboarding tasks, documents, acknowledgements and hand-offs. |
| Dashboard → My Workspace → HR requests | My Work → HR requests | `/my-workspace/hr-requests` | `hr.self.read` | Create and track personal HR requests with attachments and approval status. |
| Dashboard → My Workspace → Approvals & clearance | My Work → Approvals & clearance | `/my-workspace/approvals` | `ANY hr.self.read / hr.clearance.department.read / hr.clearance.department.manage` | Process assigned approvals and department-scoped separation/asset clearance items. |
| Dashboard → My Workspace → Projects | My Work → My projects | `/my-workspace/projects` | `projects.tasks.work` + `CAP projectsNav` | Open assigned projects/tasks, submit task work and evidence. |
| Dashboard → My Workspace → Timesheets | My Work → My timesheets | `/my-workspace/timesheets` | `projects.timesheets.submit` + `CAP projectsNav` | Record worklogs, build weekly timesheets and submit for manager approval. |
| Human Resources → Employees | People → Employees | `/hr/employees` | `hr.employees.read` | List/create/view/edit Employees; new flow can invite/link a User from the authoritative Employee record. |
| Human Resources → Employee Onboarding | People → Employee onboarding | `/hr/employee-onboarding` | `hr.onboarding.read` + `CAP onboardingNav` | Start a published template, assign owners, complete/skip/reopen tasks and finish onboarding. |
| Human Resources → HR Requests | People → HR requests | `/hr/hr-requests` | `hr.requests.read` | Review request queue, attachment grants, current approver and configured approval workflow. |
| Human Resources → Employee Separations | People → Employee separations | `/hr/employee-separations` | `ANY hr.employees.read / hr.employees.manage` | Start/process/cancel separation and drive employee/asset clearance without auto-creating workflows. |
| Human Resources → Employee Documents → Documents | People → Employee documents | `/hr/employee-documents` | `hr.documents.read` | Upload/list/view/edit Employee documents using secure file-storage grants. |
| Human Resources → Recruitment → Dashboard | Recruitment → Dashboard | `/hr/recruitment` | `hr.recruitment.read` + **new** `CAP recruitmentNav` | View recruitment funnel and move to openings/applications/interviews/offers. |
| Human Resources → Recruitment → Openings | Recruitment → Openings | `/hr/recruitment/openings` | `hr.recruitment.read` + `CAP recruitmentNav` | Create, publish and manage openings and criteria. |
| Human Resources → Recruitment → Applications | Recruitment → Applications | `/hr/recruitment/applications` | `hr.recruitment.read` + `CAP recruitmentNav` | Screen and progress applications, schedule interviews and prepare decisions. |
| Human Resources → Recruitment → Candidates | Recruitment → Candidates | `/hr/recruitment/candidates` | `hr.recruitment.read` + `CAP recruitmentNav` | Manage candidate profiles, documents and application history. |
| Human Resources → Recruitment → Interviews | Recruitment → Interviews | `/hr/recruitment/interviews` | `hr.recruitment.read` + `CAP recruitmentNav` | Schedule panel interviews, capture evaluation scores and complete decisions. |
| Human Resources → Recruitment → Hiring decisions | Recruitment → Hiring decisions | `/hr/recruitment/hiring-decisions` | `hr.recruitment.read` + `CAP recruitmentNav` | Review ready-to-hire candidates and perform controlled Candidate → Employee conversion. |
| Human Resources → Recruitment → Offers | Recruitment → Offers | `/hr/recruitment/offers` | `hr.recruitment.read` + `CAP recruitmentNav` | Draft/send/accept/decline offers; compensation currency now comes from Company Financial Profile. |
| Human Resources → Work Schedule | Workforce → Work schedule | `/hr/work-schedule` | `hr.schedule.read` | Plan work, shifts and assignments; open related project/task items. |
| Human Resources → Attendance → Daily | Workforce → Attendance → Daily attendance | `/hr/attendance` | `hr.attendance.read` | Filter daily attendance, inspect punches and submit corrections/regularizations. |
| Human Resources → Attendance → Exceptions | Workforce → Attendance → Exceptions | `/hr/attendance/exceptions` | `hr.attendance.read` | Review exceptions; a correction now cancels superseded submitted regularizations. |
| Human Resources → Overtime | Workforce → Overtime | `/hr/overtime` | `hr.overtime.read` | Calculate, submit, process and approve overtime using configured routing. |
| Human Resources → Leave → Requests | Workforce → Leave → Requests | `/hr/leave` | `ANY hr.leave.read / hr.team.approve` | Submit/review/approve/reject leave and update balances/calendar days. |
| Human Resources → Leave → Employee Leave Balance | Workforce → Leave → Employee leave balance | `/hr/leave/balances` | `hr.leave.read` | Generate/view balances and audit balance transactions. |
| Human Resources → Leave → Calendar | Workforce → Leave → Calendar | `/hr/leave/calendar` | `ANY hr.calendar.read / hr.team.read` | View scoped team leave against published business calendars. |
| Human Resources → Leave → Comp-off | Workforce → Leave → Comp-off | `/hr/leave/comp-off` | `hr.comp-off.read` | Review earned credits, allocations, expiry and leave consumption. |
| Human Resources → Payroll | Payroll → Payroll | `/hr/payroll` | `payroll.payroll.read` + `CAP payrollNav` | Configure inputs, calculate run, approve/pay, create finance expense and publish payslips. |
| Project Management → Projects | Projects → Projects | `/projects/projects` | `projects.projects.read` + `CAP projectsNav` | Create internal/client projects, stages/tasks/team, submissions and project documents. |
| Project Management → Team timesheets | Projects → Team timesheets | `/team/timesheets` | `projects.timesheets.approve` + `CAP projectsNav` | Review Employee-coded weekly timesheets and approve/return them. |
| Office Finance → Office Finance → Dashboard | Finance → Dashboard | `/office-finance` | `finance.reports.read` + renamed `CAP financeNav` | View scoped balances, periods, income/expense and pending finance work. |
| Office Finance → Office Finance → Transactions | Finance → Transactions | `/office-finance/transactions` | `finance.transactions.read` + `CAP financeNav` | Maker creates/submits; independent checker approves/returns; post/reverse with attachments. |
| Office Finance → Office Finance → Reports | Finance → Reports | `/office-finance/reports` | `finance.reports.read` + `CAP financeNav` | Run Company/Branch-period reports and exports. |
| Assets & licences → Custodian Inbox | Assets & Licences → Custodian inbox | `/asset-management/inbox` | `ANY assets.assignments.read / assets.department.assignments.read` + renamed `CAP assetsNav` | Process department-scoped custody requests and hand-offs. |
| Assets & licences → Assigned to employees | Assets & Licences → Assigned to employees | `/asset-management/employee-assets` | `assets.assignments.read` + `CAP assetsNav` | Assign, acknowledge, return and inspect Employee assets. |
| Assets & licences → Assets | Assets & Licences → Assets | `/asset-management/assets` | `assets.assets.read` + `CAP assetsNav` | Manage inventory, availability, location/card and lifecycle. |
| Assets & licences → Licences | Assets & Licences → Licences | `/asset-management/licenses` | `ANY assets.assignments.read / assets.department.assignments.read / assets.assets.read` + `CAP assetsNav` | View licence pools, enforce capacity and allocate/revoke seats. |
| Assets & licences → Transfers | Assets & Licences → Transfers | `/asset-management/transfers` | `ANY assets.assets.read / assets.department.read` + `CAP assetsNav` | Request/accept/reject/cancel Company- and department-scoped transfers. |
| Assets & licences → Clearance waivers | Assets & Licences → Clearance waivers | `/asset-management/waivers` | `assets.clearance.waive` + `CAP assetsNav` | Request and independently approve/reject sensitive asset-clearance waivers. |
| Administration → Company Groups | Setup → Organization → Company groups | `/administration/company-groups` | `organization.company-groups.read` | Maintain tenant/group ownership and group-scoped administration. |
| Administration → Companies | Setup → Organization → Companies | `/administration/companies` | `organization.companies.read` | Maintain legal entity, legal country and Company-level configuration/entitlements. |
| Not present | Setup → Organization → Companies → Modules & Features | `/administration/companies/[id]/modules` | Read: `organization.companies.read`; save: `organization.companies.manage` | **Added:** review and change Company-owned module entitlements. Payroll requires Finance and File storage; Recruitment shortlist requires Recruitment. Changes are scoped, atomic and audited. |
| Administration → Branches | Setup → Organization → Branches | `/administration/branches` | `organization.branches.read` | Maintain location, ISO country/subdivision, timezone and working week. |
| Administration → Departments | Setup → Organization → Departments | `/administration/departments` | `organization.structure.read` | Maintain branch-specific departments. |
| Administration → Designations | Setup → Organization → Designations | `/administration/designations` | `organization.structure.read` | Maintain Company job titles; designations do not grant application permissions. |
| Human Resources → Employee Documents → Document Types | Setup → HR → Document types | `/hr/employee-document-types` | `hr.documents.read` | Create/edit document-purpose/type metadata. |
| Human Resources → Employee Documents → Categories | Setup → HR → Document categories | `/hr/employee-document-categories` | `hr.documents.read` | Create/edit document categories and validation metadata. |
| Human Resources → Onboarding Templates | Setup → HR → Onboarding templates | `/hr/onboarding-templates` | `hr.onboarding.read` + `CAP onboardingNav` | Build/version/publish templates, task groups, department assignments and requirements. |
| Not present | **Setup → HR → Approval workflows** | **`/administration/approval-workflows`** | `ANY organization.companies.manage / workflow.workflow.manage / hr.requests.manage` | **Added:** configure Company-owned approval workflows and ordered steps; HR request types link here when not configured. |
| Administration → Shifts | Setup → Workforce → Shifts | `/administration/shifts` | **Changed:** `hr.schedule.read`; current allowed `ANY hr.schedule.read / hr.schedule.manage / organization.structure.read` | Maintain normal/overnight shifts used by rosters and attendance. |
| Administration → Business Calendar | Setup → Workforce → Business calendar | `/administration/business-calendar` | `calendar.business.read` | Import → validate → review/approve → add to draft → publish; inspect impacts and effective office scope. |
| Human Resources → Leave → Types | Setup → Workforce → Leave types | `/hr/leave/types` | `hr.leave.read` | Maintain categorized leave types with collision-safe generated codes. |
| Human Resources → Leave → Policies | Setup → Workforce → Leave policies | `/hr/leave/policies` | `hr.leave.read` | Configure accrual/eligibility/limits and assign policies. |
| Human Resources → Leave → Holidays | Setup → Workforce → Holidays | `/hr/leave/holidays` | `hr.holidays.read` | View published calendar directory, runtime/source state and legacy-transition state. |
| Office Finance → Office Finance → Setup | Setup → Finance | `/office-finance/setup` | `ANY finance.settings.manage / finance.transactions.read` + renamed `CAP financeNav` | Configure financial profile, currency/year, periods, parties, categories, accounts and payroll mapping. |
| Assets & licences → Categories | Setup → Assets & licences → Asset categories | `/asset-management/asset-categories` | `assets.assets.read` + renamed `CAP assetsNav` | Maintain inventory categories. |
| Assets & licences → Types | Setup → Assets & licences → Asset types | `/asset-management/asset-types` | `assets.assets.read` + `CAP assetsNav` | Maintain physical/software asset types and rules. |
| Assets & licences → Department grants | Setup → Assets & licences → Department grants | `/asset-management/department-grants` | `assets.department-access.manage` + `CAP assetsNav` | Grant/revoke branch-and-department custodian access; not Company-wide. |
| Administration & Security → Settings | Removed | `/settings` | None | **Removed:** hidden placeholder had no page or workflow. Company configuration stays in its owning Setup pages. |
| Human Resources → Attendance → Period Closing | Operations → Attendance period closing | `/hr/attendance/periods` | `hr.attendance.read` | Move attendance periods through controlled close/reopen states and enforce immutability. |
| Human Resources → Recruitment → Delivery | Operations → Recruitment delivery | `/hr/recruitment/delivery` | `hr.recruitment.delivery.read` + new `CAP deliveryOperationsNav` | Inspect recruitment delivery attempts and retry/recover failures. |
| Operations → Delivery Queue | Operations → Delivery queue | `/admin/operations/delivery` | `ANY platform.delivery.read / hr.recruitment.delivery.read` + renamed `CAP deliveryOperationsNav` | Inspect queue/message/attempt state and retry/recover delivery. |
| Operations → Dead Letters | Operations → Dead letters | `/admin/operations/delivery/dead-letters` | Same permissions + `CAP deliveryOperationsNav` | Inspect terminal delivery failures and requeue/recover with audit. |
| Operations → Suppressions | Operations → Suppressions | `/admin/operations/delivery/suppressions` | Same permissions + `CAP deliveryOperationsNav` | Review/manage suppressed recipients. |
| Operations → Recipient Exceptions | Operations → Recipient exceptions | `/admin/operations/delivery/recipient-exceptions` | Same permissions + `CAP deliveryOperationsNav` | Review recipient resolution exceptions and remediation. |
| Operations → File Operations | Operations → File operations | `/administration/operations/files` | `files.operations.read` + renamed `CAP fileOperationsNav` | Reconcile uploads/objects, scanner outcomes, retries and retention operations. |
| Administration & Security → Users | Security → Users | `/administration/users` | `security.users.read` | Invite/link Users, assign scoped roles, disable accounts and manage access. |
| Administration & Security → Roles & Permissions | Security → Roles & permissions | `/administration/security` | `security.roles.read` | Create/edit tenant roles and assign only permissions the administrator may grant. |
| Administration & Security → Document Retention | Security → Document retention | `/settings/security/document-retention` | `files.retention.manage` | Configure retention policy and controlled purge eligibility. |

## Full frontend page-route inventory mapped to the new menu

All routes below existed in Current and remain unchanged in New unless explicitly marked **Added**. Dynamic segments are shown literally.

| New menu/page family | Page routes |
|---|---|
| Dashboard | `/dashboard` |
| My Work → Overview | `/my-workspace` |
| My Work → My calendar | `/my-workspace/calendar` |
| My Work → My leave | `/my-workspace/leave` |
| My Work → Onboarding | `/my-workspace/onboarding` |
| My Work → HR requests | `/my-workspace/hr-requests` |
| My Work → Approvals & clearance | `/my-workspace/approvals` |
| My Work → My projects | `/my-workspace/projects` |
| My Work → My timesheets | `/my-workspace/timesheets` |
| People → Employees | `/hr/employees`, `/hr/employees/new`, `/hr/employees/[id]`, `/hr/employees/[id]/edit` |
| People → Employee onboarding | `/hr/employee-onboarding`, `/hr/employee-onboarding/new`, `/hr/employee-onboarding/[id]` |
| People → HR requests | `/hr/hr-requests` |
| People → Employee separations | `/hr/employee-separations`, `/hr/employee-separations/[id]` |
| People → Employee documents | `/hr/employee-documents`, `/hr/employee-documents/new`, `/hr/employee-documents/[id]`, `/hr/employee-documents/[id]/edit` |
| Recruitment → Dashboard | `/hr/recruitment` |
| Recruitment → Openings | `/hr/recruitment/openings`, `/hr/recruitment/openings/new`, `/hr/recruitment/openings/[id]` |
| Recruitment → Applications | `/hr/recruitment/applications`, `/hr/recruitment/applications/[id]` |
| Recruitment → Candidates | `/hr/recruitment/candidates`, `/hr/recruitment/candidates/[id]` |
| Recruitment → Interviews | `/hr/recruitment/interviews`, `/hr/recruitment/interviews/[id]`, `/hr/recruitment/interviews/[id]/evaluate` |
| Recruitment → Hiring decisions | `/hr/recruitment/hiring-decisions`, `/hr/recruitment/hiring-decisions/[openingId]` |
| Recruitment → Offers | `/hr/recruitment/offers`, `/hr/recruitment/offers/[id]` |
| Workforce → Work schedule | `/hr/work-schedule` |
| Workforce → Attendance | `/hr/attendance`, `/hr/attendance/exceptions` |
| Workforce → Overtime | `/hr/overtime` |
| Workforce → Leave | `/hr/leave`, `/hr/leave/balances`, `/hr/leave/calendar`, `/hr/leave/comp-off` |
| Payroll | `/hr/payroll`, `/hr/payroll/runs/[id]` |
| Projects | `/projects/projects`, `/projects/projects/[id]` |
| Projects → Team timesheets | `/team/timesheets` |
| Finance → Dashboard | `/office-finance` |
| Finance → Transactions | `/office-finance/transactions`, `/office-finance/transactions/[id]` |
| Finance → Reports | `/office-finance/reports` |
| Assets & Licences | `/asset-management/inbox`, `/asset-management/employee-assets`, `/asset-management/assets`, `/asset-management/licenses`, `/asset-management/transfers`, `/asset-management/waivers` |
| Setup → Organization → Company groups | `/administration/company-groups` |
| Setup → Organization → Companies | `/administration/companies`, `/administration/companies/new`, `/administration/companies/[id]/edit`, **Added:** `/administration/companies/[id]/modules` |
| Setup → Organization → Branches | `/administration/branches`, `/administration/branches/new`, `/administration/branches/[id]/edit` |
| Setup → Organization → Departments | `/administration/departments`, `/administration/departments/new`, `/administration/departments/[id]/edit` |
| Setup → Organization → Designations | `/administration/designations`, `/administration/designations/new`, `/administration/designations/[id]/edit` |
| Setup → HR → Document types | `/hr/employee-document-types`, `/hr/employee-document-types/new`, `/hr/employee-document-types/[id]/edit` |
| Setup → HR → Document categories | `/hr/employee-document-categories`, `/hr/employee-document-categories/new`, `/hr/employee-document-categories/[id]/edit` |
| Setup → HR → Onboarding templates | `/hr/onboarding-templates`, `/hr/onboarding-templates/new`, `/hr/onboarding-templates/[id]`, `/hr/onboarding-templates/[id]/departments/[departmentId]` |
| Setup → HR → Approval workflows | **Added:** `/administration/approval-workflows` |
| Setup → Workforce → Shifts | `/administration/shifts` |
| Setup → Workforce → Business calendar | `/administration/business-calendar`, `/administration/business-calendar/imports`, `/administration/business-calendar/preview`, `/administration/business-calendar/impacts`, `/administration/business-calendar/[calendarId]`, `/administration/business-calendar/[calendarId]/versions/[versionId]` |
| Setup → Workforce → Leave types/policies/holidays | `/hr/leave/types`, `/hr/leave/policies`, `/hr/leave/holidays` |
| Setup → Finance | `/office-finance/setup` |
| Setup → Assets & licences | `/asset-management/asset-categories`, `/asset-management/asset-types`, `/asset-management/department-grants` |
| Operations → Attendance period closing | `/hr/attendance/periods` |
| Operations → Recruitment delivery | `/hr/recruitment/delivery`, `/hr/recruitment/delivery/[id]` |
| Operations → Delivery | `/admin/operations/delivery`, `/admin/operations/delivery/[id]`, `/admin/operations/delivery/dead-letters`, `/admin/operations/delivery/suppressions`, `/admin/operations/delivery/recipient-exceptions` |
| Operations → File operations | `/administration/operations/files` |
| Security → Users | `/administration/users`, `/administration/users/new`, `/administration/users/[id]/access` |
| Security → Roles & permissions | `/administration/security`, `/administration/security/new`, `/administration/security/[id]/edit` |
| Security → Document retention | `/settings/security/document-retention` |
| Public/auth/system pages (not sidebar items) | `/`, `/accept-invitation`, `/careers/[companyCode]`, `/careers/[companyCode]/jobs/[openingCode]`, `/change-password`, `/forgot-password`, `/login`, `/offer-response`, `/onboarding`, `/register`, `/reset-password` |
| Intentionally unavailable/system pages | `/design-system` returns `notFound`; `/projects/resources` explains that the heatmap is deferred and links back to Projects. |

Inventory notes:

- Both refs contain two `page.tsx` files that resolve to `/`; both redirect to `/dashboard`. This pre-existing duplicate implementation was not introduced by `PMS-170926`.
- The hidden `/settings` placeholder was removed from New. The implemented `/settings/security/document-retention` route remains unchanged under Security.
- Unique frontend URL count is 127 → 129. Approval workflows and Company Modules & Features are the two added URLs.

## Permissions and role comparison

### Menu authorization model

Current:

- Permission checks plus mixed frontend feature flags and environment/Company allowlists.
- Capability names use rollout terminology such as `officeFinanceNav`, `assetNav`, `deliveryOpsNav` and `fileOpsNav`.
- Recruitment visibility also uses frontend feature flags.

New:

- One shared menu tree is filtered by permissions and Company-owned module capabilities.
- Company module administration uses `organization.companies.read` for review and `organization.companies.manage` for mutation. Direct IDs remain constrained by the active global, Company Group or Company scope.
- Capability names are canonical: `financeNav`, `payrollNav`, `projectsNav`, `onboardingNav`, `assetsNav`, `deliveryOperationsNav`, `fileOperationsNav`, `recruitmentNav`, `recruitmentShortlist`.
- A missing Company entitlement is denied by default.
- Global platform access/Super Administrator is handled explicitly by the backend capability service.
- Designation still has no permission effect; access comes from scoped role assignments.

Direct menu-gate deltas:

1. My leave: the workspace is visible with `hr.self.read`; application actions additionally require `hr.self.manage`.
2. Shifts: `ANY(hr.schedule.read, hr.schedule.manage, organization.structure.read)` → `hr.schedule.read`.
3. Approval workflows: new; `ANY(organization.companies.manage, workflow.workflow.manage, hr.requests.manage)`.
4. Recruitment pages: existing `hr.recruitment.read` plus new Company `recruitmentNav` capability.
5. Recruitment delivery and delivery operations: existing permission plus `deliveryOperationsNav` entitlement.
6. Finance/assets/file operations retain their permissions but use renamed Company-entitlement capabilities.

### Live role evidence

Both schemas contain the same nine active system roles:

- Super Administrator
- Organization Owner
- Company Administrator
- HR Manager
- Project Manager
- Asset Manager
- Asset Department Custodian
- Employee
- Finance Manager

Live data differences:

- `dsp_pms`: four custom tenant roles; 331 system-role permission links.
- `dsp_pms_stg`: three custom QA roles; 331 system-role permission links.
- The new development/test schema includes both `PROJECT_MANAGER → hr.clearance.department.read` and `PROJECT_MANAGER → hr.clearance.department.manage` links from the verified clearance migration.
- Custom-role counts are tenant/reference-data differences, not product-schema differences.

## Workflow changes by module

| Module | Current | New |
|---|---|---|
| Organization/auth | Login/session restoration with implicit/fallback behavior in several paths. | Explicit Company/Branch scope selection for ambiguous assignments; no first-record fallback; founding owner explicitly selects Company/Branch/Department/Designation; stricter session-restore handling. |
| People | Employee creation and User invitation are separate and can depend on URL-provided details; normal creation used legacy import semantics. | Manual Employee source is explicit; Employee directory links to invitation using only `employeeId`, then loads authoritative details; same-Company cross-Branch reporting managers are permitted. |
| Recruitment | Frontend feature flags and tenant rollout configuration; offer currency could default to INR. | Company entitlement gates recruitment; offer currency comes from Company Financial Profile; generated codes and delivery/file handling are hardened. The isolated recruitment-privacy worktree is not counted as completed branch functionality unless its diff is separately integrated. |
| Onboarding | Environment rollout gates and mixed legacy/version terminology. | Company entitlement gate, canonical terminology, scoped templates, clearer command/idempotency behavior and task hand-offs. |
| HR requests/separation | Transactions could attempt to create or repair workflow configuration implicitly. | Configuration is explicit in Setup; missing workflow is a clear not-configured state; transactions never create/reactivate/rename/overwrite approval workflows; attachment download is actor/scoped-HR authorized. |
| Business calendar/holidays | Calendar administration existed but transition and reviewed-import behavior was less explicit. | Explicit validate → review/approve → add-to-draft → publish flow; branch-effective directory/source metadata; reviewed country/year packs fail closed; impact/transition states remain visible. |
| Attendance/overtime/leave | Core workflows already existed. | Query-driven attendance filters; correction cancels superseded submitted regularizations; no UAT defaults; clearer overtime validation; leave categories and collision-safe generated leave codes. |
| Payroll | Environment Company allowlist and fixed assumptions around country/finance readiness. | Company entitlement; Company legal country and Financial Profile drive payroll dependencies; dependency reasons are explicit; workflow remains calculate → approve → pay → finance expense → payslip. |
| Projects/timesheets | Environment Company allowlist and older rollout naming. | Company entitlement; collision-safe project stage/task codes, Employee name/code on timesheets and stronger Company/Branch/Department checks on sensitive actions. |
| Finance | Environment Company allowlist; mixed rollout naming. | Company entitlement; stronger Branch scope, attachment handling and typed financial configuration; same maker/checker lifecycle remains. |
| Assets/licences | Environment/JSON Company allowlists; capability `assetNav`. | Company entitlement; `assetsNav`; branch-and-department custodian grants preserved; pending request/licence capacity/allocation details exposed; inappropriate self-actions suppressed. |
| Delivery/files | Delivery/File Storage rollout flags and allowlists; provider-specific configuration. | Company entitlements; canonical capability names; SMTP delivery; storage prefix is deployment identity; recovery/scanner/reconciliation remain operational flows. |
| Navigation | Eight scattered sections with configuration mixed into daily modules. | Twelve task-first sections, no URL migration, maximum two interaction levels, configuration under Setup and recovery under Operations. |

## Database and module mapping

| Product area | Entitlement | Representative tables/models |
|---|---|---|
| Organization | Core (not entitlement-gated) | `company_groups`, `companies`, `branches`, `departments`, `designations`, `company_settings`, `company_module_entitlements` |
| Security | Core | `users`, `auth_sessions`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `user_invitations`, `password_reset_challenges`, `security_events`, `audit_logs` |
| People/HR | Core; onboarding separately entitled | `employees`, `employee_career_events`, `employee_documents`, `hr_requests`, `employee_separations`, `employee_clearances`, `employee_clearance_items` |
| Recruitment | `RECRUITMENT`; shortlist uses `RECRUITMENT_SHORTLIST` | `job_openings`, `candidates`, `job_applications`, `interview_sessions`, `interview_evaluations`, `job_offers`, `recruitment_documents`, `recruitment_delivery_attempts` |
| Onboarding | `ONBOARDING` | `OnboardingTemplate`, `OnboardingTemplateVersion`, `OnboardingTemplateTask`, `EmployeeOnboarding`, `EmployeeOnboardingTask`, `OnboardingCommandReceipt` and related contribution/requirement tables |
| Workforce/calendar | Core | `shifts`, `shift_rosters`, `shift_roster_entries`, `attendances`, `attendance_exceptions`, `attendance_regularizations`, `attendance_periods`, `business_calendars`, `business_calendar_versions`, `business_calendar_events`, `holidays` |
| Leave/overtime | Core | `leave_types`, `leave_policies`, `leave_requests`, `employee_leave_balances`, `leave_balance_transactions`, `comp_off_credits`, `overtime_requests`, `approval_transactions` |
| Payroll | `PAYROLL`, with `FINANCE` and `FILE_STORAGE` readiness dependencies | `PayrollRun`, `PayrollRunEmployee`, `PayrollRunEmployeeLine`, `PayrollPayslip`, `EmployeeSalary`, `EmployeeTaxProfile`, `SalaryComponent` |
| Projects | `PROJECTS` | `projects`, `project_stages`, `project_tasks`, `project_team_members`, `task_participants`, `task_submissions`, `task_reviews`, `work_log_headers`, `work_log_lines` |
| Finance | `FINANCE` | `company_financial_profiles`, `business_parties`, `finance_categories`, `finance_payment_accounts`, `finance_periods`, `finance_transactions`, `finance_transaction_attachments` |
| Assets/licences | `ASSETS` | `assets`, `asset_categories`, `asset_types`, `employee_assets`, `asset_custody_requests`, `department_asset_grants`, `software_license_allocations`, `asset_ownership_transfers`, `asset_clearance_waivers` |
| Delivery | `DELIVERY` | `delivery_messages`, `delivery_attempts`, `delivery_provider_events`, `delivery_recipient_exceptions`, `email_suppressions`, `outbox_events` |
| Files | `FILE_STORAGE` | `file_objects`, `file_upload_sessions`, `file_operation_attempts`, `file_access_audits`, `file_retention_policies`, `GeneratedFileIntent` |

## Live schema delta

### Added only in `dsp_pms_stg`

- Table `company_module_entitlements` with a Company foreign key, unique `(companyId, module)` key and enabled-state indexes.
- QA-only table `qa_environment_sentinel`; this is staging safety infrastructure, not a product table.
- `companies.legal_country_code`.
- `pending_registrations.legal_country_code`.
- Enum `EmployeeCreationSource`: `MANUAL`.
- Enum `CompanyModuleCode`: `ASSETS`, `DELIVERY`, `FILE_STORAGE`, `FINANCE`, `ONBOARDING`, `PAYROLL`, `PROJECTS`, `RECRUITMENT`, `RECRUITMENT_SHORTLIST`.
- Enum `DeliveryProvider`: `SMTP`.
- `job_offers.compensationCurrency` remains required but no longer has the database default `'INR'`; the application resolves it from Company Financial Profile.

No table or column exists in `dsp_pms` that is absent from `dsp_pms_stg`. After normalizing schema-qualified enum defaults, the offer-currency default is the only meaningful changed common-column definition.

### Migration alignment matrix

| Migration/change | In master code | In PMS code | Applied `dsp_pms` | Applied `dsp_pms_stg` | Meaning |
|---|---:|---:|---:|---:|---|
| `20260916150000_owner_dashboard_setup_permission` | No | Yes | **Yes** | Yes | Current DB already contains a branch-only migration not present in `origin/master`; grants setup-dashboard permission to Owner/Admin. |
| `20260917090000_employee_manual_creation_source` | No | Yes | No | Yes | Adds canonical `MANUAL` source. |
| `20260917100000_company_legal_country_code` | No | Yes | No | Yes | Adds legal-country fields/check constraints. |
| `20260918130000_company_module_entitlements` | No | Yes | No | Yes | Replaces tenant IDs/allowlists in environment configuration. |
| `20260918140000_delivery_smtp_provider` | No | Yes | No | Yes | Adds SMTP transport marker. |
| `20260918150000_job_offer_company_currency_default` | No | Yes | No | Yes | Removes INR database default. |
| `20260921180000_project_manager_department_clearance` | Yes | Yes | Yes | Yes | Grants two Project Manager department-clearance permissions; applied and verified in the new development/test schema. |

Repository/live-ledger state:

- New repository: 161 migrations.
- `dsp_pms`: 156 unique applied; missing exactly the five New-only migrations from `20260917090000` through `20260918150000` above; zero failed, unexpected or checksum-mismatched migrations in the read-only lineage result.
- `dsp_pms_stg`: 161/161 applied; zero missing, failed, unexpected, duplicate or checksum-mismatched migrations. Project Manager has both department-clearance grants.
- The canonical deployed `20260821181000_office_finance_payroll_release_contract` SQL was restored on the isolated master backport branch in local commit `4ca5abd`. That backport still requires review and push; no applied migration was replayed or edited in either database schema.

## Added, removed, renamed and changed summary

### Added

- Menu/page: Setup → HR → Approval workflows at `/administration/approval-workflows`.
- Company module entitlement model/table and nine module codes.
- Company/pending-registration legal country.
- Manual Employee source.
- SMTP delivery provider option.
- Company Financial Profile-derived offer currency.
- Company-scoped module capability gates for recruitment, assets, delivery, files, finance, payroll, projects and onboarding.

### Removed

- No frontend page or existing URL was removed.
- Active tenant/company IDs and module allowlists were removed from the environment contract.
- Active V1/V2/Lite rollout capability names were replaced by canonical product names; immutable migration/encryption compatibility markers may remain.
- Frontend recruitment feature flags no longer decide authenticated navigation.

### Renamed/regrouped

- Dashboard/My Workspace → Dashboard + My Work.
- Administration → Setup → Organization/Workforce.
- Human Resources → People + Recruitment + Workforce + Payroll + Setup.
- Office Finance → Finance; setup moved under Setup.
- Project Management → Projects.
- Administration & Security → Setup + Security.
- Asset capability `assetNav` → `assetsNav`; finance/delivery/file capability names similarly canonicalized.

### Changed routes

- No existing implemented route changed.
- Added `/administration/approval-workflows`.
- Added `/administration/companies/[id]/modules` as a Company detail workflow.
- Removed the navigation-only `/settings` placeholder; it never had a page implementation.

## Important inconsistencies and release impact

1. **New development/test migration gap resolved.** `dsp_pms_stg` is 161/161 and contains both Project Manager clearance grants; `dsp_pms` remained unchanged during that guarded operation.
2. **Current code/DB lineage backport is local.** The missing `20260916150000_owner_dashboard_setup_permission` file was restored on the isolated master backport branch in commit `c1e12df`, but has not been pushed to `origin/master`.
3. **Historical finance migration checksum corrected locally.** The canonical deployed SQL was restored on the isolated master backport branch in commit `4ca5abd`; that backport has not been pushed.
4. **Navigation metadata corrected.** New now has 69 implemented/auditable navigation routes and zero planned routes. The historical 69-route browser evidence covered a different composition: it excluded the old Settings placeholder and predates Approval workflows, which still requires a fresh authenticated audit.
5. **Settings placeholder resolved.** The dead `/settings` entry is removed. Company module configuration is implemented at `/administration/companies/[id]/modules`; focused automated checks pass, and the targeted authenticated browser smoke passed for Owner manage, HR read-only and Employee denied states without persisting a test change.
6. **Provider-backed validation remains separate.** SMTP, object storage and scanner behavior cannot be proven only from code/schema comparison.

## Bottom line

`PMS-170926` preserves existing implemented URLs and reorganizes them into a task-first, permission-and-Company-entitlement-driven navigation model. It adds Approval workflows and a Company Modules & Features detail page while removing the dead navigation-only Settings placeholder. The material platform changes are Company-owned module availability and administration, explicit organization/location/financial configuration, explicit approval-workflow setup, removal of tenant allowlists from environment configuration, and several workflow/authorization hardenings.

Before treating New as deployable, run the fresh 69-route authenticated audit including Approval workflows, complete the remaining golden threads and provider-backed email/file/scanner checks, and obtain business-owner sign-off. The Company Modules & Features detail workflow has its targeted authenticated evidence. No production/current-schema mutation is authorized by this report.
