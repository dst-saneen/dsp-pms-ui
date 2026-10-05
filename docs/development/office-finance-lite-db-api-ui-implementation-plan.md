# Office Finance Lite DB, API and UI Implementation Plan

## 1. Purpose and release boundary

This document is the implementation contract for Office Finance Lite and the small shared ERP Lite financial foundation used by Project and Payroll.

The authoritative flow is:

`Business Party/Employee -> Draft income, expense or transfer -> Submit -> Independent approval -> Cash/bank movement -> Operational reports`

and:

`Paid Payroll -> One confidential approved aggregate expense`

This is Office Finance, not an accounting ledger. This document is a plan, not evidence that database, API, storage, reports, tests or UAT are complete.

### Locked product behavior

- Each Company has one base currency in Lite. Transactions cannot use another currency.
- Finance records cash-basis income, expenses and transfers only.
- Cash and bank balances are calculated from opening balance and approved/reversed movements; no editable running balance is stored.
- Every manual Finance transaction uses maker-checker approval.
- Approved records are immutable. Correction is an explicit one-time reversal with an opposite movement.
- Finance periods are Company-level calendar months and may be locked/reopened with evidence.
- Income/expense may be tagged to Branch, Department, Project, Business Party or Employee when valid.
- Paid Payroll creates one aggregate expense after Payroll maker-checker; employee salary detail never enters Finance.
- Receipts use Secure File Storage and only clean files may be linked/downloaded.
- Reports are operational cash summaries, not Profit & Loss, Balance Sheet, General Ledger, AR or AP.
- Journals, Chart of Accounts, invoicing, vendor bills, tax calculation, budgets, reconciliation, multi-currency and intercompany accounting are deferred.

## 2. Current baseline and module ownership

No Office Finance or Business Party module currently exists in Prisma, backend, frontend or navigation. `Company` has no base currency/financial profile. Projects store client name/contact strings, and Asset retains its own vendor-name snapshot.

Existing reusable foundations include Company/Branch/Department/Employee scope, RBAC, audit, outbox, notification delivery, decimal support, Number Series and Secure File Storage. They do not yet supply a Finance transaction contract.

### Ownership boundary for three developers

The Office Finance developer owns the shared schema to prevent Project, Payroll and Finance migrations from editing the same models:

- `CompanyFinancialProfile`.
- `BusinessParty`.
- Finance Manager role and Finance permissions.
- Shared authenticated module-capabilities response.
- Number Series values for Business Party and Finance transaction.

Project consumes Business Party and base currency. Payroll consumes base currency, Payroll expense category, payment account and an internal aggregate-expense command. Asset `vendorName` is not silently converted to Business Party.

Receipts remain disabled until Secure File Storage proves active-context authorization, filename-key separation, private encrypted storage, scanning and clean-only download grants in the target environment.

## 3. Database contract

### 3.1 Enums

```prisma
enum BusinessPartyType {
  CUSTOMER
  VENDOR
  BOTH
  OTHER
}

enum FinanceCategoryType {
  INCOME
  EXPENSE
}

enum FinanceAccountType {
  CASH
  BANK
}

enum FinanceTransactionType {
  INCOME
  EXPENSE
  TRANSFER
}

enum FinanceTransactionStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REVERSED
  CANCELLED
}

enum FinancePeriodStatus {
  OPEN
  LOCKED
}

enum FinanceSourceType {
  MANUAL
  PAYROLL_RUN
  REVERSAL
  LEGACY_IMPORT
}

enum FinanceActionEntityType {
  FINANCIAL_PROFILE
  BUSINESS_PARTY
  CATEGORY
  PAYMENT_ACCOUNT
  PERIOD
  TRANSACTION
  ATTACHMENT
}
```

### 3.2 Shared financial profile

Add `CompanyFinancialProfile`:

| Field | Contract |
|---|---|
| `companyId` | One row per Company; unique and Company-qualified. |
| `baseCurrencyCode` | Uppercase three-letter ISO-style code. |
| `reportingStartDate` | Earliest date accepted by Finance reports/transactions. |
| `payrollExpenseCategoryId` | Nullable until Payroll setup; must reference active same-Company Expense category. |
| `version` | Optimistic concurrency. |
| actor/timestamps | Creation/update evidence. |

Base currency is immutable after the Company has a payment account, approved/reversed movement or Payroll source. Changing currency requires a future controlled migration, not a normal PATCH.

