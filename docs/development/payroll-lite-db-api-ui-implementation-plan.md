# Payroll Lite DB, API and UI Implementation Plan

## 1. Purpose and release boundary

This document is the implementation contract for a production-safe monthly Payroll Lite module. It preserves the existing Employee, Workforce, salary, deduction and Payroll foundations, but replaces the prototype processing flow with scoped, versioned and auditable commands.

The intended flow is:

`Employee salary configuration + locked Workforce evidence -> Payroll preflight -> Draft adjustments -> Calculate -> Independent approval -> Mark paid -> Aggregate Office Finance expense -> Secure employee payslip`

This is a plan, not evidence that migrations, APIs, calculations, storage, tests or business UAT have passed.

### Locked product behavior

- Payroll is monthly and Company-specific.
- A Company uses the base currency configured by Office Finance Lite.
- Fixed salary components, effective manual tax, recurring deductions and reviewed manual adjustments are included.
- Attendance, Leave and Overtime are evidence and warning sources. Payroll Lite does not convert days, minutes or hours into money automatically.
- Joiner, leaver, unpaid Leave and Payroll-pending Overtime cases require reviewed adjustments when money must change.
- Payroll uses maker-checker approval. A run creator or calculator cannot approve that run.
- Marking a run paid records a manual payment reference; the application does not initiate a bank transfer.
- A paid run creates exactly one aggregate, confidential Office Finance expense. Finance never receives employee salary lines.
- Paid Payroll is immutable. Corrections are adjustments in a later run.
- Payslips are generated only for paid runs and stored through Secure File Storage. They are never attached to email.
- Final settlement, statutory formula engines, automatic proration, bank files and multi-currency Payroll are deferred.

## 2. Current baseline and dependencies

The repository already contains `SalaryComponent`, `EmployeeSalary`, `EmployeeSalaryLine`, `EmployeeTaxProfile`, `EmployeeDeduction`, `PayrollRun` and `PayrollRunEmployee`, plus controllers/services for salary components, employee salary, Payroll runs and a Payroll dashboard.

Those components are a prototype, not a production base:

- Services accept client-supplied `companyId`; list and direct-ID queries are not consistently tenant-scoped.
- Creating a run immediately calculates it outside one transaction and changes a string status to `PROCESSED`.
- Calculation ignores salary effective dates, employee lifecycle eligibility and fixed deduction components, and uses JavaScript `Number` for money.
- Tax and deduction lookups are not Company-qualified.
- Partial failure can leave a run with incomplete employee rows.
- Runs can be hard-deleted and have no version, approval evidence, command receipt, action history, Finance link or payslip.
- The Payroll dashboard can aggregate beyond the active Company.
- Navigation still marks Payroll as planned and there is no `/hr/payroll` page.
- Existing Payroll read/manage permissions are not backed by a Payroll route-policy rule or the complete approval/self-service permission set.

Dependencies:

- The shared `CompanyFinancialProfile`, payment accounts and Payroll expense category are owned by [Office Finance Lite](./office-finance-lite-db-api-ui-implementation-plan.md).
- Attendance Period, Overtime and Leave remain authoritative in Workforce.
- Payslips require the accepted Secure File Storage generated-object seam and Delivery V2 notifications.
- Payroll must remain disabled for a Company until those dependencies and Payroll setup preflight pass.

## 3. Database contract

### 3.1 Enums

```prisma
enum SalaryComponentType {
  EARNING
  DEDUCTION
}

enum PayrollRunStatus {
  DRAFT
  CALCULATED
  APPROVED
  PAID
  CANCELLED
  LEGACY_IMPORTED
}

enum PayrollAdjustmentDirection {
  EARNING
  DEDUCTION
}

enum PayrollLineSource {
  SALARY_COMPONENT
  TAX
  RECURRING_DEDUCTION
  MANUAL_ADJUSTMENT
  OVERTIME
  UNPAID_LEAVE
}

enum PayrollPayslipStatus {
  PENDING
  GENERATING
  AVAILABLE
  FAILED
}

enum PayrollActionEntityType {
  SALARY_COMPONENT
  SALARY_REVISION
  TAX_PROFILE
  RECURRING_DEDUCTION
  PAYROLL_RUN
  PAYROLL_ADJUSTMENT
  PAYSLIP
}
```

### 3.2 Existing tables to harden

#### `SalaryComponent`

Add or enforce:

