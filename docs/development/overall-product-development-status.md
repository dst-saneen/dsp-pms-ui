# Overall ERP/HRMS Product Development Status

## Status snapshot

- Repository: `C:\DataScape\HRMS\ERP`
- Branch: `main`
- Reviewed commit: `aa281d1`
- Status date: 2026-08-17
- Assessment type: source, route, schema, test, build and read-only migration-status review
- Application code changes made by this assessment: none
- Database changes made by this assessment: none

## Executive status

### Current product stage

**Core HRMS:** integration and production-hardening stage.

**Complete ERP roadmap:** early/partial implementation stage.

**Current release decision:** **NO-GO for production.**

The application has a broad HRMS foundation and multiple usable feature areas. It is no longer only a prototype. However, the current repository is not a production-approved product because automated gates are not all green, one migration is pending in the configured development database, Recruitment has P1 security/data-integrity defects, real persona UAT is incomplete and several wider ERP modules remain backend-only or documentation-only.

### Planning estimate

These percentages are directional planning estimates, not acceptance evidence or completed story-point calculations.

| Scope | Estimated feature implementation | Estimated production readiness | Current interpretation |
|---|---:|---:|---|
| Foundation and core HRMS | 70–80% | 50–60% | Broad API/UI coverage; hardening and UAT remain |
| HRMS including Recruitment, secure documents and Payroll | 60–70% | 40–50% | Recruitment and document/email integrations are major blockers; Payroll is planned |
| Complete ERP roadmap | 25–35% | Below 25% | CRM, procurement, finance, BIM, training and full analytics are mostly documentation/planning |

The product should be described externally as **HRMS beta/integration-stage**, not as a completed ERP suite.

## Current implementation inventory

The repository currently contains:

- 131 Prisma models
- 97 committed migrations
- 108 backend controller declarations
- 68 frontend page routes
- 72 backend automated-test files
- 14 frontend automated-test files, almost entirely Recruitment-related

These counts indicate implementation breadth. They do not prove that every module is integrated, tenant-safe or accepted by users.

## Module-by-module status

| Product area | Backend | Frontend | Automated evidence | Current status |
|---|---|---|---|---|
| Organization foundation | Company Group, Company, Branch, Department, Designation and settings APIs/models present | Administration pages present | Foundation coverage exists | **Advanced; UAT pending** |
| Authentication and user lifecycle | Registration, login, invitations, sessions, password recovery and account lifecycle present | Auth, invitation and user-administration pages present | Strong foundation tests | **Advanced; live persona verification pending** |
| Roles and permissions | System/custom roles, assignments, scope and session invalidation present | Security administration page present | RBAC/foundation tests present | **Advanced; cross-tenant and browser UAT pending** |
| Employee management | Employee, profile, assignments, separation and lifecycle data present | Employee list/detail/edit pages present | Foundation scope/lifecycle tests present | **Advanced; recruitment conversion dependency incomplete** |
| Recruitment | Opening, Candidate, Application, Interview, Evaluation, Offer, conversion, career and probation APIs present | Internal Recruitment and public Careers/offer pages present | Utility/component/mock smoke tests only | **Integration-stage; production blocked** |
| Onboarding templates | Template versions, published snapshots, task groups, dependencies, contributions and designation assignments present | Template designer and department/task pages present | Foundation onboarding tests present | **Advanced; notification/career integration incomplete** |
| Employee onboarding | Execution, tasks, workspace and completion-to-Probation transition present | HR and employee onboarding pages present | Service tests present | **Advanced; full Recruitment-to-Onboarding transaction incomplete** |
| Business Calendar | Versioning, events, imports, runtime, impacts and publishing present | Full administration route group present | Extensive focused test coverage and rollout docs | **Advanced; signed business UAT still required** |
| Work schedules and shifts | Shift, employee assignment and roster APIs present | Shift and Work Schedule pages present | Workforce tests present | **Advanced; lifecycle and manual UAT remain** |
| Attendance | Daily attendance, exceptions, regularization and period closing present | Daily, exception and period pages present | Service/calendar tests present | **Advanced; release UAT and UX hardening remain** |
| Leave | Types, policies, balances, requests, approvals, calendar and holidays present | Full Leave route group present | Extensive service/resolver tests | **Most mature HR operation; production sign-off still pending** |
| Overtime and Comp-off | Policy, request, approval, credit and allocation services present | Overtime and Comp-off pages present | Focused tests present | **Advanced; end-to-end UAT pending** |
| Assets | Category, type, asset and employee-assignment APIs present | All four Asset Management pages present | Limited foundation evidence | **Implemented CRUD flow; production hardening/UAT needed** |
| Employee documents | Metadata, category/type, expiry and verification workflows present | Document administration pages present | Some foundation tests | **Partial: metadata workflow, not complete secure file management** |
| Dashboard and self-service | Manager dashboard, employee `/me`, notifications and workspace services present | Dashboard and My Workspace pages present | Self-service/manager tests present | **Implemented; browser/persona acceptance incomplete** |
| Notifications/outbox | Internal workforce notification/outbox foundation present | Notification consumption available through workspace patterns | Unit coverage present | **Partial: Recruitment recipients and Candidate email missing** |
| Payroll | Salary, tax, deduction, payroll-run and dashboard backend code present | Navigation explicitly marks Payroll as planned; no Payroll page route | No meaningful Payroll test suite found | **Backend prototype/planned; not releasable** |
| Projects and task execution | Project, stages, team, tasks, submissions, reviews, work logs and schedules have backend CRUD/services | Navigation marks Projects/Resources as planned; no user-facing project routes | No focused product-flow suite found | **Backend scaffold/partial; not releasable** |
| HR requests and document generation | Backend request, templates, approvals and local PDF generation present | No complete user-facing HR-request/document flow | No complete end-to-end evidence | **Partial/internal scaffold** |
| Generic approvals/workflow | Backend workflow/transaction models and CRUD exist | No accepted administration/runtime UI | Limited focused evidence | **Platform scaffold; do not sell as complete** |
| CRM and client/vendor management | Documentation exists; no equivalent released application flow | No active CRM/client/vendor routes | None | **Planned/not implemented** |
| Procurement | Documentation exists | No application routes | None | **Planned/not implemented** |
| Finance/accounting/invoicing | Roadmap and dashboard documentation exist; Payroll is separate and partial | No Finance application routes | None | **Planned/not implemented** |
| BIM operations | Documentation exists | No BIM application routes | None | **Planned/not implemented** |
| Training platform | Documentation exists | No Training application routes | None | **Planned/not implemented** |
| Executive and cross-domain analytics | Dashboard specifications exist | Only current HR/manager dashboard surfaces are present | No full analytics evidence | **Mostly planned** |

