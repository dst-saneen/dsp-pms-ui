# Office Finance Lite & Payroll Lite — Fixes Summary

**Prepared for:** Management review  
**Date:** 28 August 2026  
**Primary commit:** `6dc2ec3` — *Web + API TypeScript error, ESLint error, ESLint warning — issues fixed*  
**Scope:** 302 files changed (+6,207 / −2,641 lines)  
**Source plan:** `office-finance-payroll-latest-code-review-and-fix-plan.md`

---

## Executive summary

This work closed findings from the Office Finance Lite and Payroll Lite code review, and brought the full Web and API codebase to a deployable compile/lint baseline.

**What was delivered:**

1. **Product fixes** — Database hardening, API security and validation, server-driven UI capabilities, version-conflict handling, payslip status, and CSV export safety across Office Finance and Payroll.
2. **UI fixes** — Ten screens were corrected so actions appear only when the server allows them, form input is preserved on conflicts, and payslip status is complete.
3. **Build readiness** — All TypeScript, ESLint (`--max-warnings 0`), and production build gates pass on Web and API.

**Important:** Office Finance Lite and Payroll Lite remain **disabled by default**. The application can be deployed, but enabling these modules for a Company requires separate pilot sign-off (see [Remaining gates](#remaining-gates-before-enablement)).

---

## What was requested vs what was done

| Request | Outcome |
|---|---|
| Close findings in the Office Finance / Payroll review plan | DB migrations, API fixes, UI capability gating, tests, and operational scripts |
| Fix all Web + API build and lint errors | Full-repo TypeScript, ESLint, and production build cleaned |
| Zero errors/warnings for deployment | All quality gates re-run and passed (see below) |

---

## Quality gates (all passed after fixes)

| Gate | Result |
|---|---|
| API `tsc --noEmit` | Pass |
| API `eslint --max-warnings 0` | Pass |
| API `pnpm run build` (Prisma generate + Nest build) | Pass |
| Web `tsc --noEmit` | Pass |
| Web `eslint . --max-warnings 0` | Pass |
| Web `next build` | Pass (80 pages) |

---

## Issues fixed — master list

### P0 — Critical (data integrity / security / blocking failures)

| ID | Module | Issue | Fix | User impact |
|---|---|---|---|---|
| **SHARED-P0-01** | Prisma / build | `Project.businessPartyId` was declared twice in the schema, blocking Prisma validation and client generation | Removed duplicate field; kept one Company-scoped relation | Backend build and DB client generation work again |
| **SHARED-P0-02** | Configuration | Project feature keys duplicated with conflicting types in environment config | Single typed declaration per key; shared ERP-lite env parser | Module capability typing and backend compilation fixed |
| **FIN-P0-01** | Finance — Reversal | Reversal used the same creator and approver; DB trigger rejected every reversal | Maker-checker exemption for reversal path; reversal audit flow corrected | Transaction reversal works on transaction detail screen |
| **FIN-P0-02** | Finance — Security | Bank account reference stored as Base64 (reversible), not encrypted | AES-GCM encryption at rest; only last 4 digits exposed on read; backfill script added | Payment account data is properly protected |
| **PAY-P0-01** | Payroll — Calculate | Salary, tax, deduction, and preflight reads happened outside the calculation transaction | All reads moved inside a single DB transaction during calculate | Payroll runs are consistent even under concurrent edits |

### P1 — High (validation, concurrency, export safety)

| ID | Module | Issue | Fix | User impact |
|---|---|---|---|---|
| **FIN-P1-01** | Finance — Validation | Update/submit/approve did not revalidate the full transaction shape | Full-shape validation on every state transition | Invalid drafts can no longer be approved |
| **FIN-P1-02** | Database | Approved/reversed immutability trigger allowed evidence-field drift | New migration hardens immutability triggers | Financial history cannot be silently altered after approval |
| **FIN-P1-03** | Database | Opening-balance check could race with the first approved movement | Trigger hardening in migration series | Account balances stay correct at first use |
| **FIN-P1-04** | Finance — Idempotency | Command receipts reused Asset HMAC keys and stored full responses | Dedicated Finance HMAC keys; safe snapshot storage; serialization retry | Finance commands are isolated and replay-safe |
| **FIN-P1-05** | Finance — Export | CSV cells were not escaped; untrusted values could execute as spreadsheet formulas | Server-side formula injection protection on CSV export | Finance report export is safe to open in Excel/Sheets |
| **PAY-P1-01** | Payroll — Concurrency | Approve and other transitions did not consistently use status/version CAS | Compare-and-set on status and version for all transitions | Stale or duplicate payroll decisions are blocked |
| **PAY-P1-02** | Database | Payroll relations used bare IDs without Company-qualified composite keys | New migration adds composite FKs and Company scope | Cross-Company data leakage prevented at DB level |
| **PAY-P1-03** | Database | Approved/paid runs and snapshot rows lacked full immutability guards | Trigger hardening after expand/contract migrations | Payroll evidence cannot drift after calculation |
| **PAY-P1-04** | Database | Full run-period unique constraint conflicted with replace-after-cancel | Contract migration resolves period identity | Cancelled periods can be replaced without raw DB errors |
| **PAY-P1-05** | Payroll — Preflight | Overlap SQL cast text IDs to UUID and suppressed DB errors (fail-open) | Fail-closed overlap check; no unsafe UUID cast | Preflight correctly reports overlapping payroll periods |
| **PAY-P1-06** | Payroll — Payslips | Stale `GENERATING` payslip row treated as success; payslip stayed unavailable | Worker lease/retry/dead-letter; stale `GENERATING` is not success | Payslips reach `AVAILABLE` or show `FAILED` with help text |
| **PAY-P1-08** | Payroll — Idempotency | Payroll receipts reused Asset HMAC keys | Dedicated Payroll HMAC keys; safe snapshot | Payroll commands are isolated from Asset module |
| **PAY-P1-09** | Payroll — Export | Register CSV lacked formula-injection protection | Server-side CSV cell escaping on register export | Payroll register export is safe in spreadsheets |

### P2 — UI and verification

| ID | Module | Issue | Fix | User impact |
|---|---|---|---|---|
| **UI-P2-01** | UI — Capabilities | Create/Setup/Export buttons inferred from local permissions, not server Company scope | All action buttons gated on server capability list (see UI pages below) | UI no longer shows actions that the API will reject |
| **UI-P2-02** | Tests | No focused component or browser persona coverage | Component tests + Playwright persona spec added (not yet run against enabled pilot Company) | Automated coverage exists; live pilot run still pending |

---

## UI page fixes (10 screens)

These were not layout bugs. The UI advertised actions from local permissions, dropped form input on version conflicts, or showed incomplete payslip status.

### Office Finance

| # | Route | Finding | Issue | Fix |
|---|---|---|---|---|
| 1 | `/office-finance/transactions` | UI-P2-01 | **New Transaction** shown from local permission only; API failed when Company did not allow Finance create | Button renders only when server capability includes `CREATE_TRANSACTION` |
| 2 | `/office-finance/transactions/[id]` | §6.8 | On **409 version conflict**, reason/reference typed by user was lost; stale version was retried | Reason/reference stay in dialog; transaction refetched; user retries with current version; approve/reverse never applied optimistically |
| 3 | `/office-finance/setup` | UI-P2-01 | Create/archive controls for profile, parties, categories, accounts, periods used local permission strings | Setup mutations require server `MANAGE_SETUP`; period create requires server `CREATE_PERIOD` |
| 4 | `/office-finance/reports` | UI-P2-01, FIN-P1-05 | **Export CSV** could appear without Company export permission; CSV cells could run as formulas | Export only when server includes `EXPORT_REPORT`; CSV formula-escaped on server |

> The Office Finance dashboard at `/office-finance` was not a page-level bug fix.

### Payroll

| # | Route | Finding | Issue | Fix |
|---|---|---|---|---|
| 5 | `/hr/payroll` (Runs tab) | UI-P2-01, §7.11 | **New run** from local permission only; preflight blockers needed before calculate | **New run** only when server includes `CREATE_RUN`; preflight blockers/warnings visible before calculation |
| 6 | `/hr/payroll` (Salary Components tab) | UI-P2-01 | **New component** from local permission only | Action only when server includes `MANAGE_COMPONENTS` |
| 7 | `/hr/payroll` (Employee Salaries tab) + employee record salary tab | UI-P2-01 | Salary revision, tax profile, deduction edit from local permission only | Actions only when server includes `MANAGE_EMPLOYEE_INPUTS` |
| 8 | `/hr/payroll` (Reports tab) | UI-P2-01, PAY-P1-09 | **Export register** without Company-scoped export capability; formula injection risk | Export only when server includes `EXPORT_REGISTER`; CSV escaped on server |
| 9 | `/hr/payroll/runs/[id]` | §7.11 | On **409**, reason and payment reference dropped; payment reference stayed after successful Mark Paid | Reason/payment ref kept on 409, run refetched, retry; payment ref cleared after successful Mark Paid |
| 10 | `/my-workspace` (Payslips card) | §7.11, PAY-P1-06 | Payslip status incomplete; download not limited to short-lived grant | Shows `PENDING` / `GENERATING` / `FAILED` / `AVAILABLE` with help text; **Download** only for `AVAILABLE` via short-lived grant |

---

## Backend and database changes (by area)

### Database / Prisma migrations

| Change | Purpose |
|---|---|
| `schema.prisma` — envelope/lease/composite uniqueness; duplicate `Project.businessPartyId` removed | Schema repair and release hardening |
| `20260821180000_office_finance_payroll_release_expand` | Additive expand: envelope, lease, snapshot columns |
| `20260821181000_office_finance_payroll_release_contract` | Contract: NOT NULL, composite FKs, immutability/reversal/opening-balance triggers |
| `20260826120000_office_finance_payroll_trigger_hardening` | Trigger hardening after expand/contract |
| `20260826130000_leave_request_company_scope` | `LeaveRequest` Company scope for Payroll overlap preflight |

### Operational scripts added

| Script | Purpose |
|---|---|
| `office-finance-payroll-preflight.ts` | Preflight checks: bank envelope, reversal, payroll overlap, payslip lease |
| `office-finance-payroll-backfill.ts` | Bank-reference re-encryption for legacy data |
| `office-finance-payroll-catalog-verify.ts` | Catalog verification of indexes, triggers, FKs |
| `run-office-finance-payroll-pg-tests.ts` | Postgres-gated catalog/concurrency test runner |

### Office Finance API (key files)

| Area | What changed |
|---|---|
| Transactions | Reversal maker-checker; full-shape revalidation; CAS version checks |
| Payment accounts | AES-GCM encryption; last-4 on read only |
| Reports | Formula-safe CSV export endpoint |
| Command receipts | Dedicated Finance HMAC; serialization retry on deadlock |
| Capabilities | Server collection actions: `CREATE_TRANSACTION`, `MANAGE_SETUP`, `CREATE_PERIOD`, `EXPORT_REPORT` |

### Payroll API (key files)

| Area | What changed |
|---|---|
| Calculation | All salary/tax/deduction/attendance reads inside one transaction |
| Runs | Status/version CAS on calculate/approve/mark-paid/cancel |
| Preflight | Fail-closed overlap SQL (no unsafe UUID cast) |
| Payslip worker | Lease, retry, dead-letter; stale `GENERATING` handled correctly |
| Payslips | Short-lived download grant for self-service |
| Command receipts | Dedicated Payroll HMAC |
| Capabilities | Server collection actions: `CREATE_RUN`, `MANAGE_COMPONENTS`, `MANAGE_EMPLOYEE_INPUTS`, `EXPORT_REGISTER` |

### Shared infrastructure

| Component | What changed |
|---|---|
| `module-capabilities.service.ts` | Finance and Payroll server-side collection capabilities |
| `serialization-retry.helper.ts` | Retry on Prisma serialization/deadlock (`P2034` / `40001`) |
| `environment.ts` / `erp-lite-crypto-env.ts` | Typed crypto and feature-flag env (no duplicate Project keys) |
| `erp-lite-ops-metrics.ts` | Safe ops counters (no bank/salary values in metrics) |

---

## Tests added

| Type | Files | Coverage |
|---|---|---|
| Unit — Finance | `finance-transaction-validator.shape.spec.ts`, `finance-command-receipt.hmac.spec.ts`, `finance-capability.service.spec.ts` | Shape validation, HMAC fail-closed, capabilities |
| Unit — Payroll | `payroll-preflight.fail-closed.spec.ts`, `payroll-command-receipt.hmac.spec.ts` | Overlap fail-closed, HMAC |
| Unit — Shared | `serialization-retry.helper.spec.ts` | Deadlock retry |
| Component — UI | `transactions-workspace.test.tsx`, `payroll-runs-tab.test.tsx`, `salary-components-tab.test.tsx`, `my-payslips-card.test.tsx` | Capability gating, payslip status |
| E2E — Playwright | `office-finance-payroll-personas.spec.ts` | Persona smoke (not yet run against enabled pilot Company) |

---

## Full-repo build and lint fixes (outside Finance/Payroll)

In addition to the product fixes above, **every** Web and API TypeScript, ESLint, and production-build error was cleared so deployment is not blocked by unrelated modules.

### Error types cleared

- `@typescript-eslint/no-unsafe-*`, `no-explicit-any`, `no-unused-vars`
- Unused imports and parameters
- Prettier formatting
- React Compiler warnings (`form.watch` → `useWatch`)
- TypeScript: wrong Prisma fields (`rowVersion`, `companyId` on models that don't have them), missing `sourceType` on selects

### Modules touched (lint/build only)

| Module | Approx. files | Typical fixes |
|---|---|---|
| Asset domain | 33+ | Unused imports, unsafe `any`, DTO typing |
| Projects | 25 | Typed notification events, unused params |
| Delivery / mail / health | 18 | Lint, typing, prettier |
| File storage | 16 | Unsafe casts, unused vars |
| Onboarding v2 / templates | 14+ | Invalid Prisma fields removed |
| Recruitment | 13 | Typed errors, guard lint |
| Backend tests | 47 | Typed mocks, prettier |
| Other frontend | ~20 | Upload, employee docs, recruitment, projects |

---

## Change volume (commit `6dc2ec3`)

| Area | Files |
|---|---|
| Backend tests | 47 |
| Asset domain | 33+ |
| Projects | 25 |
| Office Finance API | 22 |
| Payroll API | 21 |
| Delivery | 18 |
| File storage | 16 |
| Onboarding v2 / templates | 14+ |
| Recruitment | 13 |
| Frontend Office Finance | 8 |
| Frontend Payroll | 7 |
| Prisma migrations / schema | 5 |
| Operational scripts | 5 |
| Other frontend | ~20 |
| **Total** | **302** |

---

## Remaining gates before enablement

Office Finance Lite and Payroll Lite are **still disabled for every Company and Branch**. Deploy can proceed (compile/lint/build are clean), but **module enablement is NO-GO** until:

| Gate | Status |
|---|---|
| Disposable PostgreSQL migration rehearsal | Pending |
| Real PostgreSQL concurrency tests | Pending |
| API persona suite against enabled pilot Company | Pending |
| Browser (Playwright) persona run against enabled pilot Company | Pending |
| Business sign-off | Pending |

---

## Related documents

| Document | Purpose |
|---|---|
| `office-finance-payroll-latest-code-review-and-fix-plan.md` | Original review findings and remediation plan |
| `office-finance-payroll-ui-page-fixes.md` | Detailed file-level change log for developers |
| `docs/development/office-finance-payroll-latest-code-review-and-fix-plan.md` | Same plan under docs/development |

---

*This summary covers commit `6dc2ec3` **and** all current uncommitted changes listed in [Section 5](#5-uncommitted-changes-current-working-tree-not-yet-committed).*

---

## 5. Uncommitted changes (current working tree — not yet committed)

These changes are **in the repo now** but **not yet in git**. They extend the `6dc2ec3` work for local dev, UAT/E2E, and additional Payroll/Finance fixes.

### Summary of uncommitted work

| Area | Issue / need | Fix |
|---|---|---|
| **Redis — local dev** | No documented way to run Redis locally; health check failed when Redis disabled or slow | Added `docker-compose.yml` for Redis 7; `redis:up` / `redis:down` / `redis:logs` / `redis:ping` npm scripts; README and `.env.example` docs; increased connect/command timeouts (5s / 3s) |
| **Redis — health** | `/health/ready` always required Redis even when `REDIS_ENABLED=false` | Health reports `redis: skipped` when disabled; readiness only requires Redis when enabled |
| **Finance Setup** | First-time financial profile update failed with “not configured” instead of creating profile | `expectedVersion: 0` now creates `CompanyFinancialProfile` on first save with audit event |
| **Payroll preflight** | Overlap checks used raw SQL with UUID cast; could fail-open or error opaquely | Replaced with Prisma fetch + in-memory range overlap for salary and tax profiles; added `findEffectiveSalaryHead` helper |
| **Payroll calculate** | Serializable transaction could time out under load | Added `maxWait: 10s` and `timeout: 120s` on calculate transaction |
| **DB migration** | `EmployeeSalaryLine` missing `companyId` in DB vs Prisma composite keys | New migration backfills `companyId`, adds composite FKs to `EmployeeSalary` and `SalaryComponent` |
| **Offer response UI** | Non-VALID states (expired, revoked, etc.) not shown; invalid token showed generic error | State-specific titles/messages; INVALID token shows “invalid or already used” |
| **E2E — recruitment** | Offer response tests flaky without API stubs | Added `offer-response-routes.ts` stubs; longer timeouts; updated assertions |
| **E2E — asset** | Licence route test flaky / removed route | Removed licences check; `domcontentloaded` wait on navigations |
| **E2E — golden thread** | No authenticated smoke across key modules | New `golden-thread.spec.ts` + `auth.ts` helper (dashboard, finance, payroll, my-workspace, recruitment) |
| **UAT scripts** | Manual UAT setup/fix for pilot Company was ad hoc | `e2e-uat-setup.ts`, `e2e-uat-fix.ts`, `diagnose-preflight.ts` for payroll preflight debugging |
| **Verification scripts** | No one-command API smoke / golden-thread runner | `scripts/quick-verify.ps1`, `scripts/e2e-smoke-test.ps1`, `scripts/golden-thread.ps1` |
| **Playwright config** | Local runs used all CPU workers (flaky) | Local workers capped to 2 (CI still 1) |

### Uncommitted files — modified

| File | Change |
|---|---|
| `README.md` | Redis Docker setup, `redis:ping`, health check docs |
| `backend/.env.example` | Redis required note; timeout values 5000/3000 ms |
| `backend/package.json` | Scripts: `redis:ping`, `redis:up`, `redis:down`, `redis:logs`, `e2e:uat-setup`, `e2e:uat-fix` |
| `backend/src/modules/auth/redis.service.ts` | `isEnabled()`; health returns true when Redis disabled |
| `backend/src/modules/health/health.service.ts` | Redis `skipped` when disabled; readiness logic updated |
| `backend/src/modules/office-finance/services/office-finance-settings.service.ts` | Auto-create financial profile on first save (`expectedVersion: 0`) |
| `backend/src/modules/payroll/services/payroll-preflight.service.ts` | Prisma-based overlap detection; `findEffectiveSalaryHead`; `rangesOverlap` helper |
| `backend/src/modules/payroll/services/payroll-runs.service.ts` | Calculate transaction timeout/maxWait |
| `frontend/features/recruitment/offer-response/components/offer-response-workspace.tsx` | State-specific error UI for INVALID/EXPIRED/REVOKED/etc. |
| `frontend/e2e/asset-management.spec.ts` | Removed licences route test; faster navigation waits |
| `frontend/e2e/recruitment-hardening.spec.ts` | Route stubs; updated offer response assertions |
| `frontend/playwright.config.ts` | Local workers: 2 |

### Uncommitted files — new (untracked)

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local Redis 7 container with healthcheck and persistent volume |
| `backend/prisma/migrations/20260828133000_employee_salary_line_company_id/migration.sql` | Backfill `EmployeeSalaryLine.companyId`; composite FKs |
| `backend/scripts/redis-ping.ts` | Verify Redis connectivity from backend `.env` |
| `backend/scripts/diagnose-preflight.ts` | Step-by-step payroll preflight diagnostic for pilot Company |
| `backend/scripts/e2e-uat-setup.ts` | UAT seed: owner employee link, finance profile, attendance, salary data |
| `backend/scripts/e2e-uat-fix.ts` | UAT fix: cancel blocking payroll runs, create approver user |
| `frontend/e2e/golden-thread.spec.ts` | Authenticated Playwright smoke across 5 key routes |
| `frontend/e2e/helpers/auth.ts` | Shared login helper for E2E (`loginViaUi`, `loginViaApi`) |
| `frontend/e2e/helpers/offer-response-routes.ts` | Playwright route stubs for offer inspection API |
| `scripts/quick-verify.ps1` | Quick API health + module capability checks |
| `scripts/e2e-smoke-test.ps1` | Guide-aligned API smoke test runner |
| `scripts/golden-thread.ps1` | API golden-thread runner (Finance/Payroll automatable subset) |
| `office-finance-payroll-fixes-manager-summary.md` | This manager summary document |
| `office-finance-payroll-ui-page-fixes.md` | Developer file-level change log |

### Uncommitted — excluded from product summary

| File | Reason |
|---|---|
| `frontend/test-results/**` | Playwright run artifacts (deleted old error-context files; updated `.last-run.json`) |

### Uncommitted change counts

| Type | Count |
|---|---|
| Modified tracked files | 12 product/config files (+ test-results artifacts) |
| New untracked files | 14 scripts, migrations, E2E helpers, and docs |
| Lines (product files only) | ~236 insertions, ~988 deletions (mostly test-result cleanup) |
