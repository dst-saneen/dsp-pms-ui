export type LeaveTypeCategory = "STANDARD" | "COMP_OFF" | "UNPAID" | "OPTIONAL_HOLIDAY";

export interface LeaveType {
  id: string;
  companyId: string;
  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };
  leaveCode: string;
  leaveName: string;
  description?: string | null;
  category?: LeaveTypeCategory;
  isPaid: boolean;
  requiresApproval: boolean;
  allowHalfDay: boolean;
  carryForwardAllowed: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveTypeDto {
  companyId: string;
  leaveName: string;
  leaveCode?: string;
  description?: string;
  category?: LeaveTypeCategory;
  isPaid: boolean;
  requiresApproval: boolean;
  allowHalfDay: boolean;
  carryForwardAllowed: boolean;
}

export type UpdateLeaveTypeDto = Partial<CreateLeaveTypeDto>;