## Important progress since the earlier release audit

Current static inspection confirms several earlier findings have been addressed in code:

- The UAT runner now requires passwords from environment variables instead of embedding the runner password in source.
- Employee-shift create/list/detail operations now apply Employee domain scope and company validation.
- `hr.team.approve` is accepted by Leave, Attendance regularization and Overtime approval routes.
- Role administration now uses `AuditService` and writes security events for relevant changes.
- Legacy Employee creation is controlled by `ALLOW_LEGACY_EMPLOYEE_CREATE` and records `LEGACY_IMPORT`.

These code corrections still require current isolated-UAT confirmation before they count as production acceptance.

## Current release and quality evidence

### Backend

| Gate | Current result |
|---|---:|
| Prisma schema validation | Passed |
| Nest production build | Passed |
| Full test suite | **Failed: 73/74 suites; 456/457 tests passed** |
| Lint | **Failed: 94 errors** |
| Recruitment integration/concurrency suite | **Missing** |

The current test failure is caused by the Workforce Jobs scheduler test fixture not supplying the newly added `OfferService` constructor dependency.

### Frontend

| Gate | Current result |
|---|---:|
| TypeScript | Passed |
| Unit/component tests | Passed: 24/24 |
| Production build | Passed |
| Lint | **Failed: 4 errors and 12 warnings** |
| Playwright smoke | Passed: 14/14 |
| Real API/database persona flow | **Missing** |

The passing Playwright checks use Recruitment mock mode and passed while the backend was unavailable. They are smoke evidence, not end-to-end product acceptance.

### Runtime and database

- Frontend port `3200` was not listening during this status review.
- Backend port `4500` was not listening during this status review.
- The configured database is `dsp_erp_dev`, schema `dsp_pms`.
- Prisma found 97 committed migrations.
- `20260814110000_recruitment_backfill` is pending.
- The pending migration was **not applied** during this review.
- No dedicated current UAT environment or signed end-to-end UAT result was verified.

## Critical blockers before production

### 1. Recruitment security and transaction integrity

The detailed findings are recorded in:

- [Recruitment Backend/API Code Review](./recruitment-to-onboarding-api-code-review.md)
- [Recruitment Frontend/UI Code Review](./recruitment-to-onboarding-ui-code-review.md)

The principal blockers are:

- Cross-tenant scope bypass in Offer and conversion operations
- Candidate/application scope leakage
- Non-atomic Employee conversion and onboarding creation
- Public Application records that can persist without a CV
- Download access to documents with pending malware scans
- Missing Candidate email and offer-link delivery pipeline
- Raw offer token persistence in browser session storage
- Mock mode enabled by default
- Simulated rather than real Turnstile protection

### 2. Release gates are not green

