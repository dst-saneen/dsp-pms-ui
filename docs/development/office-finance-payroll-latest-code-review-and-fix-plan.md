# Office Finance Lite and Payroll Lite Latest Code Review and Remediation Plan

**Review baseline:** repository `HEAD 5b90451` / implementation commit `f821751`  
**Review date:** 2026-08-21  
**Current decision:** **NO-GO — keep Office Finance Lite and Payroll Lite disabled for every Company and Branch**  
**Scope:** shared Prisma/configuration integration, Office Finance Lite, Payroll Lite, secure files, notifications, APIs, UI, database hardening, migration rehearsal and production acceptance.  
**Out of scope:** Project Lite remediation remains in progress under `docs/development/project-lite-latest-code-review-and-fix-plan.md`.

This document explains how to close the latest Office Finance and Payroll findings. It supplements these authoritative product plans without changing their bounded business flows:

- `docs/development/office-finance-lite-db-api-ui-implementation-plan.md`
- `docs/development/payroll-lite-db-api-ui-implementation-plan.md`

The existing Office Finance and Payroll migrations are recorded as applied on the shared development database. Do not edit those migration files. All database corrections in this document must use a new additive migration and must be rehearsed on disposable PostgreSQL databases before shared development, UAT or production deployment.

No duration estimates are part of this plan.

## 2026-09-01 implementation completion update

**Development status:** the reopened Office Finance Lite/Expense and Payroll Lite P0/P1 implementation findings and required P2 UI work are closed in the working tree. The ordered migration chain is applied and verified on shared `dsp_erp_dev/dsp_pms`. **Production status remains NO-GO** until authenticated real API/browser personas, provider-backed file verification, manual UAT, and business/operations sign-off are complete. Both feature flags remain off and require explicit Company allowlists.

### Office Finance implemented result

- `finance.transactions.reverse` is present in the permission catalog and mapped to Organization Owner, Company Administrator, and Finance Manager.
- Transaction create, update, submit, approve, return, cancel, reverse, and Payroll expense paths share transaction-aware shape, account-opening-date, Company, Branch, Department, Project, Employee, Party, currency, and period validation.
- `FinanceTransaction.branchId` is derived server-side. Same-Branch classification produces that Branch; an allowed cross-Branch transfer produces `null`; incompatible mixed Branch references are rejected.
- Draft and lifecycle mutations use status/version compare-and-set updates. Period lock/reopen and transaction validation lock/revalidate the required rows to close edit/submit/approve/period races.
- Submitted, approved, returned, cancelled, reversed, period-locked, and period-reopened lifecycle events use Delivery V2. Recipient resolution ignores payload recipients and reloads exact active Company/Branch Employee/User and scoped RoleAssignment data.
- Delivery payloads are redacted and recipient dedupe is specific to the destination User.
- Draft UI editing now includes category, source/destination account, Department, Project, Business Party, Employee, amount, date, and description.

### Payroll implemented result

- Payroll fails closed unless Payroll and Office Finance share an enabled Company, workforce jobs are enabled, File Storage covers eligible Employee Branches, and the Finance profile, valid Payroll expense category, base-currency payment account, and open period exist.
- Payroll guards cover Payroll routes, salary surfaces, and `/me/payslips`; UI capability gates use server state and blocked reasons.
- Adjustment create/update/remove and run lifecycle paths use run-status/version compare-and-set behavior.
- Generated-file intent is created before upload; failed later steps preserve or move the intent through recoverable/compensation states. Reconciliation handles stale pending/uploaded/delete-pending intent rows and successful orphan deletion records `COMPENSATED` rather than a false dead letter.
- Operator recovery APIs list pending, active, stale, failed, and dead-lettered Payslip generation and retry a non-active failure with expected version, operation ID, and mandatory reason.
- The Payroll operations UI renders the server-provided state and retry action. `payroll.payslip.available` uses Delivery V2 and resolves only the exact active Employee User for the Company/Branch.

### Database and migration evidence

- New additive migration: `backend/prisma/migrations/20260901120000_office_finance_payroll_production_hardening/migration.sql`. No previously applied migration was edited.
- Required predecessors are `20260901100000_hr_operations_hardening` and `20260901110000_project_lite_production_hardening`; Finance/Payroll follows both in normal Prisma order.
- Disposable PostgreSQL 17 from-zero rehearsal applied all **145 migrations** successfully.
- Production-like upgrade rehearsal applied the first **143 migrations**, loaded synthetic legacy Project/Finance/Payroll/file-intent rows, and then applied both ERP Lite corrective migrations successfully.
- The upgrade backfilled the legacy Finance transaction Branch from its same-Branch account and preserved Payroll/File Intent rows. The daily Work Log aggregate reconciled to `8.00`.
- Catalog verification inspected actual definitions, not names alone, for Finance Branch/date/status indexes, Payslip operations/lease indexes, generated-file reconciliation indexes, Company-qualified Project constraints, immutable-history triggers, and Finance scope/opening-date triggers.
- Permission verification returned exactly **1** reverse permission and **3** required system-role mappings.
- Negative trigger evidence rejected Finance activity before an account opening date and preserved the original transaction date. Project history and daily-hour guard checks also rejected prohibited changes on the same upgraded database.
- Office Finance/Payroll preflight returned all **20 finding categories at count 0** and `blocking=0`.
- Custom-format backup/restore succeeded; the restored database contained all 145 migration receipts and the reconciled fixtures.
- On 2026-09-01, shared `dsp_erp_dev/dsp_pms` successfully applied `20260901100000_hr_operations_hardening`, `20260901110000_project_lite_production_hardening`, and `20260901120000_office_finance_payroll_production_hardening` in Prisma order. `prisma migrate status` reports all 145 migrations up to date.
- Shared Office Finance/Payroll preflight again returned all 20 finding categories at count `0` and `blocking=0`. Catalog verification read the actual Finance scope trigger, queue indexes, migration receipts, reverse permission, and all three required reverse-permission role mappings with no missing objects.

### Verification evidence