- `version Int @default(0)`.
- Typed `componentType SalaryComponentType`.
- Normalized uppercase `componentCode` and unique `(companyId, componentCode)`.
- `archivedAt`, `archivedByUserId` and optional protected archive reason.
- `createdByUserId` and `updatedByUserId`.
- Company-qualified relation and `Restrict` actor/history references.
- A component used by a salary revision cannot be hard-deleted or change type. It can be renamed or archived with a versioned command.

#### `EmployeeSalary`

Treat this as an immutable salary revision:

- Add `version`, `createdByUserId`, `endedByUserId` and `endedAt`.
- Store `effectiveFrom` and `effectiveTo` as date-only values.
- Keep `companyId` and `employeeId` required and Company-qualified.
- Add a PostgreSQL exclusion constraint preventing overlapping effective ranges for the same `(companyId, employeeId)`; reuse the already-installed `btree_gist` extension.
- A revision referenced by a calculated, approved, paid or legacy-imported run is immutable.
- Creating a new revision atomically ends the current revision on the day before the new `effectiveFrom` when an active revision exists.

#### `EmployeeSalaryLine`

- Add unique `(employeeSalaryId, salaryComponentId)`.
- Require `amount >= 0` using `Decimal(18,2)`.
- Use Company-qualified composite foreign keys through the salary revision and component.
- Do not accept duplicate components or a component from another Company.

#### `EmployeeTaxProfile`

Payroll Lite treats tax as a manually maintained fixed monthly amount, not a statutory calculation:

- Add `version`, `effectiveFrom`, `effectiveTo`, lifecycle actors and archive metadata.
- Require `monthlyTaxAmount >= 0`.
- Prevent overlapping active ranges per `(companyId, employeeId)`.
- Historical calculation uses the profile effective for the Payroll period. If no effective profile exists, tax is zero and preflight returns a warning; a maker may enter an explicit deduction adjustment.

#### `EmployeeDeduction`

- Add `version`, normalized Company-scoped deduction code, creator/archive actors and archive metadata.
- Keep `startMonth`/`endMonth`, enforce `endMonth >= startMonth`, and require `monthlyAmount >= 0`.
- Company and Employee must match.
- Archive stops future use but does not rewrite calculated history.

### 3.3 Payroll aggregate

Extend `PayrollRun` with:

| Field | Contract |
|---|---|
| `version` | Optimistic concurrency token. |
| `runNumber` | Generated by `NumberSeriesService`; unique with Company. |
| `periodStart`, `periodEnd` | Date-only monthly boundaries derived by the server. |
| `currencyCode` | Immutable snapshot of Company base currency. |
| `status` | `PayrollRunStatus`. |
| `totalEarnings`, `totalDeductions`, `totalNet` | `Decimal(18,2)`, server-calculated. |
| `createdByUserId` | Payroll maker. |
| `calculatedByUserId`, `calculatedAt` | Calculation evidence. |
| `approvedByUserId`, `approvedAt` | Independent approval evidence. |
| `paidByUserId`, `paidAt` | Payment recording evidence. |
| `paymentAccountId` | Office Finance payment account used for payment. |
| `paymentReference` | Protected manual bank/cash reference. |
| `financeTransactionId` | Unique aggregate Finance expense link. |
| `cancelledByUserId`, `cancelledAt` | Cancellation evidence. |

Constraints:

- Unique `(companyId, payrollYear, payrollMonth)` and `(companyId, runNumber)`.
- Month is `1..12`; period dates must match the stored year/month.
- Monetary totals are non-negative and `totalNet = totalEarnings - totalDeductions`.
- `CALCULATED` requires calculator and calculation timestamp.
- `APPROVED` requires a distinct approver and approval timestamp.
- `PAID` requires approval evidence, payment account/reference/date and Finance link.
- `CANCELLED` requires actor, timestamp and protected reason.
- `LEGACY_IMPORTED` is read-only and cannot gain Finance or payslip links.

### 3.4 Snapshot and input tables

#### `PayrollRunAttendancePeriod`

Create one row for every Branch Attendance Period consumed by calculation:

- `companyId`, `payrollRunId`, `branchId`, `attendancePeriodId`.
- Attendance Period `version`, status, start and end snapshots.
- Unique `(payrollRunId, attendancePeriodId)`.
- Company/Branch-qualified `Restrict` foreign keys.

An Attendance Period linked to a `CALCULATED`, `APPROVED` or `PAID` run cannot be reopened. Returning a run to Draft releases this guard only after calculated snapshots are invalidated in the same transaction.

