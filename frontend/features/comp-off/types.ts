export interface CompOffCredit {
  id: string;
  employeeId: string;
  sourceDate: string;
  earnedDays: number;
  availableDays: number;
  reservedDays: number;
  usedDays: number;
  expiresOn: string;
  status: string;
  employee?: { employeeCode: string; firstName: string; lastName?: string | null } | null;
  leaveType?: { leaveName: string } | null;
}

export interface CompOffCreditFilters {
  employeeId?: string;
  status?: string;
}