- Runtime baseline: Node `v24.20.0`.
- Prisma validate/generate, backend TypeScript 6/7 build and test configurations, backend full lint, and backend production build: passed.
- Backend full Jest: **157 suites passed, 3 skipped; 855 tests passed, 11 skipped**. Skipped opt-in suites are not counted as runtime evidence.
- Frontend TypeScript 6/7, full lint, production build, and Vitest (**26 files / 52 tests**) passed.
- Real PostgreSQL Finance/Payroll suite, with mock mode absent: **1 suite / 10 tests passed**. It covered:
  - one active Payroll run per Company/month and run CAS;
  - Finance Draft edit versus submit CAS;
  - Finance period lock/reopen CAS;
  - Finance approve/reverse lifecycle CAS in a rolled-back real history transaction;
  - locked-period, opening-date, and opening-balance backstops;
  - Payroll calculate/approve/cancel/mark-paid CAS in a rolled-back real history transaction;
  - adjustment mutation versus run-state change;
  - duplicate Payroll Finance-expense fencing;
  - one Payslip per run Employee plus duplicate-worker lease claim and expired-lease reclaim;
  - durable upload intent with database file-row rollback.
- The suite verified zero remaining Finance/Payroll test Companies after cleanup.

### Evidence intentionally not claimed

- Full PDF generation, S3 upload/download, malware scan, real S3 delete, and the provider-backed `COMPENSATED` path were not run because this isolated test environment had no approved object-storage provider configuration.
- Authenticated real API and Playwright Finance/Payroll personas were not run against the shared environment; no shared credentials or mutations were used.
- Rolled-back approved/reversed/paid lifecycle tests are real PostgreSQL trigger/CAS evidence, but not durable UAT records; rollback was required because those historical records correctly reject cleanup deletion.

### Remaining external release gates

1. Configure a private object-storage test scope and exercise real Payslip generation, clean-file finalization, download, orphan deletion, reconciliation, retry, and dead-letter recovery.
2. Run authenticated maker, approver, Payroll operator, Employee, outsider, cross-Company, and cross-Branch API/Playwright personas with mock mode disabled.
3. Complete the separate manual Finance/Expense and Payroll E2E/UAT phase plus security, Finance, Payroll, operations, backup/restore, and business sign-off.
4. Enable only explicitly approved Company allowlists after every preceding gate passes.

---

## 1. Intended flows to preserve

### 1.1 Office Finance Lite

1. Finance Setup configures the Company base currency, Business Parties, categories, payment accounts and monthly periods.
2. An authorized maker records a Draft income, expense or transfer.
3. The maker submits the transaction.
4. A different authorized approver approves or rejects it.
5. Approved movements affect operational cash/bank balances and reports.
6. An approved transaction is immutable; correction uses one explicit audited reversal.
7. Approved transactions may link only `CLEAN`, Company-safe File Objects.
8. Reports show operational income, expense, balance and cash flow. They do not claim double-entry accounting or statutory financial statements.

### 1.2 Payroll Lite

1. HR/Payroll configures salary components, salary revisions, tax profiles and recurring deductions.
2. Workforce attendance periods are closed or payroll-ready for the requested payroll month.
3. Payroll preflight reports blockers and warnings using current Company-scoped source data.
4. An authorized maker creates a Draft run and adjustments.
5. Calculate locks and snapshots the eligible Employees, Attendance Periods, salary, tax, deductions and adjustments.
6. A different authorized approver approves the immutable calculated run.
7. Mark Paid records the manual payment account/reference and creates one aggregate approved Office Finance expense.
8. A durable worker generates one private payslip per included Employee from immutable snapshot rows.
9. The Employee lists and downloads only their own available payslips through short-lived grants.

Payroll Lite does not initiate a bank transfer, generate statutory filings or perform full final settlement.

---

## 2. Current verified baseline

### 2.1 Implemented foundation

Office Finance currently includes:

- `CompanyFinancialProfile` and `BusinessParty` shared foundation.
- Finance categories, payment accounts, periods, transactions, attachments, action events and command receipts.
- Income, expense, transfer, approval, rejection, cancellation and reversal service paths.
- Dashboard, transaction list/detail, setup and reports UI routes.
- Company feature gate, allowlist checks, permissions and server-provided transaction `allowedActions`.

Payroll currently includes:

- Salary components, Employee salary revisions, tax profiles and deductions.
- Payroll runs, attendance links, Employee snapshots, line snapshots, adjustments, payslips, events and receipts.
- Calculate, return-to-draft, approve, mark-paid and cancel service paths.
- Aggregate Office Finance expense integration.
- Payslip generation outbox event, private File Object creation and self-service download grant.
- Payroll workspace, run detail, reports, Employee salary configuration and My Payslips UI.

### 2.2 Database status

The following migration groups are recorded as applied:

- `20260821120000_erp_lite_shared_foundation`
- `20260821130000_office_finance_lite_expand`
- `20260821131000_office_finance_lite_reconcile`
- `20260821132000_office_finance_lite_contract`
- `20260821140000_payroll_lite_expand`
- `20260821141000_payroll_lite_reconcile`
- `20260821142000_payroll_lite_contract`
- `20260821150000_erp_lite_contract_hardening`

The Payroll expand migration history includes one rolled-back failed attempt followed by a successful application. Preserve that migration history; do not resolve or rewrite it.

All new Office Finance and Payroll tables contained zero rows during the review. This proves migration installation only. It does not prove calculations, approval, reversal, concurrency, payslip generation, upgrade reconciliation or business acceptance.

### 2.3 Current failed gates

- Prisma validation fails because `Project.businessPartyId` is declared twice.
- Backend TypeScript fails because Prisma Client cannot regenerate and Project environment fields are duplicated.
- Focused backend Finance/Payroll lint is not green.
- The Finance capability test fails because the generated Prisma client is stale/unavailable.
- Two small Payroll unit suites pass, but they are not real PostgreSQL or workflow evidence.
- Frontend TypeScript is not green because of existing Delivery/Recruitment errors.
- No Office Finance or Payroll frontend unit tests exist.
- No Office Finance or Payroll Playwright persona tests exist.
- No production-like migration rehearsal, real API suite or real PostgreSQL concurrency suite exists.
- The local environment does not enable either module and `.env.example` does not document their full configuration contract.

---

## 3. Finding register