#### `PayrollRunEmployee`

Extend the existing row as an immutable calculation snapshot:

- `companyId`, `branchId`, `employeeId`, `employeeSalaryId`.
- Employee code, display name and designation snapshots.
- `grossEarnings`, `totalDeductions`, `netSalary` as `Decimal(18,2)`.
- Unique `(payrollRunId, employeeId)`.
- Company-qualified composite relations to run, Employee, Branch and salary revision.
- Check `netSalary >= 0` and exact aggregate consistency with child lines.

#### `PayrollRunEmployeeLine`

Add:

- `companyId`, `payrollRunEmployeeId`, `lineSequence`.
- `source PayrollLineSource` and `direction PayrollAdjustmentDirection`.
- Optional source IDs for salary component, tax profile, recurring deduction, adjustment, Overtime or Leave.
- Immutable code/name/description snapshots.
- `amount Decimal(18,2)` with `amount >= 0`.
- Unique `(payrollRunEmployeeId, lineSequence)` and source-shape checks.

The calculation writes individual earning and deduction lines; it must not retain only aggregate totals.

#### `PayrollRunAdjustment`

Add a versioned Draft input:

- `companyId`, `payrollRunId`, `employeeId`.
- `direction`, evidence `sourceType`, optional `sourceId`, amount and mandatory reason.
- `createdByUserId`, version, archive/cancellation evidence.
- Amount must be positive.
- Employee must be eligible for the run and belong to the same Company.
- A source Overtime/Leave record can be claimed only once by a non-cancelled run. Use a partial unique source index/claim table so concurrent runs cannot reuse it.
- Adjustments are mutable only while the run is `DRAFT`.

### 3.5 Payslips, events and receipts

#### `PayrollPayslip`

- One row per `PayrollRunEmployee`.
- Store Company, Employee and run snapshots, status, version, generated timestamp and safe failure code.
- `fileObjectId` is nullable until generation succeeds and then immutable.
- Unique `payrollRunEmployeeId` and unique non-null `fileObjectId`.
- Add `PAYROLL_PAYSLIP` to `FileUploadPurpose`/generated-file purpose and `FileRetentionClass`.
- Extend `FileObject` with the inverse relation and allow only a `CLEAN`, same-Company PDF to become `AVAILABLE`.

Secure File Storage must expose an internal generated-file primitive that writes a private encrypted object, records checksum/MIME metadata, passes the configured malware/policy checks, and returns a clean FileObject. Do not bypass FileObject state by writing an object key directly.

#### `PayrollActionEvent`

Append-only evidence for configuration changes, calculate, return, approve, pay, cancel, adjustment changes and payslip generation. Store Company, entity type/ID, action, actor, version before/after, timestamp, operation ID and protected reason/note. Audit and outbox projections must redact salary values and payment references.

#### `PayrollCommandReceipt`

- Unique `(companyId, operationId)`.
- Store command type, actor, request-hash key/format versions, full canonical-request HMAC, result entity ID and safe response snapshot.
- Replay of the same canonical command returns the stored safe result.
- Reuse with different command/payload returns `OPERATION_ID_REUSED`.
- Receipts contain no salary lines, notes or payment references.

### 3.6 Indexes and database backstops

Add indexes for:

- Runs by Company/status/year/month and approval queue.
- Employee run history and payslip self-service.
- Effective salary/tax lookup.
- Active recurring deductions.
- Adjustment source claims.
- Payslip generation state.
- Attendance Period linkage.

Use triggers/checks to prevent:

- Editing or deleting approved/paid/legacy runs and their snapshots.
- Self-approval.
- Payment without approval.
- Reopening a consumed Attendance Period.
- Cross-Company Employee, component, payment-account or Finance links.
- Duplicate source claims and duplicate Finance expense creation.

## 4. Authorization, feature gate and API conventions

### 4.1 Feature control

Add server-only configuration:

- `PAYROLL_LITE_ENABLED=false` by default.
- `PAYROLL_LITE_COMPANY_IDS` as the Company allowlist.

Every read, command, job and download checks the resolved server-side Company. Company Group context must select one Company. Frontend navigation uses authenticated module capabilities, never a public environment flag.

### 4.2 Permissions

