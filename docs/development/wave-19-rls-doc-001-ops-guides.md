# RLS-DOC-001 — Operations & canonical module availability (W19)

**Purpose:** English menu + role guidance matching final UAT UI. No secrets. No tenant screenshots with PII. Module availability is resolved from the database-backed Company entitlement and permission scope, never tenant IDs or environment rollout flags.

---

## Availability labels (use these words)

| Label | Meaning |
|-------|---------|
| **Canonical availability** | Every active Company receives the canonical module entitlements at creation. No UUID allowlists or module rollout flags select Companies. |
| **Company access** | The active Company entitlement and the user's permissions determine whether a route or action is available. |
| **Infrastructure readiness** | Workers, storage, scanners, providers, and keys can affect operational readiness globally; they never select Companies for a module. |
| **Dev-fallback scan** | Non-prod + empty `CLAMAV_HOST` → uploads may mark clean without live ClamAV (not for production) |

---

## Projects & Timesheets

| Item | Value |
|------|-------|
| Nav | Project Management → Projects; Team timesheets; My Workspace → Projects / Timesheets |
| Availability | Canonical `PROJECTS` Company entitlement, provisioned for every active Company; no environment rollout flag or Company allowlist |
| Permissions | `projects.projects.read/manage`, `projects.tasks.work`, `projects.timesheets.submit/approve` |
| Path | Create project → Client (business party) → tasks → timesheet submit → manager approve |
| Empty state | No projects / no lines until created; buttons disabled with why when period locked |
| Limitation | Current product scope — not a full PM suite |

---

## Office Finance

| Item | Value |
|------|-------|
| Nav | Office Finance → Dashboard / Transactions / Setup / Reports |
| Availability | Canonical `FINANCE` Company entitlement, provisioned for every active Company; no environment rollout flag or Company allowlist |
| Permissions | `finance.transactions.read`, `finance.settings.manage`, reports |
| Path | Setup (profile, categories, accounts, period) → create transaction → submit → different user approve |
| Empty / blocked | Incomplete setup → create fails with actionable error; maker-checker same user blocked |
| Limitation | Current finance scope — not a full GL |

---

## Payroll & Payslips

| Item | Value |
|------|-------|
| Nav | Human Resources → Payroll |
| Availability | Canonical `PAYROLL`, `FINANCE`, and `FILE_STORAGE` Company entitlements. `WORKFORCE_JOBS_ENABLED` is worker readiness, not a Company rollout control. |
| Permissions | `payroll.*` read/manage / self |
| Path | Components → Employee salaries → Tax/Deductions → Runs (preflight) → approve → mark paid |
| Preflight | **Blockers** (finance payroll category, attendance period) vs **warnings** (missing salary/tax) |
| Limitation | Payslip file ops need File Storage healthy |

---

## Delivery (Recruitment + Operations)

| Item | Value |
|------|-------|
| HR nav | Recruitment → Delivery (`hr.recruitment.delivery.read`) |
| Ops nav | Operations → Delivery Queue / Dead letters / Suppressions / Exceptions |
| Ops permissions | Owner/Admin: `platform.delivery.read` + `retry` (company-scoped APIs); also HR delivery read opens ops pages |
| Availability | Canonical `DELIVERY` Company entitlement plus the relevant user permission. Provider and encryption/HMAC key configuration governs delivery readiness globally, never Company selection. |
| Readiness | Operations pages expose the live queue and health state; unavailable delivery infrastructure is reported honestly. |
| Recovery | Retry/Cancel/Release/Resolve require reason; Retry/Cancel disabled-with-why when status forbids |
| Limitation | Live inbox proof needs a configured provider; do not claim Delivered from provider acceptance alone |

---

## File Operations

| Item | Value |
|------|-------|
| Nav | Operations → File Operations |
| Availability | Canonical `FILE_STORAGE` Company entitlement plus permission. Storage and scanner settings are shared infrastructure, not tenant rollout controls. |
| Permissions | `files.operations.read` (view); `files.operations.manage` (reconcile / clear false scan failures) |
| Path | Review health → Run reconcile (operationId) → Clear false scan failures if MIME false-positives |
| Scanner | Production: live ClamAV. Local: **dev-fallback** when host empty |
| Limitation | Never shows object keys / provider payloads |

---

## Document Retention

| Item | Value |
|------|-------|
| Nav | Administration & Security → Document Retention |
| Permission | `files.retention.manage` |
| Path | Select rule unit (Hours/Days/Months/Years) → **Save draft** or **Save & approve** |
| Honesty | Neither button purges; the controlled purge worker runs only after reconciliation and approval |
| Limitation | Linked documents / signatures / legal holds are not deleted from this screen |

---

## Role expectations (UAT personas)

| Slot | Role | Should see |
|------|------|------------|
| A Owner | ORGANIZATION_OWNER | Finance, Payroll, Ops Delivery/Files, Retention, Projects |
| B HR | HR_MANAGER | HR modules; recruitment delivery; not necessarily platform-only screens |
| C Manager | PROJECT_MANAGER | Projects approve / team timesheets |
| D Employee | EMPLOYEE | My Workspace; must **not** open Admin Delivery / File Ops / Retention |

---

## Verification labels for SIGN-001

- [ ] Routes in this doc match the signed freeze SHA
- [ ] No tenant/module rollout flags or Company allowlists are described
- [ ] Delivery provider/key readiness is distinguished from module availability
- [ ] No passwords, tokens, or tenant PII screenshots in the pack