| ID | Priority | Area | Finding | Release effect |
|---|---|---|---|---|
| SHARED-P0-01 | P0 | Prisma | `Project.businessPartyId` is declared twice | Prisma validation/generation and backend build fail |
| SHARED-P0-02 | P0 | Configuration | Project feature keys are duplicated with conflicting types/assignments | Backend compilation and module capability typing fail |
| FIN-P0-01 | P0 | Reversal | Reversal row uses the same creator and approver and is rejected by the applied DB trigger | Every Finance reversal fails |
| FIN-P0-02 | P0 | Security | Bank reference is Base64-encoded, not encrypted | Sensitive bank data is reversibly stored |
| PAY-P0-01 | P0 | Calculation | Preflight/salary/tax/deduction reads escape the calculation transaction | Concurrent source changes can produce inconsistent payroll |
| FIN-P1-01 | P1 | Validation | Update/submit/approve do not revalidate the complete transaction shape | Invalid Drafts can be approved |
| FIN-P1-02 | P1 | DB history | Approved/reversed immutability trigger permits evidence-field drift | Financial history can be changed after approval |
| FIN-P1-03 | P1 | Concurrency | Opening-balance check races with the first approved movement | Balance can be based on an invalid opening value |
| FIN-P1-04 | P1 | Idempotency | Finance receipts reuse Asset HMAC keys and later persist the full response | Key-domain coupling and sensitive replay risk |
| FIN-P1-05 | P1 | Export | CSV cells are not protected from spreadsheet formula execution | Export can execute untrusted formulas |
| PAY-P1-01 | P1 | Concurrency | Payroll approval and other transitions do not consistently use status/version CAS | Duplicate or stale decisions are possible |
| PAY-P1-02 | P1 | DB scope | Several Payroll relations use bare IDs instead of Company-qualified aggregate keys | Direct SQL or bugs can create cross-Company snapshots |
| PAY-P1-03 | P1 | DB history | Approved/paid runs and calculated snapshot rows lack complete immutable-update guards | Payroll evidence can drift after calculation/approval |
| PAY-P1-04 | P1 | Period identity | Full run-period unique constraint conflicts with replace-after-cancel behavior | Cancelled periods can fail with raw uniqueness errors |
| PAY-P1-05 | P1 | Preflight | Overlap SQL casts text IDs to UUID and suppresses database errors | Preflight can falsely report no overlap |
| PAY-P1-06 | P1 | Payslip worker | A stale `GENERATING` row is treated as successfully handled | Payslip can remain permanently unavailable |
| PAY-P1-07 | P1 | File storage | Object upload precedes DB finalization without durable compensation | Failed transactions can leave orphan objects |
| PAY-P1-08 | P1 | Idempotency | Payroll receipts reuse Asset HMAC keys and persist full responses | Key-domain coupling and sensitive replay risk |
| PAY-P1-09 | P1 | Export | Payroll register CSV lacks formula-injection protection | Employee-controlled values can execute formulas |
| UI-P2-01 | P2 | Capabilities | Some Create/Setup actions are inferred from local permissions | UI can advertise actions unavailable in the active Company scope |
| UI-P2-02 | P2 | Verification | No focused component or browser persona coverage exists | Core journeys are not release-proven |

---

## 4. Remediation rules

The implementation must follow these rules:

1. Preserve the implemented feature gates, Company allowlists, permission checks and `allowedActions` responses.
2. Preserve unrelated user changes and the separately in-progress Project Lite work.
3. Do not edit already-applied migration files.
4. Add a new migration after `20260821150000_erp_lite_contract_hardening`, using a unique timestamped directory such as `20260821160000_office_finance_payroll_release_hardening`.
5. Use expand -> preflight/backfill -> contract within that migration series if bank-reference remediation or legacy data requires an application-level backfill.
6. Never convert an ambiguous or invalid historical row silently. Report it and stop the contract gate.
7. Every direct-ID lookup must apply Company scope before returning a record; foreign IDs use the same safe `404` as missing records.
8. Every mutation must use an operation ID, expected version where applicable, actor-bound receipt replay, audit/action evidence and outbox writes in the same business transaction.
9. Do not enable either module until both modules pass the shared source/build gate and their own runtime acceptance gates.

---

## 5. Gate 0 — restore a coherent source baseline

### 5.1 Remove the duplicate Prisma field

In `backend/prisma/schema.prisma`:

- Keep the first `Project.businessPartyId` declaration and its Company-qualified `BusinessParty` relation.
- Remove the later duplicate scalar declaration only.
- Retain one intended `(companyId, businessPartyId)` index.
- Verify the `BusinessParty.projects` inverse relation remains singular and named consistently.
- Do not create a migration for this duplicate removal because the database column already comes from the shared foundation/Project integration migration. This is schema-source repair, not a new DB change.

Acceptance:

- `prisma format` produces no semantic diff outside the affected relation.
- `prisma validate` passes.
- `prisma generate` passes.
- Generated Prisma Client exposes all Office Finance and Payroll enums, models and delegates.

### 5.2 Remove duplicate Project environment keys without changing Project behavior

In `backend/src/config/environment.ts`:

- Keep exactly one `PROJECTS_LITE_ENABLED: boolean` field.
- Keep exactly one `PROJECTS_LITE_COMPANY_IDS: ErpLiteCompanyAllowlist` field.
- Remove the earlier legacy `string` declaration and duplicate return-object assignment.
- Parse the Project, Office Finance and Payroll allowlists through the shared `erp-lite-env.ts` parser exactly once.
- Keep empty/missing allowlists fail-closed.
- Re-run `ModuleCapabilitiesService` TypeScript tests to prove the allowlist type is consistent.

### 5.3 Document required configuration

Add to `backend/.env.example`, without real secrets:

```dotenv
OFFICE_FINANCE_LITE_ENABLED=false
OFFICE_FINANCE_LITE_COMPANY_IDS=
PAYROLL_LITE_ENABLED=false
PAYROLL_LITE_COMPANY_IDS=

FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION=v1
FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON={"v1":"<32-byte-hex-or-base64>"}
PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION=v1
PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON={"v1":"<32-byte-hex-or-base64>"}

FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION=v1
FINANCE_BANK_REFERENCE_ENC_KEYS_JSON={"v1":"<32-byte-hex-or-base64>"}
```

Startup must fail closed when a module is enabled but its active and retained key configuration is invalid or missing.