Backend tests, backend lint and frontend lint currently fail. Production approval requires all release gates to exit successfully on one recorded commit.

### 3. Database is behind the repository

The Recruitment backfill migration is pending in the configured development database. Migration status must be reconciled first in disposable/UAT environments, not applied directly to shared production as an experiment.

### 4. Product-wide browser and persona UAT is incomplete

There is no current signed evidence for the complete lifecycle:

`Organization → Structure → Recruitment → Employee/User → Onboarding → Workforce → Leave/Attendance → Assets → Self-service`

Required negative testing includes cross-tenant IDs, unauthorized direct URLs, self-approval, expired tokens, invitation/session invalidation and confidential data filtering.

### 5. Secure file management is incomplete

Employee documents are mainly metadata references. Recruitment documents currently use local storage and have a malware-scan availability defect. A production product needs private object storage, encryption, scanning, short-lived authorization and retention/deletion controls.

### 6. Backend-only modules must remain hidden

Payroll, Projects, generic workflow/approvals, HR requests and document generation should not be represented as completed modules until tenant security, UI, tests and business UAT are delivered.

## What is currently suitable for demonstration

With controlled development data, the following can be demonstrated as implemented feature foundations:

- Organization setup and master data
- User invitations and security administration
- Employee directory and profile management
- Onboarding template design and task execution
- Business Calendar administration
- Work Schedule, Attendance, Leave, Overtime and Comp-off screens
- Asset master and assignment screens
- Recruitment screens and public pages in controlled/mock mode
- Dashboard and employee workspace surfaces

A demonstration must explicitly state that it is not production acceptance and that Recruitment email/storage/security integrations are unfinished.

## What must not be described as completed

- Production-ready Recruitment-to-Active lifecycle
- Secure end-to-end Candidate document handling
- Production Candidate offer/email delivery
- Payroll processing product
- Project Management product
- Generic workflow/approval platform
- CRM, procurement or finance suite
- BIM or training platform
- Full executive analytics suite
- Multi-tenant production certification

## Recommended completion sequence

### Phase 1: Stabilize the current HRMS release

1. Fix Recruitment tenant isolation and hierarchy validation.
2. Make conversion serializable, atomic and recoverably idempotent.
3. Correct public CV/document integrity and fail-closed malware handling.
4. Implement private storage, Candidate email and offer-token delivery.
5. Disable default mock behavior and implement real Turnstile verification.
6. Apply the pending migration only after from-zero and upgrade rehearsal.
7. Clear backend tests/lint and frontend lint.

### Phase 2: Prove the core product

1. Provision a dedicated disposable/UAT database and runtime.
2. Run Company Group, Company and Branch isolation suites.
3. Run all system-role personas.
4. Complete Recruitment-to-Active with real email, files and invitation acceptance.
5. Complete Workforce, Leave, Attendance, Onboarding, Assets and self-service UAT.
6. Complete responsive, keyboard and accessibility checks.
7. Obtain technical and business sign-off on the same release commit.

### Phase 3: Complete deferred HRMS modules

1. Production Employee document storage and retention
2. Employee separation/clearance UI lifecycle
3. HR requests and secure generated documents
4. Payroll domain redesign, tenant security, UI and payroll UAT
5. Broader frontend automated coverage beyond Recruitment

### Phase 4: Expand from HRMS to ERP

Develop and independently accept:

1. Project and resource management
2. CRM/client/vendor management
3. Procurement
4. Finance/accounting/invoicing/payments
5. BIM operations
6. Training platform
7. Cross-domain analytics and forecasting

## Production definition of done

The current HRMS release can be approved only when:

- [ ] All P1 security and data-integrity findings are closed.
- [ ] Repository and deployment commit are recorded and clean.
- [ ] Prisma reports no pending migrations on the approved target.
- [ ] Backend schema, build, lint and all tests pass.
- [ ] Frontend TypeScript, lint, tests and production build pass.
- [ ] Real API/database browser personas pass.
- [ ] Cross-tenant and direct-URL denial tests pass.
- [ ] Private storage, malware scanning and email delivery are configured and verified.
- [ ] Health live/readiness checks pass in UAT.
- [ ] Rollback and backup evidence is recorded.
- [ ] Technical UAT is signed.
- [ ] Business/client UAT is signed.

## Final product statement

The repository represents a **substantial HRMS product under active integration and hardening**, with Organization, Employee, Onboarding, Workforce, Leave, Attendance and Assets at an advanced implementation stage. Recruitment is newly implemented but has production-blocking gaps. Payroll and Projects are backend prototypes/planned modules. The broader ERP vision remains largely future work.

The correct external status is therefore:

> **Core HRMS beta — development substantially progressed, production hardening and UAT incomplete; full ERP not yet completed.**

