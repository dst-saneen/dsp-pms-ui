# Conversation change log — Office Finance / Payroll + Web/API lint-build

> **Manager summary:** See [`office-finance-payroll-fixes-manager-summary.md`](./office-finance-payroll-fixes-manager-summary.md) for the issue list with descriptions, UI page fixes, quality gates, and enablement status.

This is the full list of **files changed in this conversation**, and **what changed in them**.

It is **not** only UI pages. Work covered:

1. Office Finance Lite / Payroll Lite review-plan code
2. Full Web + API TypeScript, ESLint, and production-build errors

**Commit that contains this work:** `6dc2ec3`  
**Message:** `Web + API TypeScript error, ESLint error, ESLint warning -- issues fixed`  
**Size:** **302 files**, +6207 / −2641

---

## What was asked, and what was done

| Ask | What was done |
|---|---|
| Close findings in `office-finance-payroll-latest-code-review-and-fix-plan.md` | DB, API, UI capability, tests, scripts |
| Check Web + API for build/lint errors and fix them | Full-repo TypeScript + ESLint + `pnpm run build` |
| “No single error/warning for deployment” | Re-ran `tsc`, `eslint --max-warnings 0`, and production build |

**Final gates that were run after the fixes (all exit 0):**

| Gate | Result |
|---|---|
| API `tsc --noEmit` | pass |
| API `eslint --max-warnings 0` | pass |
| API `pnpm run build` (`prisma generate` + `nest build`) | pass |
| Web `tsc --noEmit` | pass |
| Web `eslint . --max-warnings 0` | pass |
| Web `next build` | pass (80 pages) |

Office Finance Lite and Payroll Lite stay **disabled** by default. Deploy can compile. Enabling those modules is a separate pilot decision.

---

## 1. Office Finance / Payroll product files

These are the review-plan fixes (reversal, encryption, validation, CAS, CSV, capabilities, payslips). Not layout bugs.

### Database / Prisma

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Envelope/lease/composite uniqueness fields; duplicate `Project.businessPartyId` removed |
| `backend/prisma/migrations/20260821180000_office_finance_payroll_release_expand/migration.sql` | Additive expand: envelope, lease, snapshot columns |
| `backend/prisma/migrations/20260821181000_office_finance_payroll_release_contract/migration.sql` | Contract: NOT NULL, composite FKs, immutability/reversal/opening-balance triggers |
| `backend/prisma/migrations/20260826120000_office_finance_payroll_trigger_hardening/migration.sql` | Trigger hardening after expand/contract |
| `backend/prisma/migrations/20260826130000_leave_request_company_scope/migration.sql` | `LeaveRequest` Company scope so Payroll overlap preflight can Company-qualify |

### Scripts / config / shared helpers

| File | Change |
|---|---|
| `backend/scripts/office-finance-payroll-preflight.ts` | Preflight findings for bank envelope, reversal, payroll overlap, payslip lease |
| `backend/scripts/office-finance-payroll-backfill.ts` | Bank-reference re-encryption / backfill |
| `backend/scripts/office-finance-payroll-catalog-verify.ts` | Catalog check of indexes/triggers/FKs |
| `backend/scripts/office-finance-payroll-db.ts` | Shared DB helper for those scripts |
| `backend/scripts/run-office-finance-payroll-pg-tests.ts` | Postgres-gated catalog/concurrency test runner |
| `backend/package.json` | Scripts for preflight, catalog, focused Finance/Payroll tests |
| `backend/src/config/environment.ts` | Finance/Payroll HMAC, bank key, feature-flag env (no duplicate Project keys) |
| `backend/src/config/erp-lite-crypto-env.ts` | Typed crypto env |
| `backend/src/common/helpers/serialization-retry.helper.ts` | Retry on Prisma serialization/deadlock (`P2034` / `40001`) |
| `backend/src/common/helpers/serialization-retry.helper.spec.ts` | Unit tests for that helper |
| `backend/src/common/helpers/index.ts` | Export the helper |
| `backend/src/common/observability/erp-lite-ops-metrics.ts` | Safe ops counters (no bank/salary values) |
| `backend/src/modules/module-capabilities/module-capabilities.service.ts` | Server collection actions: `CREATE_TRANSACTION`, `MANAGE_SETUP`, `CREATE_PERIOD`, `EXPORT_REPORT`, `CREATE_RUN`, `MANAGE_COMPONENTS`, `MANAGE_EMPLOYEE_INPUTS`, `EXPORT_REGISTER` |
| `backend/src/modules/module-capabilities/module-capabilities.service.spec.ts` | Capability tests + lint-safe Jest mock |