To keep migration dependencies executable, `erp_lite_shared_foundation` first creates the profile with Company, currency, reporting date, version and actors. `office_finance_lite_expand` creates `FinanceCategory`, then adds `payrollExpenseCategoryId` and its Company-qualified foreign key.

### 3.3 Business Party

Add `BusinessParty`:

- `companyId`, generated `partyCode`, normalized name and display name.
- Type `CUSTOMER`, `VENDOR`, `BOTH` or `OTHER`.
- Optional contact person, email, phone and tax-registration reference.
- `version`, active/archive state and actor/timestamp/reason evidence.
- Unique `(companyId, partyCode)` and supporting unique `(companyId, id)`.
- Same-Company Project and Finance references use `Restrict`.
- Archive removes the Party from new lookups but preserves historical records.

Do not impose normalized-name uniqueness: legitimate Parties may share a name. Return duplicate-name warnings in the UI and rely on generated code for identity.

### 3.4 Categories and payment accounts

Add `FinanceCategory`:

- `companyId`, normalized code/name, `FinanceCategoryType`, description.
- `version`, active/archive state and actor evidence.
- Unique `(companyId, categoryCode)` and `(companyId, id)`.
- Category type cannot change after a transaction references it.
- Archived category remains readable but cannot be selected for a new transaction.

Add `FinancePaymentAccount`:

- `companyId` and optional `branchId`.
- Company-scoped code/name and type `CASH`/`BANK`.
- Immutable Company base-currency snapshot.
- `openingBalance Decimal(18,2)` and date-only `openingDate`.
- For Bank only: bank name, encrypted bank reference, encryption-key version and last four characters for display. Never store or return a full raw account number.
- `version`, active/archive state and lifecycle actors.
- Unique `(companyId, accountCode)` and `(companyId, id)`.

Rules:

- Bank-only fields are null for Cash accounts.
- Opening balance may be changed only before the first approved/reversed movement.
- Account currency cannot change.
- Account archive is blocked while it is required by an active Payroll setup; historical movements remain.
- No balance column is stored or patched.

### 3.5 Finance periods

Add `FinancePeriod`:

- `companyId`, `periodYear`, `periodMonth`, date-only start/end.
- `status OPEN|LOCKED`, version, lock/reopen actor/timestamps and mandatory reopen reason.
- Unique `(companyId, periodYear, periodMonth)`.
- Period dates must be the exact Company calendar month and cannot overlap.
- Periods before `reportingStartDate` cannot be created.

A transaction requires a configured `OPEN` period for its transaction date. A locked period rejects transaction creation/backdating into it, submit, approve and reversal. Lock is rejected while a submitted transaction is awaiting a decision. Reopen is a separate permission-controlled command with evidence.

### 3.6 Finance transactions

Add `FinanceTransaction`:

| Field group | Contract |
|---|---|
| Identity | `companyId`, optional derived `branchId`, transaction number, version. |
| Business | date-only transaction date, type, status, amount, informational tax amount, currency. |
| Classification | Category for Income/Expense; optional Department and Project. |
| Movement | Source/destination payment-account IDs. |
| Counterparty | Optional Business Party or Employee, never both. |
| Reference | Description, protected reference, source type/source ID. |
| Workflow | Creator, submitter, approver, returner, canceller, reverser actors/timestamps/reasons. |
| Reversal | Optional `reversalOfTransactionId`. |

All money uses `Decimal(18,2)` and is returned as strings.

Shape rules:

- Income: positive amount, one Income category, destination account only.
- Expense: positive amount, one Expense category, source account only.
- Transfer: positive amount, distinct source/destination accounts, no category/counterparty/Project/Department.
- `0 <= taxAmount <= amount`; tax is informational and included in amount, never added again.
- Party and Employee counterparties are mutually exclusive and same Company.
- Department determines Branch and must be compatible with any Branch-scoped account.
- A Branch-scoped Project must match the transaction Branch.
- For cross-Branch transfer within one Company, transaction `branchId` is null; for same-Branch accounts it is that Branch.
- Source/destination accounts are same Company and active at creation/approval.
- Transaction date cannot precede the opening date of either selected account.
- Unique `(companyId, transactionNumber)`.
- Unique non-null `(companyId, sourceType, sourceId)` for authoritative integrations such as Payroll.