### 5.4 Gate 0 exit

Do not begin business-flow verification until all are green:

- Prisma validate and generate.
- Backend TypeScript.
- Backend lint without auto-fixing unrelated files.
- Backend build.
- Frontend TypeScript, lint and build.

Delivery/Recruitment failures affecting the whole application must also be resolved or explicitly included in the release branch before claiming the shared build gate.

---

## 6. Office Finance remediation

### 6.1 FIN-P0-01 — make reversal executable without weakening normal maker-checker

Use a dedicated reversal authorization contract:

- Normal Draft/Submitted transactions still require `createdByUserId != approvedByUserId`.
- A reversal is not a second normal approval. It is a permission-controlled corrective command requiring `finance.transactions.reverse`, an expected version and mandatory reason.
- The reversal row uses `sourceType=REVERSAL`, references exactly one original, stores the reversal actor in the dedicated reversal evidence fields, and is created atomically with the original `APPROVED -> REVERSED` transition.
- The database may exempt only a structurally valid `REVERSAL` row from the normal maker-checker trigger. It must not exempt Payroll, manual income, manual expense or transfer rows.

In the new additive migration:

1. Replace the self-approval trigger function so it permits direct terminal creation only when all are true:
   - `sourceType='REVERSAL'`;
   - `reversalOfTransactionId` is not null;
   - `reversedByUserId` and `reversedAt` are present;
   - mandatory reversal reason is present;
   - linked original belongs to the same Company and is currently `APPROVED`;
   - the original does not already have a reversal.
2. Add or replace the reversal validation trigger to verify the reversal copies the original amount, tax, currency, transaction type, accounts and classification snapshots exactly.
3. Verify the balance projector applies the opposite sign because `sourceType=REVERSAL`; do not negate the persisted positive amount.
4. Retain the unique one-reversal-per-original constraint.

In `OfficeFinanceTransactionsService.reverse()`:

- Lock the original and relevant payment accounts.
- Recheck permission, period, status, version and existing reversal after locking.
- Insert the valid reversal row.
- CAS-update the original from the expected version/status.
- Write both protected action events, redacted audit entries and outbox rows in the same transaction.
- Return the refreshed original and reversal projections.

Tests must cover maker/approver/reverser combinations, two concurrent reversals, retry replay, locked period and the exact net-zero report/balance effect.

### 6.2 FIN-P0-02 — replace Base64 with authenticated encryption

Use AES-256-GCM or the repository's approved authenticated-encryption abstraction. Do not reuse filename, invitation-token or Asset key domains.

Add fields to `FinancePaymentAccount`:

- `bankReferenceEncrypted`
- `bankReferenceEncNonce`
- `bankReferenceEncTag`
- `bankReferenceEncKeyVersion`
- `bankReferenceEncFormatVersion`
- `bankReferenceLast4`

Rules:

- Normalize the bank reference once before encryption and last-four derivation.
- Encrypt with the active Finance bank-reference key.
- Bind Company ID and payment-account ID as authenticated additional data.
- Never log, audit, outbox, receipt-snapshot or return plaintext/ciphertext/nonce/tag.
- Normal API responses return only bank name and last four.
- Update is performed through a dedicated protected DTO field; omitted means unchanged and explicit clear removes the complete envelope.
- Mixed-key rows decrypt using their stored version. New writes use the active version.

Migration/backfill:

1. Add the envelope fields as nullable.
2. Preflight all rows where the current encrypted column is non-null.
3. Decode the legacy Base64 value only inside an audited, memory-bounded backfill command and immediately encrypt it with the active Finance key.
4. Record only row IDs and safe success/failure codes; never output the decoded reference.
5. Verify every non-null reference has ciphertext, nonce, tag, key version, format version and last four.
6. Add a named all-null-or-all-present check constraint.
7. Fail contract deployment if any legacy Base64-only row remains.

The current development tables are empty, but the backfill must still be safe for a production-like upgrade copy.

### 6.3 FIN-P1-01 — centralize complete transaction validation

Create one transaction-aware validator used by create, update, submit, approve, reversal and Payroll-source creation.

It must validate the fully merged persisted shape, not the partial PATCH DTO:

- Company base currency exists and matches the transaction snapshot.
- Date belongs to an `OPEN` Company period.
- Amount is positive; tax is non-negative and does not exceed the allowed rule.
- Category is active, same Company and matches `INCOME` or `EXPENSE` as applicable.
- Payment accounts are active, same Company and use the Company base currency.
- Income has the required destination account and no invalid source account.
- Expense has the required source account and no invalid destination account.
- Transfer has two different active accounts and no category/party/Employee shape that is forbidden for transfers.
- Business Party, Employee, Department and Project are active/safe and same Company when present.
- Payroll source is `EXPENSE`, uses the configured payroll category and cannot be submitted through manual endpoints.

Update must first load the scoped current row, merge every allowed field, validate the merged object and then perform a status/version CAS update. Submit and approve must repeat validation inside their transaction after locking.

### 6.4 FIN-P1-02 — make approved history strictly immutable

Replace the current permissive trigger through the new additive migration.

Allowed original-row mutation:

- Exactly one `APPROVED -> REVERSED` transition.
- Only `status`, reversal link, reversal actor/time/reason, `version` and `updatedAt` may change.
- Every other scalar and relation field must remain identical.

Rules:

- An already `REVERSED` row is fully immutable.
- An approved reversal row is fully immutable.
- Approved/reversed transaction attachments may not be silently replaced or deleted; correction requires append-only attachment evidence or an explicit protected unlink policy.
- Action events and command receipts remain append-only except for their documented claim-to-completed transition.

Catalog tests must inspect the trigger function body and enabled state, not only the object name.

### 6.5 FIN-P1-03 — serialize opening balance and first movement

Use one canonical account lock order: ascending payment-account ID.

- Opening-balance update locks the account before checking movements.
- Approval, reversal and Payroll-source expense creation lock every affected account in sorted order before validation or movement creation.
- Run these commands at serializable isolation with bounded retry for PostgreSQL `40001` and `40P01`.
- The DB trigger must acquire the same account-scoped advisory/row lock before checking movement existence, so direct SQL cannot race the application.
- Currency/opening-date changes follow the same rule.