### Office Finance API

| File | Change |
|---|---|
| `backend/src/modules/office-finance/services/office-finance-transactions.service.ts` | Reversal maker-checker exemption; full-shape revalidation on update/submit/approve; CAS; `assertVersionedUpdate` sync |
| `backend/src/modules/office-finance/services/finance-transaction-validator.service.ts` | Full shape validation; Company-scoped project; `sourceType` typing |
| `backend/src/modules/office-finance/services/finance-transaction-validator.shape.spec.ts` | Shape matrix tests |
| `backend/src/modules/office-finance/services/finance-command-receipt.service.ts` | Dedicated Finance HMAC (not Asset keys); safe snapshot; serialization retry |
| `backend/src/modules/office-finance/services/finance-command-receipt.hmac.spec.ts` | HMAC fail-closed tests |
| `backend/src/modules/office-finance/services/office-finance-payment-accounts.service.ts` | AES-GCM bank reference; last-4 only on read; `sourceType` on balance projector (tsc fix) |
| `backend/src/modules/office-finance/dto/finance-payment-account.dto.ts` | Bank write vs last-4 read fields |
| `backend/src/modules/office-finance/services/office-finance-reports.service.ts` | Formula-safe CSV export |
| `backend/src/modules/office-finance/controllers/office-finance-reports.controller.ts` | `export.csv` route |
| `backend/src/modules/office-finance/services/finance-capability.service.ts` | Collection capabilities |
| `backend/src/modules/office-finance/services/finance-capability.service.spec.ts` | Capability tests |
| `backend/src/modules/office-finance/services/office-finance-scope.service.ts` | Unused import + sync version assert (lint) |
| `backend/src/modules/office-finance/dto/versioned-command.dto.ts` | Unused `IsOptional` import (lint) |
| `backend/src/modules/office-finance/guards/office-finance-feature.guard.ts` | Unused `_context` lint |
| `backend/src/modules/office-finance/office-finance.module.ts` | Wiring |
| `backend/src/modules/office-finance/services/business-party.service.ts` | Scope/lint |
| `backend/src/modules/office-finance/services/office-finance-attachments.service.ts` | Company-scoped attachments |
| `backend/src/modules/office-finance/services/office-finance-categories.service.ts` | Scope/lint |
| `backend/src/modules/office-finance/services/office-finance-feature.service.ts` | Feature gate |
| `backend/src/modules/office-finance/services/office-finance-periods.service.ts` | Period lock/open |
| `backend/src/modules/office-finance/services/office-finance-settings.service.ts` | Settings |
| `backend/src/modules/office-finance/services/office-finance-response.mapper.ts` | Safe response mapping |
| `backend/src/modules/office-finance/policies/finance-error-codes.ts` | Stable error codes (`FINANCE_REVERSAL_*`, `FINANCE_BANK_KEY_UNAVAILABLE`, …) |

**Issue examples these files close:** reversal used the same creator and approver; bank numbers were Base64 not encrypted; invalid drafts could be approved; CSV cells could run as spreadsheet formulas.

### Payroll API

