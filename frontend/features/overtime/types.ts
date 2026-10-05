export interface OvertimeRequestEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName?: string | null;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  branchId: string;
  businessDate: string;
  rawMinutes: number;
  eligibleMinutes: number;
  requestedMinutes: number;
  approvedMinutes?: number | null;
  requestedSettlement?: string | null;
  approvedSettlement?: string | null;
  status: string;
  reason?: string | null;
  employee?: OvertimeRequestEmployee | null;
}

export interface OvertimeRequestFilters {
  employeeId?: string;
  branchId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ApproveOvertimeDto {
  approvedMinutes: number;
  approvedSettlement: string;
  remarks?: string;
}