Workflow evidence checks:

- `SUBMITTED` requires submitter/time.
- `APPROVED` requires approver/time and approver differs from creator.
- `CANCELLED` requires actor/time/reason.
- `REVERSED` requires actor/time/reason and one linked reversal row.
- Approved/reversed movements are immutable and cannot be hard-deleted.

### 3.7 Reversal representation and balance projection

Reversal is not a negative transaction entered by a user:

1. Lock the approved original, period and accounts.
2. Create one positive-amount approved `FinanceTransaction` with the same type, accounts, category and classification snapshots, `sourceType=REVERSAL`, and `reversalOfTransactionId=original.id`.
3. Mark the original `REVERSED` and link it to the inverse row.
4. A unique constraint permits only one reversal per original.

The movement projector uses transaction date and applies:

- Income: destination `+amount`.
- Expense: source `-amount`.
- Transfer: source `-amount`, destination `+amount`.
- A reversal row applies the exact inverse signs of its original.

Balance/report queries include normal originals in `APPROVED` or `REVERSED` plus approved reversal rows. Excluding the `REVERSED` original would make the net incorrect.

Current account balance:

`opening balance + every signed approved/reversed movement on or after opening date`

Income/expense reports exclude Transfers. Account-movement reports include Transfers. Negative calculated balances generate warnings but do not block approval in Lite.

### 3.8 Attachments, events and receipts

Add `FINANCE_RECEIPT` to `FileUploadPurpose` and `FINANCE_RECORD` to `FileRetentionClass`.

Add `FinanceTransactionAttachment`:

- `companyId`, `financeTransactionId`, `fileObjectId`, linked actor/time and optional title.
- Unique `(financeTransactionId, fileObjectId)`.
- Company-qualified `Restrict` relations.
- Only a same-Company `CLEAN` FileObject with Finance purpose can be linked/downloaded.

Add `FinanceActionEvent`:

- Append-only entity/action, from/to status, actor, reason, operation ID, version before/after, timestamp and reversal reference.
- Protected reasons/references remain outside normal AuditLog/outbox payloads.

Add `FinanceCommandReceipt`:

- Unique `(companyId, operationId)`.
- Command type, actor, canonical-request HMAC key/format versions, result ID, safe response snapshot and completion timestamp.
- Same request replays; changed payload or command returns `OPERATION_ID_REUSED`.
- Receipt snapshots exclude bank references, transaction references, notes and attachment metadata.

### 3.9 Database backstops and indexes

Use Company-qualified composite foreign keys and `Restrict` for Company, Branch, Department, Project, Party, Employee, accounts, categories, Files and historical actors.

Checks/triggers enforce:

- Transaction type/field shape and counterparty exclusivity.
- Branch/account/Department/Project compatibility.
- Maker-checker and terminal actor/date shapes.
- Period lock and approved/reversed immutability.
- Currency/profile consistency.
- Opening-balance immutability after movement.
- One reversal and one Payroll-source expense.
- No hard delete of financial history.

Indexes cover approval queue, Company/date/status, accounts, categories, Parties, Branch, Department, Project, source links, period locks, attachments and report groupings.

## 4. Feature gate, RBAC and API conventions

### 4.1 Feature and capability control

- `OFFICE_FINANCE_LITE_ENABLED=false` by default.
- `OFFICE_FINANCE_LITE_COMPANY_IDS` is the server-side Company allowlist.

Every request/job checks the resolved Company. Company Group context must select one Company. Add an authenticated `GET /me/module-capabilities` response containing `projectsLite`, `officeFinanceLite` and `payrollLite` for the active Company, already intersected with server gates; frontend navigation does not use public feature flags.

### 4.2 Permissions and role

- `finance.transactions.read`.
- `finance.transactions.manage`.
- `finance.transactions.approve`.
- `finance.reports.read`.
- `finance.settings.manage`.

Add `FINANCE_MANAGER` as a system role only after preflight proves its stable code/ID is unused or compatible. Map all Finance permissions plus Payroll read/approve. Organization Owner may hold all permissions, but maker-checker still applies.

Add explicit route-policy rules for `/office-finance` and `/business-parties`, with action-specific approval/settings permissions. Use exact Organization scope and record-level validation; do not reuse loose Company-or-Branch matching.

Project Managers do not receive broad Finance report permission. They consume the narrow Project Finance Summary endpoint authorized by Project scope.