| File | Change |
|---|---|
| `backend/src/modules/payroll/services/payroll-runs.service.ts` | Status/version CAS; calculate/approve/mark-paid; typed `created` (tsc) |
| `backend/src/modules/payroll/services/payroll-calculation.service.ts` | All salary/tax/deduction/attendance reads inside one transaction |
| `backend/src/modules/payroll/services/payroll-preflight.service.ts` | Overlap SQL fail-closed (no UUID-cast of text IDs) |
| `backend/src/modules/payroll/services/payroll-preflight.fail-closed.spec.ts` | Fail-closed tests |
| `backend/src/modules/payroll/services/payroll-payslip-worker.service.ts` | Lease, retry, dead-letter; stale `GENERATING` is not success |
| `backend/src/modules/payroll/services/payroll-command-receipt.service.ts` | Dedicated Payroll HMAC; safe snapshot |
| `backend/src/modules/payroll/services/payroll-command-receipt.hmac.spec.ts` | HMAC tests |
| `backend/src/modules/payroll/services/payroll-capability.service.ts` | Collection capabilities |
| `backend/src/modules/payroll/controllers/payroll-runs.controller.ts` | Operation id / expectedVersion |
| `backend/src/modules/payroll/controllers/payroll-salary-components.controller.ts` | Same |
| `backend/src/modules/payroll/dto/payroll-run.dto.ts` | Unused import (lint) |
| `backend/src/modules/payroll/dto/salary-component.dto.ts` | Lint |
| `backend/src/modules/payroll/dto/versioned-command.dto.ts` | Unused import (lint) |
| `backend/src/modules/payroll/guards/payroll-feature.guard.ts` | Unused `_context` lint |
| `backend/src/modules/payroll/policies/payroll-error-codes.ts` | Stable error codes |
| `backend/src/modules/payroll/services/payroll-dashboard.service.ts` | Lint |
| `backend/src/modules/payroll/services/payroll-employee-inputs.service.ts` | Company-scoped employee inputs |
| `backend/src/modules/payroll/services/payroll-payslips.service.ts` | Short-lived download grant |
| `backend/src/modules/payroll/services/payroll-response.mapper.ts` | Safe mapping |
| `backend/src/modules/payroll/services/payroll-salary-components.service.ts` | Unused import (lint) |
| `backend/src/modules/payroll/services/payroll-scope.service.ts` | Sync version assert |

**Issue examples:** calculate could mix old/new salary data; overlap preflight could hide SQL errors; payslip could stay `GENERATING`; receipts reused Asset HMAC keys.

### Office Finance / Payroll UI (actual screens)

| Page | File | Issue | Fix |
|---|---|---|---|
| `/office-finance/transactions` | `frontend/features/office-finance/components/transactions-workspace.tsx` | **New Transaction** used local permission | Button only if server `CREATE_TRANSACTION` |
| `/office-finance/transactions/[id]` | `frontend/features/office-finance/components/transaction-action-dialog.tsx` | **409** dropped reason | Keep reason, refetch, retry |
| `/office-finance/setup` | `frontend/features/office-finance/components/setup-workspace.tsx` | Setup/period buttons used local permission | Server `MANAGE_SETUP` / `CREATE_PERIOD` |
| `/office-finance/reports` | `frontend/features/office-finance/components/reports-workspace.tsx` | Export could show without capability | Server `EXPORT_REPORT` + CSV download |
| `/hr/payroll` Runs | `frontend/features/payroll/components/payroll-runs-tab.tsx` | **New run** used local permission | Server `CREATE_RUN` |
| `/hr/payroll` Salary Components | `frontend/features/payroll/components/salary-components-tab.tsx` | **New component** used local permission | Server `MANAGE_COMPONENTS` |
| `/hr/payroll` Employee Salaries + employee salary tab | `frontend/features/payroll/components/employee-salary-profile.tsx` | Salary/tax/deduction edit used local permission | Server `MANAGE_EMPLOYEE_INPUTS` |
| `/hr/payroll` Reports | `frontend/features/payroll/components/payroll-reports-tab.tsx` | Export without capability | Server `EXPORT_REGISTER` |
| `/hr/payroll/runs/[id]` | `frontend/features/payroll/components/run-action-dialog.tsx` | **409** dropped reason/payment ref; ref stayed after Mark Paid | Keep on 409; clear after success |
| `/my-workspace` Payslips | `frontend/features/my-workspace/components/my-payslips-card.tsx` | Status incomplete | `PENDING` / `GENERATING` / `FAILED` / `AVAILABLE`; download only if `AVAILABLE` |