Real concurrency tests must prove that exactly one side wins when opening-balance update races the first approval.

### 6.6 FIN-P1-04 — separate Finance idempotency keys and safe replay

- Add dedicated Finance idempotency HMAC configuration.
- Persist hash-key version and canonical-format version.
- Canonicalize after DTO transforms with stable sorted keys, normalized UUID/date/decimal/string forms, explicit null preservation and omitted-field omission.
- Hash the full canonical request without storing plaintext sensitive fields.
- Replays require the same Company, actor, command type and current authorization.
- Store only a safe result snapshot containing IDs, version and status. Do not store bank reference, transaction reference, description, notes, attachment metadata or `allowedActions`.
- Build the full response after commit using a fresh scoped query.
- Do not perform a failure-prone full-response receipt update after the business transaction commits.

### 6.7 FIN-P1-05 — protect CSV exports

Create one shared CSV-cell encoder used by Finance and Payroll:

- Normalize CR/LF handling.
- Escape quotes and delimiters.
- Prefix cells beginning with `=`, `+`, `-`, `@`, tab or carriage return so spreadsheet software treats them as text.
- Preserve numeric columns as server-generated numeric text, not untrusted labels.
- Emit UTF-8 CSV with a declared content type and safe filename.

Unit tests must cover formulas with leading whitespace, embedded quotes, commas and newlines.

### 6.8 Office Finance API/UI completion

Add a collection capability response, or extend the module capability response, with server-authoritative actions such as:

```ts
type FinanceCollectionAction =
  | "CREATE_TRANSACTION"
  | "MANAGE_SETUP"
  | "CREATE_PERIOD"
  | "EXPORT_REPORT";
```

UI requirements:

- Render New Transaction and setup creation controls only from server capabilities, not only local permission strings.
- Continue rendering transaction state commands only from each transaction's `allowedActions`.
- Preserve entered reason/reference after `409` and refetch the resource before retry.
- Show protected bank reference as last four only.
- Show reversal linkage and action evidence without exposing private reason to unauthorized readers.
- Never optimistically approve or reverse.

---

## 7. Payroll remediation

### 7.1 PAY-P0-01 — keep all calculation reads inside one transaction

Refactor `PayrollPreflightService` methods to accept a `DbClient`/transaction client:

- `evaluate(tx, ...)`
- `findEffectiveSalary(tx, ...)`
- `findEffectiveTaxProfile(tx, ...)`
- `findActiveDeductions(tx, ...)`

The calculation command must not call the injected root `PrismaService` after its serializable transaction begins.

Canonical lock order:

1. Payroll command receipt.
2. Company financial profile, Payroll category and payment configuration when applicable.
3. Payroll run.
4. Attendance Periods sorted by Branch/ID.
5. Eligible Employees sorted by ID.
6. Salary revisions and component lines.
7. Tax profiles and recurring deductions.
8. Run adjustments.
9. Run attendance links, Employee snapshots and line snapshots.
10. Action events, audit and outbox.

Inside the transaction:

- Lock and revalidate the run status/version.
- Lock Attendance Period versions/statuses.
- Lock the effective salary/tax/deduction inputs selected for each Employee.
- Clear replaceable Draft calculation snapshots only after all blockers pass.
- Create every snapshot from the locked source data.
- CAS-update the run totals/status/version.
- Write protected evidence and the safe receipt result atomically.

Use bounded retry for `40001` and `40P01`; replay through the command receipt after an uncertain client retry.

### 7.2 PAY-P1-01 — version every run transition

For calculate, return-to-draft, approve, mark-paid and cancel:

- Lock the scoped run.
- Validate `expectedVersion` and expected current status.
- Use `updateMany` with `id + companyId + version + status`.
- Require `count=1`; otherwise return stable `PAYROLL_RUN_STATE_CHANGED`.
- Do not use a plain `update({where:{id}})` for state changes.
- Lock and validate dependent snapshot/Finance rows before the update.

Approve must also lock all run Employee/line/attendance snapshots and re-sum totals before maker-checker evaluation.

### 7.3 PAY-P1-02 — add Company-qualified DB backstops

Add supporting unique keys and composite foreign keys in the new additive migration and Prisma schema:

- `EmployeeSalary(companyId, employeeId)` -> `Employee(companyId, id)`.
- `EmployeeSalaryLine` must carry `companyId` and reference both salary revision and component through Company-qualified keys.
- `EmployeeTaxProfile(companyId, employeeId)` -> Employee.
- `EmployeeDeduction(companyId, employeeId)` -> Employee.
- `PayrollRunEmployee(companyId, branchId)` -> Branch.
- `PayrollRunEmployee(companyId, employeeSalaryId, employeeId)` -> the selected same-Employee salary revision.
- `PayrollRunEmployeeLine` source references must be Company-qualified.
- `PayrollPayslip(companyId, payrollRunEmployeeId, employeeId)` -> the matching Payroll Employee snapshot.
- `PayrollPayslip(companyId, fileObjectId)` remains Company-qualified.

Use `onDelete: Restrict, onUpdate: Restrict` for historical source and snapshot references. Add preflight reports for null/cross-Company/cross-Employee relations before setting new fields `NOT NULL`.

### 7.4 PAY-P1-03 — make calculated snapshots immutable

Add DB trigger backstops:

- A `CALCULATED`, `APPROVED`, `PAID` or `LEGACY_IMPORTED` run cannot have totals, period, currency, maker/approver/payment evidence or source links edited outside its documented transition.
- Run Employee, line and Attendance Period snapshot rows cannot be inserted, updated or deleted while the parent run is `CALCULATED`, `APPROVED`, `PAID` or `LEGACY_IMPORTED`.
- `APPROVED` and `PAID` runs are not deletable.
- Payslip source snapshots are immutable once created.

Return-to-draft must run atomically:

1. Lock run and snapshots.
2. CAS-transition `CALCULATED -> DRAFT` with mandatory reason/evidence.
3. Delete or invalidate the replaceable calculated snapshot set.
4. Release Attendance Period links in the same transaction.

No other path may clear calculation snapshots.

### 7.5 PAY-P1-04 — align run uniqueness with cancellation

Lock the business decision to the implemented flow: a cancelled run does not permanently consume the period.