- `payroll.payroll.read`: scoped Payroll configuration/run monitoring.
- `payroll.payroll.manage`: salary inputs, Draft runs, adjustments, calculate, return and cancel.
- `payroll.payroll.approve`: approve and mark paid.
- `payroll.self.read`: own paid payslip list/download.

Map HR Manager to read/manage, Finance Manager to read/approve, Organization Owner to all Payroll permissions, and Employee self-service to `payroll.self.read`. Maker-checker still overrides role breadth.

Add explicit route-policy rules for `/payroll` and `/me/payslips`; the self-service rule must be evaluated before the generic `/me` rule. Controllers also enforce record scope and actor/Employee identity.

### 4.3 Common wire contract

The existing global envelope remains authoritative:

```ts
type ApiResponse<T> = { success: true; data: T };
type Page<T> = { items: T[]; total: number; page: number; limit: number };
```

Use the existing `keyword`, `sortBy`, `sortOrder`, `page` and `limit` conventions with per-resource sort allowlists. Decimal amounts are serialized as fixed decimal strings, never JSON numbers.

Creation commands accept `operationId`; commands on existing records accept `operationId` plus the relevant `expectedVersion`. Download grants do not need a business version.

## 5. API contract

### 5.1 Setup and employee inputs

```text
GET  /payroll/salary-components
POST /payroll/salary-components
GET  /payroll/salary-components/:id
PATCH /payroll/salary-components/:id
POST /payroll/salary-components/:id/archive

GET  /payroll/employees/:employeeId/salary-revisions
POST /payroll/employees/:employeeId/salary-revisions
POST /payroll/employees/:employeeId/salary-revisions/:id/end

GET  /payroll/employees/:employeeId/tax-profiles
POST /payroll/employees/:employeeId/tax-profiles
POST /payroll/employees/:employeeId/tax-profiles/:id/end

GET  /payroll/employees/:employeeId/deductions
POST /payroll/employees/:employeeId/deductions
PATCH /payroll/employees/:employeeId/deductions/:id
POST /payroll/employees/:employeeId/deductions/:id/archive
```

Salary revision create:

```ts
{
  effectiveFrom: string;
  lines: Array<{ salaryComponentId: string; amount: string }>;
  remarks?: string;
  expectedCurrentRevisionVersion?: number;
  operationId: string;
}
```

The service derives Company from the Employee and scope. It never accepts `companyId` from these bodies.

### 5.2 Preflight and run APIs

```text
GET  /payroll/preflight?year=&month=
GET  /payroll/runs
POST /payroll/runs
GET  /payroll/runs/:id
GET  /payroll/runs/:id/employees
GET  /payroll/runs/:id/employees/:employeeId
GET  /payroll/runs/:id/history

POST /payroll/runs/:id/adjustments
PATCH /payroll/runs/:id/adjustments/:adjustmentId
POST /payroll/runs/:id/adjustments/:adjustmentId/remove

POST /payroll/runs/:id/calculate
POST /payroll/runs/:id/return-to-draft
POST /payroll/runs/:id/approve
POST /payroll/runs/:id/mark-paid
POST /payroll/runs/:id/cancel

GET  /payroll/runs/:id/register.csv
GET  /payroll/dashboard
```

Create run:

```ts
{
  year: number;
  month: number;
  remarks?: string;
  operationId: string;
}
```

Adjustment command:

```ts
{
  employeeId: string;
  direction: "EARNING" | "DEDUCTION";
  sourceType: "MANUAL_ADJUSTMENT" | "OVERTIME" | "UNPAID_LEAVE";
  sourceId?: string;
  amount: string;
  reason: string;
  expectedVersion: number;
  operationId: string;
}
```

Mark paid:

```ts
{
  paymentAccountId: string;
  paidDate: string;
  paymentReference: string;
  expectedVersion: number;
  operationId: string;
}
```

### 5.3 Self-service

```text
GET  /me/payslips
GET  /me/payslips/:id
POST /me/payslips/:id/download-grant
```

The Employee identity is resolved from the authenticated User. An employee ID is never accepted in self-service query/body data.

### 5.4 Response capabilities

```ts
type PayrollRunAction =
  | "EDIT_ADJUSTMENTS"
  | "CALCULATE"
  | "RETURN_TO_DRAFT"
  | "APPROVE"
  | "MARK_PAID"
  | "CANCEL"
  | "DOWNLOAD_REGISTER";

interface PayrollRunProjection {
  id: string;
  version: number;
  runNumber: string;
  year: number;
  month: number;
  status: PayrollRunStatus;
  currencyCode: string;
  totals: { earnings: string; deductions: string; net: string };
  blockers: Array<{ code: string; message: string; entityId?: string }>;
  warnings: Array<{ code: string; message: string; entityId?: string }>;
  financeTransactionId: string | null;
  allowedActions: PayrollRunAction[];
}
```

