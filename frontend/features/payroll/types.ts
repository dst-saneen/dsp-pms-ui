export interface PaginatedResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
}

export type PayrollRunStatus =
  "DRAFT" | "CALCULATED" | "APPROVED" | "PAID" | "CANCELLED" | "LEGACY_IMPORTED";

export type PayrollRunAction =
  | "EDIT_ADJUSTMENTS"
  | "CALCULATE"
  | "RETURN_TO_DRAFT"
  | "APPROVE"
  | "MARK_PAID"
  | "CANCEL"
  | "DOWNLOAD_REGISTER";

export type SalaryComponentType = "EARNING" | "DEDUCTION";

export interface PayrollIssue {
  code: string;
  message: string;
  entityId?: string;
  entityLabel?: string;
}

export interface PayrollRunTotals {
  earnings: string;
  deductions: string;
  net: string;
}

export interface PayrollRun {
  id: string;
  version: number;
  runNumber: string;
  year: number;
  month: number;
  status: PayrollRunStatus;
  currencyCode: string;
  totals: PayrollRunTotals;
  blockers: PayrollIssue[];
  warnings: PayrollIssue[];
  financeTransactionId: string | null;
  allowedActions: PayrollRunAction[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunEmployee {
  id: string;
  employeeId: string;
  employeeCode: string;
  displayName: string;
  designationName: string | null;
  grossEarnings: string;
  totalDeductions: string;
  netSalary: string;
  lines?: PayrollRunEmployeeLine[];
}

export interface PayrollRunEmployeeLine {
  id: string;
  lineSequence: number;
  source: string;
  direction: "EARNING" | "DEDUCTION";
  lineCode: string;
  lineName: string;
  lineDescription: string | null;
  amount: string;
}

export interface PayrollRunHistoryEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  versionBefore: number | null;
  versionAfter: number | null;
  createdAt: string;
}

export interface PayrollAdjustment {
  id: string;
  employeeId: string;
  direction: "EARNING" | "DEDUCTION";
  sourceType: "MANUAL_ADJUSTMENT" | "OVERTIME" | "UNPAID_LEAVE";
  sourceId: string | null;
  amount: string;
  reason: string;
  version: number;
}

export interface PayrollPreflight {
  year: number;
  month: number;
  blockers: PayrollIssue[];
  warnings: PayrollIssue[];
  eligibleEmployeeCount: number;
}

export interface PayrollDashboard {
  recentRuns: Array<{
    id: string;
    runNumber: string;
    year: number;
    month: number;
    status: PayrollRunStatus;
    totals: {
      earnings: string;
      deductions: string;
      net: string;
    };
  }>;
  approvalQueue: Array<{
    id: string;
    runNumber: string;
    year: number;
    month: number;
    calculatedAt: string | null;
  }>;
  paidSummary: {
    runCount: number;
    totals: {
      earnings: string;
      deductions: string;
      net: string;
    };
  };
}

export interface SalaryComponent {
  id: string;
  companyId: string;
  componentCode: string;
  componentName: string;
  componentType: SalaryComponentType;
  version: number;
  isActive: boolean;
  archivedAt: string | null;
  allowedActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRevisionLine {
  salaryComponentId: string;
  componentName: string;
  componentType: SalaryComponentType;
  amount: string;
}

export interface SalaryRevision {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  lines: SalaryRevisionLine[];
  createdAt: string;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  year: number;
  month: number;
  payrollYear: number;
  payrollMonth: number;
  runNumber: string;
  status: "PENDING" | "GENERATING" | "AVAILABLE" | "FAILED";
  netSalary: string;
  currencyCode: string;
  availableAt: string | null;
  generatedAt?: string | null;
}

export interface PayrollPayslipOperation {
  id: string;
  version: number;
  employeeId: string;
  employeeCode: string;
  displayName: string;
  payrollYear: number;
  payrollMonth: number;
  status: "PENDING" | "GENERATING" | "FAILED" | "AVAILABLE";
  generationAttemptCount: number;
  generationLeaseExpiresAt: string | null;
  lastAttemptAt: string | null;
  failureCode: string | null;
  updatedAt: string;
  allowedActions: Array<"RETRY">;
}

export interface CreatePayrollRunInput {
  year: number;
  month: number;
  remarks?: string;
  operationId: string;
}

export interface CreateSalaryComponentInput {
  componentName: string;
  componentType: SalaryComponentType;
  /** Optional; server generates from name when omitted. */
  componentCode?: string;
  operationId: string;
}

export interface UpdateSalaryComponentInput {
  expectedVersion: number;
  operationId: string;
  componentName?: string;
}

export interface CreatePayrollAdjustmentInput {
  employeeId: string;
  direction: "EARNING" | "DEDUCTION";
  sourceType: "MANUAL_ADJUSTMENT" | "OVERTIME" | "UNPAID_LEAVE";
  sourceId?: string;
  amount: string;
  reason: string;
  expectedVersion: number;
  operationId: string;
}

export interface MarkPayrollPaidInput {
  paymentAccountId: string;
  paidDate: string;
  paymentReference: string;
  expectedVersion: number;
  operationId: string;
}

export interface VersionedCommandInput {
  expectedVersion: number;
  operationId: string;
  reason?: string;
}

export interface PayrollRunFilters {
  year?: number;
  month?: number;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateSalaryRevisionInput {
  effectiveFrom: string;
  lines: Array<{ salaryComponentId: string; amount: string }>;
  remarks?: string;
  expectedCurrentRevisionVersion?: number;
  operationId: string;
}

export interface EndSalaryRevisionInput {
  expectedVersion: number;
  operationId: string;
  effectiveTo: string;
}

export interface TaxProfile {
  id: string;
  employeeId: string;
  countryCode: string;
  taxRegime: string | null;
  monthlyTaxAmount: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  version: number;
}

export interface RecurringDeduction {
  id: string;
  employeeId: string;
  deductionCode: string | null;
  deductionName: string;
  monthlyAmount: string;
  startMonth: string;
  endMonth: string | null;
  remarks: string | null;
  isActive: boolean;
  version: number;
}

export interface CreateTaxProfileInput {
  countryCode: string;
  taxRegime?: string;
  monthlyTaxAmount: string;
  effectiveFrom: string;
  operationId: string;
}

export interface EndTaxProfileInput {
  expectedVersion: number;
  operationId: string;
  effectiveTo: string;
}

export interface CreateRecurringDeductionInput {
  deductionCode?: string;
  deductionName: string;
  monthlyAmount: string;
  startMonth: string;
  endMonth?: string;
  remarks?: string;
  operationId: string;
}

export interface ArchiveRecurringDeductionInput {
  expectedVersion: number;
  operationId: string;
  reason?: string;
}