- Remove Prisma's full `@@unique([companyId, payrollYear, payrollMonth])` contract.
- Add a normal schema index for lookup.
- In the additive SQL migration, drop the full unique constraint only after verifying its exact name/definition.
- Create a partial unique index for one non-cancelled run per Company/year/month.
- Map the named unique violation to `PAYROLL_PERIOD_EXISTS`.
- A retry of the same create operation returns its receipt result; a different operation receives the stable conflict.

If the business instead requires one historical run forever, keep the full unique constraint and change service/preflight behavior. Do not leave the current contradictory combination.

### 7.6 PAY-P1-05 — make overlap preflight fail closed

- Remove `::uuid` casts because the current identifier columns are text.
- Do not use `.catch(() => [])` on integrity/preflight queries.
- Execute overlap queries through the caller's transaction client.
- Translate DB errors to `PAYROLL_PREFLIGHT_FAILED` and stop calculation.
- Return exact blocker counts and representative safe IDs.
- Keep DB exclusion/range constraints as the direct-SQL backstop.

Tests must inject an invalid query/connection error and prove preflight does not return `canCalculate=true`.

### 7.7 PAY-P1-06 — make payslip generation recoverable

Add an explicit lease contract to `PayrollPayslip` or a dedicated generation job:

- `generationLeaseId`
- `generationLeaseExpiresAt`
- `generationAttemptCount`
- `lastAttemptAt`

Worker behavior:

1. Claim `PENDING`/`FAILED`, or reclaim `GENERATING` only when the lease expired.
2. Use a unique lease ID in every subsequent update.
3. Generate only from a `PAID` run and immutable Payroll Employee/line snapshots.
4. Finalize `AVAILABLE + fileObjectId` only when the lease still belongs to the worker.
5. On safe failure, transition to `FAILED`, persist only a safe code and schedule retry.
6. After the configured attempt limit, dead-letter and alert operations without reversing Payroll payment.
7. A worker observing another active lease returns without causing the outbox event to be marked permanently complete; the event remains/requeues until the lease owner finishes or expires.

Prove crash-after-claim, duplicate delivery, retry after file upload and dead-letter behavior.

### 7.8 PAY-P1-07 — add generated-file compensation

Generated file storage crosses PostgreSQL and object storage, so implement a durable intent/compensation flow:

1. Create a durable generated-file intent or File Operation Attempt before object upload.
2. Upload the encrypted private object using a non-public key.
3. In one DB transaction, finalize the File Object as `CLEAN`, link it to the Payslip and complete the generation lease.
4. If DB finalization fails, attempt immediate object deletion.
5. If deletion fails, persist a `DELETE`/`RECONCILE` operation with object key/correlation metadata that contains no employee or salary information.
6. A scheduled reconciliation job retries and dead-letters deletion safely.

Exactly one Payslip may link exactly one File Object. Repeated generation must return the existing available result, not create another object.

### 7.9 PAY-P1-08 — separate Payroll receipt keys and safe replay

Apply the same canonical request, actor-bound replay and safe snapshot rules as Finance, using dedicated Payroll HMAC configuration. Payroll receipt snapshots must exclude salary lines, adjustment reasons, payment references, Employee names and payslip metadata.

### 7.10 Payroll Finance seam validation

Before mark-paid creates the aggregate expense, verify inside the same transaction:

- Office Finance is enabled for the exact Company.
- Company Financial Profile exists.
- Payment account is active, same Company and base currency.
- Configured Payroll category is active and has type `EXPENSE`.
- Target Finance period is open.
- Payroll creator/calculator cannot approve the resulting financial movement in violation of the locked maker-checker policy.
- `(companyId, payrollRunId)` creates exactly one Payroll-source Finance transaction.

Payroll must store only the aggregate approved expense in Office Finance. It must not write Employee salary values or payslip data into Finance.

### 7.11 Payroll UI completion

Add a server collection capability response including actions such as:

```ts
type PayrollCollectionAction =
  | "CREATE_RUN"
  | "MANAGE_COMPONENTS"
  | "MANAGE_EMPLOYEE_INPUTS"
  | "EXPORT_REGISTER";
```

UI requirements:

- New Run, New Component and New Salary Revision use server capabilities.
- Run state buttons continue to use the run's `allowedActions` only.
- Show preflight blockers/warnings before calculation.
- Preserve reason/payment-reference input after `409` and refetch before retry.
- Do not show or store the payment reference after successful submission.
- My Payslips shows `PENDING`, `GENERATING`, `FAILED` and `AVAILABLE` accurately, with retry/help guidance for failed/dead-letter state.
- Download opens only a newly issued short-lived clean-file grant.

---

## 8. New migration and reconciliation contract

### 8.1 Migration structure

Use additive migrations after the applied hardening migration. If the bank-reference backfill cannot be safely completed inside one deployment, split it:

1. `..._office_finance_payroll_release_expand`
   - encryption envelope/lease/snapshot columns;
   - supporting unique keys and indexes;
   - initially nullable fields.
2. Application preflight/backfill
   - bank-reference re-encryption;
   - Company/snapshot relation reconciliation;
   - Payroll period duplicate report;
   - stale payslip generation report.
3. `..._office_finance_payroll_release_contract`
   - `NOT NULL` changes after verified backfill;
   - composite FKs;
   - partial uniqueness;
   - strict immutability/reversal/opening-balance triggers;
   - envelope and lease checks.

### 8.2 Required preflight findings

Office Finance:

- Base64-only bank references.
- Missing/incomplete encryption envelope.
- Invalid Company currency/account combinations.
- Submitted/approved invalid transaction shapes.
- Self-approved non-reversal transactions.
- Duplicate/orphan reversal links.
- More than one reversal per original.
- Approved/reversed rows missing actor/time evidence.
- Transactions in missing/overlapping/locked periods.
- Attachment/File Object Company mismatch.

Payroll:

- Duplicate non-cancelled Company/year/month runs.
- Unknown or missing run status snapshots.
- Cross-Company Employee/salary/component/tax/deduction references.
- Run Employee linked to another Employee's salary revision.
- Snapshot lines linked to another Company or run Employee.
- Calculated/approved/paid run total drift.
- Attendance Period version/status mismatch.
- Overlapping salary/tax ranges.
- Paid run missing/duplicating Finance transaction.
- Duplicate Payslip or File Object links.
- Stale `GENERATING` payslips.
- Available Payslip without a `CLEAN` private File Object.