The UI does not calculate totals, eligibility or actions from raw status.

### 5.5 Stable errors

- `PAYROLL_LITE_SCOPE_NOT_ENABLED`
- `PAYROLL_RUN_NOT_FOUND`
- `PAYROLL_PERIOD_EXISTS`
- `PAYROLL_PREFLIGHT_FAILED`
- `PAYROLL_STATE_CHANGED`
- `PAYROLL_SELF_APPROVAL_FORBIDDEN`
- `SALARY_REVISION_OVERLAP`
- `SALARY_REVISION_IN_USE`
- `SALARY_COMPONENT_IN_USE`
- `PAYROLL_SOURCE_ALREADY_CLAIMED`
- `PAYROLL_NEGATIVE_NET`
- `ATTENDANCE_PERIOD_NOT_READY`
- `ATTENDANCE_PERIOD_IN_USE_BY_PAYROLL`
- `PAYROLL_FINANCE_SETUP_REQUIRED`
- `PAYROLL_FINANCE_SCOPE_NOT_ENABLED`
- `PAYSLIP_NOT_AVAILABLE`
- `OPERATION_ID_REUSED`

Foreign/cross-Company IDs return the same safe `404` code as a missing resource.

## 6. Calculation, approval and payment transactions

### 6.1 Preflight

The server derives eligible Employees with lifecycle status `ACTIVE`, `PROBATION` or `NOTICE` and a salary revision effective for the run period. It excludes `PENDING_ONBOARDING`, inactive, resigned and terminated Employees.

Block calculation when:

- Company financial profile/base currency or Payroll expense category is missing.
- A Branch containing an eligible Employee lacks a matching Attendance Period in `PAYROLL_PENDING` or `CLOSED`.
- Salary/tax effective ranges overlap or cross Company.
- Salary components or deductions are invalid.
- Another active run owns the same Company/month or adjustment source.

Return warnings for joiners/leavers, missing salary/tax configuration, approved Payroll-pending Overtime not represented by an adjustment, and approved unpaid Leave not represented by an adjustment.

### 6.2 Calculate

Run at serializable isolation with bounded serialization/deadlock retry:

1. Claim/replay the command receipt.
2. Lock Company financial profile, Payroll run and selected Attendance Periods.
3. Revalidate preflight and run version/status.
4. Lock eligible salary revisions, tax profiles, deductions and adjustments.
5. Calculate using Prisma `Decimal` only.
6. Replace unapproved calculation snapshots, then write employee and line snapshots.
7. Write Attendance Period links, totals, action event, audit and safe outbox event.
8. Change `DRAFT -> CALCULATED` and commit one safe response.

### 6.3 Return and approve

- Return requires a reason, clears the active calculation snapshot/link set in the same transaction and changes `CALCULATED -> DRAFT`; action history remains immutable.
- Approve locks the run and snapshot rows, rechecks totals and maker-checker, then changes `CALCULATED -> APPROVED`.
- No salary/workforce change after calculation silently modifies the run; a return and recalculation is required.

### 6.4 Mark paid and Finance integration

The Payroll command owns the top-level receipt and calls an internal Office Finance `createPayrollExpenseWithinTransaction(ctx, input)` primitive. That primitive must not start a nested transaction or claim another public receipt.

Lock order:

1. Payroll command receipt.
2. Company financial profile, Finance period and payment account.
3. Payroll run and employee snapshots.
4. Finance transaction/source uniqueness row.
5. Payroll/Finance action evidence, audit and outbox.

The generated Finance record uses the Payroll creator as source maker, the distinct Payroll approver as approval actor, and the payment-recording actor as recorder. It stores only run number, period, aggregate net amount, payment account and `sourceType=PAYROLL_RUN`; no Employee IDs or salary lines enter Finance payloads, audit records or notifications.

### 6.5 Payslip generation

Paid transition inserts one deduplicated outbox event per Payroll Employee. The worker claims the event, creates the PDF from immutable snapshot rows, stores it through Secure File Storage, updates `PayrollPayslip`, writes evidence and notifies the Employee.