### 4.3 Common wire contract

```ts
type ApiResponse<T> = { success: true; data: T };
type Page<T> = { items: T[]; total: number; page: number; limit: number };
```

Use `keyword`, `sortBy`, `sortOrder`, `page`, `limit` and explicit sort allowlists. CSV routes bypass the global JSON envelope and set safe content-disposition headers.

New-record commands accept `operationId`; update/transition commands accept `operationId` and `expectedVersion`. Company/Branch are derived from context/selected authoritative records, not accepted as free client ownership fields.

## 5. API contract

### 5.1 Settings and Parties

```text
GET   /office-finance/settings
PATCH /office-finance/settings

GET   /business-parties
POST  /business-parties
GET   /business-parties/:id
PATCH /business-parties/:id
POST  /business-parties/:id/archive
POST  /business-parties/:id/reactivate
```

Financial profile update:

```ts
{
  baseCurrencyCode: string;
  reportingStartDate: string;
  payrollExpenseCategoryId?: string | null;
  expectedVersion: number;
  operationId: string;
}
```

### 5.2 Categories, accounts and periods

```text
GET/POST       /office-finance/categories
GET/PATCH      /office-finance/categories/:id
POST           /office-finance/categories/:id/archive
POST           /office-finance/categories/:id/reactivate

GET/POST       /office-finance/payment-accounts
GET/PATCH      /office-finance/payment-accounts/:id
POST           /office-finance/payment-accounts/:id/archive
GET            /office-finance/payment-accounts/:id/balance

GET/POST       /office-finance/periods
POST           /office-finance/periods/:id/lock
POST           /office-finance/periods/:id/reopen
```

Sensitive Bank fields are accepted through dedicated protected DTO mapping and never returned except bank name and last four.

### 5.3 Transactions

```text
GET  /office-finance/transactions
POST /office-finance/transactions
GET  /office-finance/transactions/:id
PATCH /office-finance/transactions/:id
GET  /office-finance/transactions/:id/history

POST /office-finance/transactions/:id/submit
POST /office-finance/transactions/:id/approve
POST /office-finance/transactions/:id/return
POST /office-finance/transactions/:id/cancel
POST /office-finance/transactions/:id/reverse

POST /office-finance/transactions/:id/upload-sessions
POST /office-finance/transactions/:id/attachments
POST /office-finance/transactions/:id/attachments/:attachmentId/download-grant
```

Create transaction:

```ts
{
  transactionType: "INCOME" | "EXPENSE" | "TRANSFER";
  transactionDate: string;
  amount: string;
  taxAmount?: string;
  categoryId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  businessPartyId?: string;
  employeeId?: string;
  departmentId?: string;
  projectId?: string;
  description: string;
  reference?: string;
  operationId: string;
}
```

Transition command:

```ts
{
  expectedVersion: number;
  operationId: string;
  reason?: string;
}
```

Return, cancel, reverse and period reopen require a non-empty reason.

### 5.4 Dashboard and reports

```text
GET /office-finance/dashboard
GET /office-finance/reports/income-expense
GET /office-finance/reports/by-category
GET /office-finance/reports/by-department
GET /office-finance/reports/by-project
GET /office-finance/reports/account-movements
GET /office-finance/reports/export.csv
```

Filters: date range, Branch, Department, Project, Party, category, payment account and transaction status where applicable. Reports return server-calculated decimal strings and reconciliation metadata (`asOf`, included statuses and filters).

Project integration:

```text
GET /projects/:id/finance-summary
```

This narrow response contains totals only and is documented in the Project plan.

### 5.5 Allowed actions

```ts
type FinanceTransactionAction =
  | "EDIT"
  | "SUBMIT"
  | "APPROVE"
  | "RETURN"
  | "CANCEL"
  | "REVERSE"
  | "ATTACH_DOCUMENT";

interface FinanceTransactionProjection {
  id: string;
  version: number;
  transactionNumber: string;
  transactionType: FinanceTransactionType;
  status: FinanceTransactionStatus;
  transactionDate: string;
  amount: string;
  taxAmount: string;
  currencyCode: string;
  movement: { sourceAccountId: string | null; destinationAccountId: string | null };
  warnings: Array<{ code: string; message: string }>;
  reversalOfTransactionId: string | null;
  reversedByTransactionId: string | null;
  allowedActions: FinanceTransactionAction[];
}
```

