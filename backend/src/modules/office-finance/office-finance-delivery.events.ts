export const OFFICE_FINANCE_DELIVERY_EVENTS = {
  TRANSACTION_SUBMITTED: 'office-finance.transaction.submitted',
  TRANSACTION_APPROVED: 'office-finance.transaction.approved',
  TRANSACTION_RETURNED: 'office-finance.transaction.returned',
  TRANSACTION_CANCELLED: 'office-finance.transaction.cancelled',
  TRANSACTION_REVERSED: 'office-finance.transaction.reversed',
  PERIOD_LOCKED: 'office-finance.period.locked',
  PERIOD_REOPENED: 'office-finance.period.reopened',
} as const;

export type OfficeFinanceDeliveryEventType =
  (typeof OFFICE_FINANCE_DELIVERY_EVENTS)[keyof typeof OFFICE_FINANCE_DELIVERY_EVENTS];
