export const EMPLOYEE_LEAVE_QUERY_KEY = [
  "employee-leave",
] as const;

export const employeeLeaveQueryKeys = {
  all: EMPLOYEE_LEAVE_QUERY_KEY,

  profile: (
    employeeId: string,
    year?: number,
  ) => [
    ...EMPLOYEE_LEAVE_QUERY_KEY,
    "profile",
    employeeId,
    year,
  ] as const,

  summary: (
    employeeId: string,
    year?: number,
  ) => [
    ...EMPLOYEE_LEAVE_QUERY_KEY,
    "summary",
    employeeId,
    year,
  ] as const,

  balances: (
    employeeId: string,
    year?: number,
  ) => [
    ...EMPLOYEE_LEAVE_QUERY_KEY,
    "balances",
    employeeId,
    year,
  ] as const,

  history: (
    employeeId: string,
  ) => [
    ...EMPLOYEE_LEAVE_QUERY_KEY,
    "history",
    employeeId,
  ] as const,

  upcoming: (
    employeeId: string,
  ) => [
    ...EMPLOYEE_LEAVE_QUERY_KEY,
    "upcoming",
    employeeId,
  ] as const,
};