Generation failure does not reverse payment. It follows Delivery/File retry and dead-letter rules and raises an operations alert. Retrying cannot create a second payslip row or FileObject link.

## 7. UI implementation

Enable navigation only when authenticated capabilities contain Payroll Lite plus the required permission.

Routes:

- `/hr/payroll` with Runs, Salary Components, Employee Salaries and Reports tabs.
- `/hr/payroll/runs/[id]`.
- A permission-protected Salary tab on Employee detail.
- A Payslips section in My Workspace.

Run detail shows preflight blockers/warnings, employee calculation rows, earning/deduction lines, adjustment editor, totals, history, server actions and the aggregate Finance link. Salary details never appear in notifications or Office Finance.

UI rules:

- Render actions only from `allowedActions`.
- Preserve user input on validation, version and network errors.
- Refetch run, dashboard, employee salary and Finance summary after successful commands.
- No optimistic calculate, approve or pay transitions.
- Use short-lived clean-file download grants for payslips.
- Never accept or expose an arbitrary Employee ID in My Workspace.

## 8. Migration and reconciliation

Use new additive migrations after the latest applied migration; never edit the historical Payroll or Workforce migrations.

1. `payroll_lite_expand`: enums, new nullable fields/tables, permissions, file purpose/retention and supporting composite keys.
2. `payroll_lite_reconcile`: read-only preflight report followed by explicit data mapping/backfill.
3. `payroll_lite_contract`: not-null/type conversions, exclusion/unique/check constraints, immutability triggers and final indexes.

Do not assume any environment is empty. Reconciliation must stop on:

- Unknown component or run status.
- Duplicate normalized component codes.
- Overlapping salary/tax revisions.
- Duplicate components within a salary revision.
- Negative values or impossible totals.
- Employee/Company/component mismatches.
- Duplicate Company/month runs.
- `PROCESSED` rows without trustworthy approval/payment evidence.

Mappings:

- `DRAFT -> DRAFT`.
- `PROCESSED -> LEGACY_IMPORTED`.

`LEGACY_IMPORTED` rows remain readable, but cannot create a Finance transaction or payslip and cannot be represented as approved/paid. Record reconciliation counts and approved historical exceptions before enabling the feature.

## 9. Tests and production acceptance

Required unit/service tests:

- Tenant scope and typed actions.
- Salary/tax/deduction effective-date rules.
- Eligibility/preflight warnings and blockers.
- Decimal line and total calculation.
- Maker-checker and state transitions.
- Aggregate Finance confidentiality.
- Payslip access and notification redaction.

Required real PostgreSQL tests:

- Concurrent salary revisions and exclusion enforcement.
- Concurrent run creation for one Company/month.
- Adjustment versus calculate.
- Calculate versus Attendance Period reopen.
- Approve versus return.
- Concurrent mark-paid producing exactly one Finance expense.
- Duplicate Overtime/Leave source claims.
- Receipt replay versus conflicting operation reuse.
- Exactly one payslip row/job/FileObject per Employee.
- Cross-Company Employee, salary, payment-account and direct-ID denial.

Required non-mock browser personas:

1. HR maker configures components, salary, tax and deductions.
2. HR maker creates a run, handles warnings, adds reviewed adjustments and calculates.
3. The same maker cannot approve.
4. An independent Finance approver approves and records payment.
5. Exactly one aggregate Office Finance expense appears without employee details.
6. An Employee lists and downloads only their own clean payslip.
7. Another Company cannot list or open any configuration, run or payslip record.

Production acceptance requires migration rehearsal from zero and production-like legacy data, catalog verification, exact decimal reconciliation against an approved sample, lint/type-check/build/test evidence, non-mock API/browser evidence, File/Delivery retry and dead-letter evidence, backup/restore rehearsal, monitoring and recorded technical/business sign-off.

## 10. Implementation order and ownership

1. Office Finance developer deploys the shared financial profile, Payroll expense category and payment-account contract with feature gates off.
2. Payroll developer hardens salary/tax/deduction tenant scope and adds effective-date constraints.
3. Add Payroll aggregate, snapshots, adjustments, receipts, events and permissions.
4. Implement preflight and transactional calculate/approval commands.
5. Integrate the internal Office Finance Payroll-expense primitive.
6. Add generated payslip storage, outbox worker and self-service authorization.
7. Build the UI from final typed responses and server `allowedActions`.
8. Rehearse migrations and run real PostgreSQL, API, browser and business acceptance before adding a Company to the allowlist.

