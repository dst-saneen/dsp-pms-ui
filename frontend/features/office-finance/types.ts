import type { PaginatedResponse } from "./api-common";

export type { PaginatedResponse };

export type FinanceTransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "OPENING_BALANCE";

export type FinanceTransactionStatus =
  "DRAFT" | "SUBMITTED" | "APPROVED" | "CANCELLED" | "REVERSED";

export type FinanceTransactionAction =
  "EDIT" | "SUBMIT" | "APPROVE" | "RETURN" | "CANCEL" | "REVERSE" | "ATTACH_DOCUMENT";

export type TaxonomyAllowedAction = "EDIT" | "ARCHIVE" | "REACTIVATE";

export interface FinanceWarning {
  code: string;
  message: string;
}

export interface FinanceTransaction {
  id: string;
  companyId: string;
  branchId: string | null;
  transactionNumber: string;
  version: number;
  transactionDate: string;
  transactionType: FinanceTransactionType;
  status: FinanceTransactionStatus;
  amount: string;
  taxAmount: string;
  currencyCode: string;
  categoryId: string | null;
  departmentId: string | null;
  projectId: string | null;
  businessPartyId: string | null;
  employeeId: string | null;
  description: string;
  sourceType: string | null;
  sourceId: string | null;
  movement: {
    sourceAccountId: string | null;
    destinationAccountId: string | null;
  };
  reversalOfTransactionId: string | null;
  reversedByTransactionId: string | null;
  warnings: FinanceWarning[];
  allowedActions: FinanceTransactionAction[];
  createdAt: string;
  updatedAt: string;
}

export interface FinanceDashboard {
  asOf: string;
  monthStart: string;
  monthEnd: string;
  totalIncome: string;
  totalExpense: string;
  net: string;
  pendingApproval: number;
}

export interface FinancialProfile {
  id: string;
  companyId: string;
  baseCurrencyCode: string;
  reportingStartDate: string;
  payrollExpenseCategoryId: string | null;
  version: number;
  allowedActions: TaxonomyAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

export interface BusinessParty {
  id: string;
  companyId: string;
  partyCode: string;
  displayName: string;
  normalizedName: string;
  partyType: "CUSTOMER" | "VENDOR" | "BOTH";
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  taxRegistrationRef: string | null;
  version: number;
  isActive: boolean;
  archivedAt: string | null;
  allowedActions: TaxonomyAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCategory {
  id: string;
  companyId: string;
  categoryCode: string;
  categoryName: string;
  categoryType: "INCOME" | "EXPENSE";
  description: string | null;
  version: number;
  isActive: boolean;
  archivedAt: string | null;
  allowedActions: TaxonomyAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

export interface FinancePaymentAccount {
  id: string;
  companyId: string;
  branchId: string | null;
  accountCode: string;
  accountName: string;
  accountType: "BANK" | "CASH";
  currencyCode: string;
  openingBalance: string;
  openingDate: string;
  bankName: string | null;
  bankLastFour: string | null;
  version: number;
  isActive: boolean;
  archivedAt: string | null;
  projectedBalance?: string;
  allowedActions: TaxonomyAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

export interface FinancePeriod {
  id: string;
  companyId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string;
  periodEnd: string;
  status: "OPEN" | "LOCKED";
  version: number;
  lockedAt: string | null;
  reopenedAt: string | null;
  allowedActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSettings {
  profile: FinancialProfile | null;
  categories: FinanceCategory[];
  paymentAccounts: FinancePaymentAccount[];
}

export interface FinanceTransactionFilters {
  keyword?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface FinanceReportFilters {
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  departmentId?: string;
  projectId?: string;
  businessPartyId?: string;
  categoryId?: string;
  paymentAccountId?: string;
}

export interface FinanceReportSummary {
  totalIncome: string;
  totalExpense: string;
  net: string;
  asOf?: string;
}

export interface FinanceReportGroupRow {
  id: string | null;
  label: string;
  income: string;
  expense: string;
  net: string;
}

export interface FinanceAccountMovementRow {
  transactionId: string;
  transactionNumber: string;
  transactionDate: string;
  transactionType: FinanceTransactionType;
  status: FinanceTransactionStatus;
  amount: string;
  runningBalance: string;
}

export interface FinanceAccountBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  currencyCode: string;
  projectedBalance: string;
  asOf: string;
}

export interface CreateFinanceTransactionInput {
  transactionType: FinanceTransactionType;
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

export interface UpdateFinanceTransactionInput {
  expectedVersion: number;
  operationId: string;
  transactionDate?: string;
  amount?: string;
  taxAmount?: string;
  categoryId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  businessPartyId?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  description?: string;
  reference?: string;
}

export interface VersionedCommandInput {
  expectedVersion: number;
  operationId: string;
  reason?: string;
}

export interface UpdateFinancialProfileInput {
  expectedVersion: number;
  operationId: string;
  baseCurrencyCode: string;
  reportingStartDate: string;
  payrollExpenseCategoryId?: string | null;
}

export interface CreateBusinessPartyInput {
  displayName: string;
  partyType: BusinessParty["partyType"];
  contactPerson?: string;
  email?: string;
  phone?: string;
  taxRegistrationRef?: string;
  operationId: string;
}

export interface CreateFinanceCategoryInput {
  categoryName: string;
  categoryType: FinanceCategory["categoryType"];
  description?: string;
  operationId: string;
}

export interface CreateFinancePaymentAccountInput {
  accountName: string;
  accountType: FinancePaymentAccount["accountType"];
  currencyCode?: string;
  openingBalance: string;
  openingDate: string;
  branchId?: string;
  bankName?: string;
  bankLastFour?: string;
  operationId: string;
}

export interface CreateFinancePeriodInput {
  periodYear: number;
  periodMonth: number;
  operationId: string;
}

export interface FinanceTransactionHistoryEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface FinanceTransactionAttachment {
  id: string;
  fileObjectId: string;
  title: string | null;
  linkedAt: string;
}

export interface LinkFinanceAttachmentInput {
  uploadSessionId: string;
  title?: string;
  operationId: string;
}

export interface FinanceAttachmentDownloadGrant {
  url: string;
  expiresAt: string;
  fileName: string;
}