Supporting UI files:

| File | Change |
|---|---|
| `frontend/hooks/use-module-capabilities.ts` | `officeFinanceActions` / `payrollActions` |
| `frontend/config/api.ts` | Finance export CSV endpoint |
| `frontend/services/api-client.ts` | `isVersionConflictError`; typed API error code (also used by lint fixes) |
| `frontend/features/office-finance/service.ts` | CSV blob download |
| `frontend/features/office-finance/hooks.ts` | Unused type imports (lint) |
| `frontend/features/office-finance/components/create-transaction-dialog.tsx` | React Compiler `form.watch` → `useWatch` (warning) |
| `frontend/features/office-finance/components/transactions-workspace.test.tsx` | Capability gating tests |
| `frontend/features/payroll/components/payroll-runs-tab.test.tsx` | Same |
| `frontend/features/payroll/components/salary-components-tab.test.tsx` | Same |
| `frontend/features/my-workspace/components/my-payslips-card.test.tsx` | Payslip status tests |
| `frontend/e2e/office-finance-payroll-personas.spec.ts` | Playwright persona smoke (not run against an enabled pilot) |
| `frontend/package.json` | Focused `test:office-finance` / `test:payroll` scripts |

`/office-finance` dashboard was not a page-level bug fix.

---

## 2. Lint / TypeScript / build error files (outside Finance-Payroll product)

You asked to fix **every** Web + API build/lint error, not only Finance/Payroll. These files were changed for **ESLint, unused imports, `any`, prettier, and TypeScript**, not new product features.

Typical error types that were cleared:

- `@typescript-eslint/no-unsafe-*`, `no-explicit-any`, `no-unused-vars`
- unused imports / unused parameters
- prettier formatting
- React Compiler (`form.watch`, unused hooks)
- TypeScript: missing fields, wrong Prisma fields (`rowVersion` / `companyId` that are not on the model), `sourceType` missing on a select

### Frontend lint/build files

| File | What was wrong / what changed |
|---|---|
| `frontend/app/(dashboard)/admin/operations/delivery/page.tsx` | Unused `Button` import |
| `frontend/components/file-upload/document-download-action.tsx` | `catch (err: any)` → typed `getApiErrorCode` |
| `frontend/components/file-upload/malware-scan-status.tsx` | `as any` / unused vars |
| `frontend/components/file-upload/secure-file-upload-field.tsx` | Unused `FileText` / unused `sessionId` state |
| `frontend/features/asset/components/asset-command-reason-dialog.tsx` | `useEffect` setState-in-effect → render-time reset |
| `frontend/features/employee-document/components/secure-employee-document-upload.tsx` | `as any` → `UploadSessionResponse` / `ScanStatus` |
| `frontend/features/employee-document/forms/employee-document-form.tsx` | `as any` upload session |
| `frontend/features/employee-document/profile/employee-document-profile.tsx` | `as any` scan status |
| `frontend/features/employee-onboarding/forms/start-employee-onboarding-form.tsx` | Unused `useState` import |
| `frontend/features/employee/dashboard/employee-toolbar.tsx` | Unused `useState` |
| `frontend/features/leave-type/dialogs/leave-type-dialog.tsx` | Unused destructured `companyId` |
| `frontend/features/onboarding-template/department-designer/department-task-designer.tsx` | Unstable `departments` array → `useMemo` |
| `frontend/features/onboarding-v2/components/DepartmentOnboardingQueue.tsx` | Unused `StatusBadge` |
| `frontend/features/projects/components/project-workspace.tsx` | `window.location.href` → `router.push` |
| `frontend/features/recruitment/offer-response/components/offer-response-actions.tsx` | `as any` upload session types |
| `frontend/features/recruitment/offers/components/offer-signature-verification-panel.tsx` | `onError: (err: any)` → typed error |