### 5.6 Stable errors

- `OFFICE_FINANCE_SCOPE_NOT_ENABLED`
- `FINANCIAL_PROFILE_NOT_CONFIGURED`
- `FINANCE_RESOURCE_NOT_FOUND`
- `BUSINESS_PARTY_IN_USE`
- `FINANCE_CATEGORY_IN_USE`
- `PAYMENT_ACCOUNT_IN_USE`
- `FINANCE_PERIOD_LOCKED`
- `FINANCE_PERIOD_NOT_CONFIGURED`
- `FINANCE_PERIOD_STATE_CHANGED`
- `FINANCE_TRANSACTION_INVALID_SHAPE`
- `FINANCE_TRANSACTION_STATE_CHANGED`
- `FINANCE_SELF_APPROVAL_FORBIDDEN`
- `FINANCE_REVERSAL_EXISTS`
- `FINANCE_SOURCE_ALREADY_EXISTS`
- `FINANCE_OPENING_BALANCE_LOCKED`
- `FINANCE_ATTACHMENT_NOT_CLEAN`
- `OPERATION_ID_REUSED`

Foreign Company/Branch IDs return the same safe `404` as missing records.

## 6. Workflow, transactions and Payroll seam

### 6.1 Manual transaction workflow

```text
DRAFT -> SUBMITTED -> APPROVED
SUBMITTED -> DRAFT       (return with reason)
DRAFT/SUBMITTED -> CANCELLED
APPROVED -> REVERSED     (create approved inverse movement)
```

- Draft fields are editable only by a permitted maker.
- Submit revalidates account/category/counterparty/organization shape.
- Approve revalidates maker-checker, open period, account state and expected version.
- Return preserves history and makes the record editable again.
- Cancel never affects balances.
- Reverse is the only correction after approval.

### 6.2 Concurrency and lock order

Use serializable transactions for approve, reversal, opening-balance changes and Payroll-source creation, with bounded serialization/deadlock retry.

Canonical lock order:

1. Finance command receipt.
2. Company financial profile and Finance period.
3. Category/Party/Project/Department when applicable.
4. Payment accounts in ascending ID order.
5. Original Finance transaction, then reversal row.
6. FileObject when attaching.
7. Action evidence, audit and outbox.

State updates use `id + expectedVersion`; zero affected rows produce a stable `409`.

### 6.3 Payroll-generated expense

Expose an internal backend-only primitive:

```ts
createPayrollExpenseWithinTransaction(tx, {
  companyId,
  payrollRunId,
  payrollRunNumber,
  payrollPeriodStart,
  paidDate,
  aggregateNetAmount,
  paymentAccountId,
  payrollCreatorUserId,
  payrollApproverUserId,
  recordedByUserId,
  operationContext
})
```

It must:

- Be callable only from the Payroll module, not a public controller.
- Use the configured Payroll Expense category.
- Require Office Finance enabled for the Company, an open period and active same-Company account.
- Create one already-approved Expense with `sourceType=PAYROLL_RUN` and unique source ID.
- Record Payroll creator as source maker, distinct Payroll approver as approval actor and payment actor as recorder.
- Avoid nested transactions and a second public command receipt.
- Return the same transaction on idempotent replay.
- Store no Employee IDs, salary lines or payslip data.

## 7. UI implementation

Add Office Finance navigation only when server capability and permissions allow it:

- Dashboard.
- Transactions.
- Reports.
- Setup.

Routes:

- `/office-finance`.
- `/office-finance/transactions`.
- `/office-finance/transactions/[id]`.
- `/office-finance/reports`.
- `/office-finance/setup`.

Setup tabs:

- Financial Profile.
- Business Parties.
- Categories.
- Payment Accounts.
- Periods.

Transaction forms are type-specific so invalid fields are not shown. Detail displays immutable evidence, action timeline, attachments, reversal links, calculated movement and server warnings. All actions come from `allowedActions`; no local role/status inference or optimistic approval/reversal occurs.

Reports are labelled:

- Income and Expense Summary.
- Cash Movement.
- Account Balance.
- Category, Department and Project Summary.

Never display General Ledger, Profit & Loss, Balance Sheet, Accounts Receivable, Accounts Payable or formal Project Profitability terminology.

## 8. Notifications and secure files

Events:

