export type PayrollRunStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED'
  | 'LEGACY_IMPORTED';

export type PayrollRunAction =
  | 'EDIT_ADJUSTMENTS'
  | 'CALCULATE'
  | 'RETURN_TO_DRAFT'
  | 'APPROVE'
  | 'MARK_PAID'
  | 'CANCEL'
  | 'DOWNLOAD_REGISTER';

export type TaxonomyAllowedAction = 'EDIT' | 'ARCHIVE' | 'REACTIVATE';

export interface PayrollBlocker {
  code: string;
  message: string;
  entityId?: string;
  /** Human label for the related employee/branch/run when known. */
  entityLabel?: string;
}

export interface PayrollWarning {
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

export interface PayrollRunProjection {
  id: string;
  version: number;
  runNumber: string;
  year: number;
  month: number;
  status: PayrollRunStatus;
  currencyCode: string;
  totals: PayrollRunTotals;
  blockers: PayrollBlocker[];
  warnings: PayrollWarning[];
  financeTransactionId: string | null;
  allowedActions: PayrollRunAction[];
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