### Backend lint/build files by module

**Asset** — unused imports, unsafe `any`, DTO typing, prettier:

`asset-clearance.controller.ts`, `asset-custody-request.controller.ts`, `asset-department-grant.controller.ts`, `asset-access.service.ts`, `asset-capability.service.ts`, `asset-clearance.service.ts`, `asset-command.service.ts`, `asset-custody-request.service.ts`, `asset-custody.service.ts`, `asset-department-grant-command.service.ts`, `asset-domain.module.ts`, `asset-feature-gate.service.ts`, `asset-feature-gate.ts`, `asset-idempotency.service.ts`, `asset-notification.service.ts`, `asset-query.service.ts`, `asset-response.mapper.ts`, `asset-self-service-query.service.ts`, `asset-sensitive-identifier.service.ts`, `asset-taxonomy-query.service.ts`, `asset-transfer.service.ts`, `license-allocation.service.ts`, DTOs (`create-asset-category-command.dto.ts`, `create-asset-command.dto.ts`, `lifecycle-command.dto.ts`, `search-asset-inventory.dto.ts`, `search-department-grant.dto.ts`), migration files (`asset-v2-backfill.rules.ts`, `asset-v2-backfill.service.ts`, `asset-v2-mapping.loader.ts`, `migration/index.ts`), policies (`asset-employee-eligibility.ts`, `asset-error-codes.ts`, `asset-kind-tracking.ts`, `asset-lifecycle-transitions.ts`, `asset-sort-allowlists.ts`), plus `asset.controller.ts`, `asset.service.ts`, `asset-transfer.controller.ts`, `asset-type.controller.ts`.

**Delivery / mail / health / auth:**

`delivery-claim.service.ts`, `delivery-email-content.service.ts`, `delivery-email.worker.ts`, `delivery-fanout.service.ts`, `delivery-feature-gate.service.ts`, `delivery-inapp-dedupe.util.ts`, `delivery-query.service.ts`, `delivery-suppression.service.ts`, `delivery.controller.ts`, `delivery.module.ts`, `delivery-v2-backfill.service.ts`, `delivery-event.registry.ts`, recipient handlers, `delivery-recipient-exception.service.ts`, `delivery-recipient.types.ts`, `delivery-tenant-snapshot.util.ts`, `transactional-mail.service.ts`, `zeptomail-webhook.controller.ts`, `zeptomail-webhook.normalize.ts`, `zeptomail.service.ts`, `health.service.ts`, `employee-domain-scope.service.ts`, `route-policy.ts`, `attendance.service.ts`, `leave-request.service.ts`, `outbox-processor.service.ts`, `workforce-jobs.scheduler.ts`.

Also env typing: `backend/src/config/asset-v2-env.ts`, `backend/src/config/delivery-v2-env.ts`.

**File storage:**

`s3-storage.adapter.ts`, `file-operations.controller.ts`, `file-storage.controller.ts`, `file-storage.crypto.ts`, `content-type-detector.service.ts`, `file-document-linking.service.ts`, `file-download.service.ts`, `file-reconciliation.service.ts`, `file-retention.service.ts`, `file-upload-session.service.ts`, `generated-file.service.ts`, `offer-signature.service.ts`, `public-offer-token.service.ts`, `storage-s3.config.ts`, `clamav-scanner.worker.ts`, `file-scan.worker.ts`, `employee-document.service.ts`.

**Onboarding:**