- Finance transaction submitted, approved, returned, cancelled and reversed.
- Finance period locked/reopened.
- Payroll aggregate expense recorded/failure requiring operations attention.

Recipient resolution uses exact active RoleAssignment scope for Finance approvers/managers. Add/use `INTERNAL_USER` as the Delivery recipient kind for Finance, Project and Payroll rather than classifying generic users as HR. Payloads contain safe IDs, number, date and status only.

Receipt flow:

1. Request a transaction-bound Finance upload session.
2. Upload to quarantine and finalize through File Storage.
3. Wait for `CLEAN`.
4. Link the FileObject to the same-Company transaction.
5. Download through a short-lived authorized grant with access audit.

The feature remains off if active Company context, filename encryption, malware scanning, clean-only constraints or download authorization are not proven in real integration tests.

## 9. Migration and reconciliation

The Finance developer owns these new additive migrations after the latest applied migration:

1. `erp_lite_shared_foundation`: Company financial profile, Business Party, Number Series types, shared capability contract and system role/permissions.
2. `office_finance_lite_expand`: Finance enums/tables, nullable relations, File purposes/retention and supporting composite keys.
3. `office_finance_lite_reconcile`: preflight reports and explicit mapping/backfill.
4. `office_finance_lite_contract`: not-null/check/composite constraints, partial unique indexes, immutability/period triggers and final indexes.

Do not modify historical migrations.

Preflight/reconciliation reports:

- Company without valid base currency/reporting date.
- Role/permission code or deterministic-ID collision.
- Duplicate normalized Party/category/account codes.
- Invalid Company/Branch/Department/Project relationships.
- Account currency/opening-date conflicts.
- Period gaps/overlaps or invalid locked evidence.
- Invalid transaction type shapes, actors, states, amounts or source duplicates.
- Multiple reversals or orphan reversal links.
- Project legacy client strings requiring Business Party mapping.
- Unsafe/missing Finance FileObject links.

Preserve Project `clientName/clientContact` during compatibility. Backfill `businessPartyId` only from an operator-approved, unambiguous Company-scoped mapping; do not guess by name and do not silently import Asset vendor strings.

## 10. Tests and production acceptance

Required unit/service tests:

- Transaction shape and decimal parsing.
- Tenant/record scope and typed actions.
- Maker-checker and period rules.
- Balance/reversal projection.
- Report filter/aggregation semantics.
- Payroll confidentiality.
- Recipient scope and attachment authorization.

Required real PostgreSQL/concurrency tests:

- Cross-Company and cross-Branch IDs.
- Concurrent submit/approve/return/reverse.
- Self-approval denial.
- Approval racing period lock.
- One reversal per original.
- Correct Income, Expense, Transfer and reversed balances.
- Opening-balance edit racing first approval.
- One Payroll source expense under concurrent Mark Paid.
- Receipt replay versus conflicting reuse.
- Only clean same-Company receipt linking/download.
- Project summary confidentiality.
- Exact RoleAssignment recipient resolution.

Required non-mock browser personas:

1. Organization Owner configures Company currency/module capability.
2. Finance Manager creates Parties, categories, accounts and periods.
3. Finance maker creates/submits Income, Expense and Transfer records.
4. The same maker cannot approve.
5. A different Finance approver approves and sees correct balances.
6. An approved transaction is reversed exactly once.
7. Project Manager sees only narrow Project totals.
8. Payroll creates one aggregate expense without employee detail.
9. Another Company cannot list/open/mutate records or receipts.

Production acceptance requires from-zero and production-like migration rehearsal, constraint/trigger/index catalog verification, approved manual balance/report reconciliation, lint/type-check/build/test evidence, real API/browser evidence, Secure File/Delivery retry and dead-letter evidence, backup/restore rehearsal, monitoring and recorded technical/business sign-off.

## 11. Implementation order

1. Land shared financial profile, Business Party, capability, role and permission migrations with all feature gates off.
2. Implement scoped setup APIs and UI.
3. Add Finance transaction, period, receipt/event and command-receipt contracts.
4. Implement state commands, reversal projector, balances and reports.
5. Add secure receipt flow, notifications and operations monitoring.
6. Publish the internal Payroll expense primitive and narrow Project summary provider.
7. Rehearse migrations and run real database/API/browser/business acceptance.
8. Enable one Company only after opening balances, categories, account setup and approver separation are signed off.