Preflight must return exact counts. Truncation is allowed only for the representative ID sample and must not change the count.

### 8.3 Reconciliation policy

- The current shared development tables are empty, but rehearsal data must exercise every mapping path.
- Do not invent missing Business Parties, accounts, categories, approval actors or Employee salary relationships.
- Do not rewrite approved financial/payroll history silently.
- Ambiguous rows block contract deployment until resolved through an approved mapping/input file.
- Store safe reconciliation evidence and counts without sensitive bank, salary or payment values.

### 8.4 Catalog verification

Verify exact definitions, not only object names:

- columns, types, nullability and defaults;
- unique/index columns and partial predicates;
- FK column order, referenced columns and `Restrict` actions;
- check constraint expressions and validation state;
- trigger table, timing, event, enabled state and function definition;
- no duplicate schema fields or drift between Prisma and migrations.

---

## 9. API and error contract

Keep the existing route families. Do not expose a second parallel V2 API.

Every mutation DTO must include:

- `operationId`;
- relevant `expectedVersion`;
- mandatory reason where the state transition requires evidence.

Add or standardize stable errors:

### Office Finance

- `FINANCE_LITE_SCOPE_NOT_ENABLED`
- `FINANCE_TRANSACTION_NOT_FOUND`
- `FINANCE_TRANSACTION_STATE_CHANGED`
- `FINANCE_TRANSACTION_INVALID_SHAPE`
- `FINANCE_SELF_APPROVAL_FORBIDDEN`
- `FINANCE_REVERSAL_ALREADY_EXISTS`
- `FINANCE_REVERSAL_INVALID`
- `FINANCE_PERIOD_NOT_OPEN`
- `FINANCE_OPENING_BALANCE_LOCKED`
- `FINANCE_BANK_KEY_UNAVAILABLE`
- `FINANCE_OPERATION_ID_REUSED`

### Payroll

- `PAYROLL_LITE_SCOPE_NOT_ENABLED`
- `PAYROLL_RUN_NOT_FOUND`
- `PAYROLL_RUN_STATE_CHANGED`
- `PAYROLL_PERIOD_EXISTS`
- `PAYROLL_PREFLIGHT_FAILED`
- `PAYROLL_PREFLIGHT_BLOCKED`
- `PAYROLL_SOURCE_CHANGED`
- `PAYROLL_SELF_APPROVAL_FORBIDDEN`
- `PAYROLL_FINANCE_SETUP_REQUIRED`
- `PAYROLL_PAYSLIP_NOT_AVAILABLE`
- `PAYROLL_PAYSLIP_GENERATION_FAILED`
- `PAYROLL_OPERATION_ID_REUSED`

Map named PostgreSQL check, unique, FK and trigger errors to these safe codes. Do not return raw SQL, Prisma codes, Company names, Employee salary values or bank references.

---

## 10. Automated verification

### 10.1 Source gates

Run from `backend`:

```powershell
pnpm.cmd exec prisma format
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
pnpm.cmd exec tsc -p tsconfig.build.json --noEmit --incremental false
pnpm.cmd exec eslint src/modules/office-finance src/modules/payroll src/modules/module-capabilities src/config/erp-lite-env.ts src/config/environment.ts
pnpm.cmd run test:foundation
pnpm.cmd run build
```

Run from `frontend`:

```powershell
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd exec eslint features/office-finance features/payroll features/my-workspace/components/my-payslips-card.tsx hooks/use-module-capabilities.ts
pnpm.cmd exec vitest run features/office-finance features/payroll
pnpm.cmd run build
```

Finance and Payroll evidence is independently repeatable through the canonical
backend `test` gate plus `test:integration:finance-payroll` for real PostgreSQL
integration and concurrency coverage.

Do not use mocked Prisma clients as migration or concurrency evidence.

### 10.2 Backend unit/service tests

Office Finance:

- complete transaction-shape matrix;
- category/account/party/Employee/Department/Project scope;
- maker-checker;
- reversal projection and signs;
- strict approved-history immutability;
- receipt canonicalization/replay/redaction;
- CSV formula protection;
- `allowedActions` and collection capabilities.

Payroll:

- exact Decimal calculation and rounding;
- salary/tax/deduction effective-range selection;
- missing input blocker/warning rules;
- run state machine and `allowedActions`;
- maker-checker;
- Finance aggregate mapping;
- receipt canonicalization/redaction;
- payslip lease/retry behavior;
- CSV formula protection.

### 10.3 Frontend unit/component tests

- Module/collection capability-driven creation controls.
- Resource `allowedActions` rendering only.
- Finance type-specific transaction forms.
- Reversal/approval dialogs and `409` state refresh.
- Payroll preflight blocker/warning rendering.
- Calculate/approve/mark-paid action dialogs.
- My Payslips pending/generating/failed/available states.
- Error, loading, denied, empty, retry and keyboard/focus behavior.
- No sensitive bank reference or payment reference persists in browser storage or query cache after mutation.

---

## 11. Real PostgreSQL and migration rehearsal

Use disposable PostgreSQL databases with the same major version and required extensions as the target environment.

Required rehearsal:

1. From-zero apply of the complete migration chain.
2. Upgrade from a production-like copy containing legacy Finance/Payroll edge rows.
3. Preflight before expand/contract.
4. Application backfill/reconciliation.
5. Contract migration.
6. Exact catalog verification.
7. Backup/restore rollback rehearsal.
8. Re-run preflight and business reconciliation after restore.

Required Finance concurrency cases:

- two approvers using the same expected version;
- two reversal commands for one original;
- reversal retry with the same/different operation ID;
- opening-balance edit versus first approval;
- period lock versus submit/approve/reversal;
- transaction update versus submit;
- Payroll-source expense versus manual duplicate creation.

Required Payroll concurrency cases:

- two run creates for one period;
- calculate versus salary/tax/deduction edit;
- calculate versus Attendance Period reopen/change;
- two calculates using the same version;
- approve versus return-to-draft;
- two approvals using the same version;
- mark-paid retry/concurrency and exactly one Finance expense;
- payslip duplicate delivery, worker crash, expired lease and retry;
- exactly one Payslip/File Object per Payroll Employee.

