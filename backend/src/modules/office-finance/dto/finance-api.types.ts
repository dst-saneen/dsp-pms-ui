export interface PaginatedResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
}

export type FinanceMoneyString = string;

export type FinanceCalendarDateString = string;

export type FinanceTransactionAction =
  | 'EDIT'
  | 'SUBMIT'
  | 'APPROVE'
  | 'RETURN'
  | 'CANCEL'
  | 'REVERSE'
  | 'ATTACH_DOCUMENT';

export interface FinanceWarning {
  code: string;
  message: string;
}