`employee-onboarding-task.controller.ts`, `employee-onboarding.controller.ts`, `employee.module.ts`, `onboarding-department-template.service.ts`, `onboarding-task-group.service.ts`, `onboarding-template-task.service.ts` + DTO, `onboarding-template-error-codes.ts`, `onboarding-template-preflight.queries.ts`, `onboarding-template-clone.service.ts`, `onboarding-template-validation.service.ts`, `onboarding-template-version.service.ts`, onboarding-v2 DTOs/helpers/mappers/services (runtime, task runtime, asset fulfillment, feature gate, notification, progress, reminder, scope, template resolution, transaction runner), `contribution.assembler.ts`.

TypeScript on onboarding: Prisma models do **not** have `rowVersion` / extra `companyId` on those tables. Invalid fields were removed so `tsc` passes.

**Projects:**

`projects-permissions.ts`, backfill/mapping, `project-allowed-actions.ts`, `project-request-hash.ts`, `project-task-allowed-actions.ts`, `project-transitions.ts`, `timesheet-hours.ts`, `project-attachments.controller.ts`, `project-me-timesheets.controller.ts`, `projects.controller.ts`, `project-document.service.ts`, `project-notification.service.ts`, `project-stage-command.service.ts`, `project-summary.service.ts`, `project-task-command.service.ts`, `project-team-command.service.ts`, `project-timesheet-command.service.ts`, `project-timesheet-query.service.ts`, `projects-domain-scope.service.ts`, `projects-feature-gate.service.ts`, `projects-lifecycle.service.ts`, `projects-query.service.ts`, `project-lite.types.ts`.

TypeScript: notification `eventType` was a loose `string`; now `ProjectNotificationEvent`. Unused `_actor` / unused-async lint cleaned.

**Recruitment:**

`employee-career.service.ts`, `conversion.service.ts`, `recruitment-feature.guard.ts`, `interview.service.ts`, `search-job-application.dto.ts`, `job-application.service.ts`, `create-job-opening.dto.ts`, `offer.service.ts`, `employee-probation.service.ts`, `recruitment-me.service.ts`, `designation-onboarding-assignment.service.ts`, `recruitment-delivery.processor.ts`, `recruitment-transition.types.ts`.

**Backend tests (lint-only, ~47 files):** foundation specs under `backend/test/foundation/` (asset, delivery, project-lite, onboarding-template, recruitment, zeptomail, workforce) plus `backend/test/recruitment/*.spec.ts`. Typical: typed `request.user`, mock typing, prettier.

**Historical note:** the lint scratch file was intentionally removed. The canonical completion record is the [Office Finance and Payroll remediation plan](../../../development/office-finance-payroll-latest-code-review-and-fix-plan.md).

---

## 3. Counts (commit `6dc2ec3`)

| Area | Files |
|---|---|
| Backend tests | 47 |
| Asset domain + asset controllers | 33+ |
| Projects | 25 |
| Office Finance API | 22 |
| Payroll API | 21 |
| Delivery | 18 |
| File storage | 16 |
| Onboarding v2 / templates | 14+ |
| Recruitment | 13 |
| Frontend Office Finance | 8 |
| Frontend Payroll | 7 |
| Prisma migrations/schema | 5 |
| Scripts | 5 |
| Other frontend (upload, employee, recruitment, projects, my-workspace, delivery page) | ~20 |
| **Total** | **302** |

---

## 4. Honest status

- **Compile / lint / production build:** clean on this machine after the work above (commit `6dc2ec3`).
- **Office Finance / Payroll enablement:** still **NO-GO** until disposable DB rehearsal, concurrency, real API/browser personas, and business sign-off.
- **Uncommitted follow-up:** Redis local dev, health fix, finance profile auto-create, preflight overlap refactor, E2E/UAT scripts — see [`office-finance-payroll-fixes-manager-summary.md`](./office-finance-payroll-fixes-manager-summary.md) Section 5.

---