Every test must assert committed DB state, not only HTTP status or mocked calls.

---

## 12. Real API and browser personas

Run with both mock modes disabled and both modules enabled only for a disposable pilot Company.

Office Finance personas:

1. Finance setup administrator.
2. Transaction maker.
3. Independent approver.
4. Finance report reader.
5. User without Finance permissions.
6. User from another Company/Branch.

Payroll personas:

1. Payroll configuration administrator.
2. Payroll maker/calculator.
3. Independent Payroll approver.
4. Payroll payment operator.
5. Employee downloading own payslip.
6. Another Employee attempting direct-ID access.
7. User from another Company/Branch.

End-to-end acceptance journey:

1. Configure Finance profile/category/account/period.
2. Configure salary components and an Employee salary revision.
3. Close/prepare Attendance Periods.
4. Run Payroll preflight and calculate.
5. Approve using a different actor.
6. Mark paid and create exactly one approved aggregate Finance expense.
7. Process durable payslip generation.
8. Employee downloads only their own private payslip through a short-lived grant.
9. Finance reports include the approved aggregate expense exactly once.
10. Reversal follows the explicit Finance policy without modifying Payroll snapshots.

Browser tests must verify unauthorized records are absent from network responses, not merely hidden in the DOM.

---

## 13. Monitoring and operational controls

Keep feature flags off by default:

- `OFFICE_FINANCE_LITE_ENABLED`
- `OFFICE_FINANCE_LITE_COMPANY_IDS`
- `PAYROLL_LITE_ENABLED`
- `PAYROLL_LITE_COMPANY_IDS`

Monitor:

- Finance/Payroll command version conflicts and operation-ID conflicts.
- Self-approval and invalid-shape rejections.
- Reversal failures and duplicate attempts.
- Period-lock/opening-balance conflicts.
- Payroll preflight blocker counts.
- Calculation serialization/deadlock retry counts.
- Payroll run/source reconciliation drift.
- Missing or duplicate Finance expense links.
- Payslip pending/generating age, retries and dead letters.
- File compensation/reconciliation backlog.
- Outbox retries/dead letters and notification delivery failures.
- Bank-key/idempotency-key configuration and retained-key availability, without logging keys.

Alerts and logs must contain safe IDs/status/error codes only.

---

## 14. Production acceptance gates

Office Finance Lite is acceptable only when:

- Prisma/backend/frontend validation, tests and builds are green.
- Bank references use verified authenticated encryption; no Base64-only row remains.
- Normal maker-checker and explicit reversal both pass real PostgreSQL tests.
- Approved/reversed rows are DB-immutable outside the exact reversal transition.
- Opening balance, periods and approval are concurrency-safe.
- Balances/reports reconcile to approved business samples.
- Real API and browser Finance personas pass.

Payroll Lite is acceptable only when:

- Every calculation input is selected and locked in the same transaction.
- Calculation, approval and mark-paid concurrency tests pass.
- Company-qualified DB integrity and snapshot immutability are verified in the catalog and runtime.
- Preflight fails closed on SQL/source errors.
- Exactly one Finance expense and one Payslip/File Object are produced per valid source aggregate.
- Payslip retry, dead-letter, compensation and private download behavior are proven.
- Payroll totals reconcile exactly to an approved sample.
- Real API and browser Payroll personas pass.

Shared production acceptance additionally requires:

- from-zero and production-like upgrade rehearsal;
- backup/restore rehearsal;
- real provider/storage/outbox evidence;
- monitoring and runbook validation;
- technical UAT and Finance/Payroll business sign-off;
- an approved Company/Branch pilot allowlist;
- a recorded rollback/cutover decision.

Passing unit tests or applying migrations is not sufficient production evidence.

---

## 15. Recommended implementation and commit grouping

1. **Shared source repair**
   - remove duplicate Prisma/environment declarations;
   - regenerate Prisma Client;
   - restore source gates;
   - document feature/key configuration.
2. **Office Finance security and correctness**
   - reversal contract;
   - bank-reference authenticated encryption;
   - complete shape validation;
   - strict immutable-history and opening-balance locking;
   - Finance receipt and CSV hardening.
3. **Payroll transactional and DB integrity**
   - transaction-aware preflight/calculation;
   - status/version CAS;
   - Company-qualified FKs;
   - snapshot immutability and period uniqueness;
   - overlap preflight correction.
4. **Payslip/storage resilience**
   - generation lease;
   - retry/dead-letter behavior;
   - generated-file intent/compensation;
   - Payroll receipt and CSV hardening.
5. **API/UI capabilities and tests**
   - collection capabilities;
   - component tests;
   - real API and Playwright personas.
6. **Migration rehearsal and evidence**
   - disposable DB from-zero/upgrade/catalog/concurrency/restore;
   - business reconciliation;
   - update this document with exact commands/results and remaining approvals.

Do not combine the migration rehearsal evidence with unrelated Project Lite changes. Keep each commit reviewable and preserve the ability to revert module enablement independently.

---

## 16. Completion record template

Update this section only with executed evidence:

| Gate | Command/environment | Result | Evidence reference |
|---|---|---|---|
| Prisma validate/generate | Not run after fixes | Pending | — |
| Backend TypeScript/lint/build | Not run after fixes | Pending | — |
| Frontend TypeScript/lint/build | Not run after fixes | Pending | — |
| Office Finance unit/service tests | Not run after fixes | Pending | — |
| Payroll unit/service tests | Not run after fixes | Pending | — |
| From-zero migration rehearsal | Not run | Pending | — |
| Production-like upgrade rehearsal | Not run | Pending | — |
| PostgreSQL concurrency | Not run | Pending | — |
| Real API personas | Not run | Pending | — |
| Non-mock Playwright personas | Not run | Pending | — |
| Finance reconciliation/sign-off | Not recorded | Pending | — |
| Payroll reconciliation/sign-off | Not recorded | Pending | — |
| Backup/restore | Not run | Pending | — |

Until every required gate is supported by command/runtime evidence, the authoritative status remains:

**Implementation foundation present; Office Finance Lite and Payroll Lite production readiness incomplete; NO-GO.**