## 5. Uncommitted changes (current working tree — not yet committed)

> Full descriptions: [`office-finance-payroll-fixes-manager-summary.md`](./office-finance-payroll-fixes-manager-summary.md) Section 5.

### Issues fixed in uncommitted work

| # | Area | Issue | Fix |
|---|---|---|---|
| U1 | Redis / local dev | No local Redis setup; docs missing | `docker-compose.yml`, npm scripts, README, `.env.example` |
| U2 | Health | `/health/ready` failed when Redis disabled | `redis: skipped` when `REDIS_ENABLED=false` |
| U3 | Finance Setup | First profile save failed “not configured” | Auto-create profile on `expectedVersion: 0` |
| U4 | Payroll preflight | SQL overlap checks fragile (UUID cast) | Prisma fetch + in-memory `rangesOverlap` |
| U5 | Payroll calculate | Serializable txn timeout | `maxWait: 10s`, `timeout: 120s` |
| U6 | Database | `EmployeeSalaryLine` missing `companyId` | Migration `20260828133000_employee_salary_line_company_id` |
| U7 | Offer response UI | Wrong/generic messages for invalid/expired offers | State-specific titles and messages |
| U8 | E2E tests | Flaky recruitment/asset tests | Route stubs, timeouts, golden-thread spec |
| U9 | UAT | Manual pilot setup tedious | `e2e-uat-setup.ts`, `e2e-uat-fix.ts`, `diagnose-preflight.ts` |
| U10 | Verification | No quick API smoke runner | `quick-verify.ps1`, `e2e-smoke-test.ps1`, `golden-thread.ps1` |

### Modified files (uncommitted)

| File | Change |
|---|---|
| `README.md` | Redis Docker + ping docs |
| `backend/.env.example` | Redis notes; timeout 5000/3000 |
| `backend/package.json` | `redis:*`, `e2e:uat-*` scripts |
| `backend/src/modules/auth/redis.service.ts` | `isEnabled()`; health when disabled |
| `backend/src/modules/health/health.service.ts` | Redis skipped/disabled logic |
| `backend/src/modules/office-finance/services/office-finance-settings.service.ts` | Auto-create financial profile |
| `backend/src/modules/payroll/services/payroll-preflight.service.ts` | Overlap via Prisma + range helper |
| `backend/src/modules/payroll/services/payroll-runs.service.ts` | Calculate txn timeouts |
| `frontend/features/recruitment/offer-response/components/offer-response-workspace.tsx` | Offer state UI |
| `frontend/e2e/asset-management.spec.ts` | Navigation waits; remove licences test |
| `frontend/e2e/recruitment-hardening.spec.ts` | Offer stubs + assertions |
| `frontend/playwright.config.ts` | Local workers = 2 |

### New files (uncommitted / untracked)

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local Redis 7 |
| `backend/prisma/migrations/20260828133000_employee_salary_line_company_id/` | `EmployeeSalaryLine.companyId` backfill + FKs |
| `backend/scripts/redis-ping.ts` | Redis connectivity check |
| `backend/scripts/diagnose-preflight.ts` | Payroll preflight diagnostic |
| `backend/scripts/e2e-uat-setup.ts` | UAT environment seed |
| `backend/scripts/e2e-uat-fix.ts` | UAT payroll run cleanup + approver user |
| `frontend/e2e/golden-thread.spec.ts` | Authenticated route smoke |
| `frontend/e2e/helpers/auth.ts` | E2E login helper |
| `frontend/e2e/helpers/offer-response-routes.ts` | Offer API route stubs |
| `scripts/quick-verify.ps1` | Quick API verify |
| `scripts/e2e-smoke-test.ps1` | API smoke tests |
| `scripts/golden-thread.ps1` | API golden-thread runner |
| `office-finance-payroll-fixes-manager-summary.md` | Manager summary |
| `office-finance-payroll-ui-page-fixes.md` | This developer changelog |
