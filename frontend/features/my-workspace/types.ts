export interface MyWorkspaceIdentity {
  userId: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  employmentStatus: string;
  company: { id: string; companyName: string };
  branch: { id: string; branchName: string; timezone: string | null };
  department: { id: string; departmentName: string };
  designation: { id: string; designationName: string } | null;
  timezone: string | null;
}

export interface MyAttendanceRecord {
  id: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedHours?: number | string;
  workedMinutes?: number | null;
  lateMinutes?: number;
}

export interface MyTodayShift {
  workDate: string | Date;
  dayType: string;
  shiftName: string | null;
  scheduledStartAt: string | Date | null;
  scheduledEndAt: string | Date | null;
}

export interface MyTodayWorkPlan {
  itemCount: number;
  items: Array<{
    id: string;
    title: string;
    status: string;
    plannedStartTime: string | Date | null;
    plannedEndTime: string | Date | null;
  }>;
}

export interface MyLeaveBalance {
  leaveTypeId: string;
  leaveCode: string;
  leaveName: string;
  entitlement: number;
  used: number;
  pending: number;
  balance: number;
}

export interface MyLeaveSummary {
  totalEntitlement: number;
  totalUsed: number;
  totalPending: number;
  totalBalance: number;
}

export interface MyUpcomingLeave {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  approvedDays: number;
  isHalfDay?: boolean;
  status: string;
}

export interface MyLeaveHistory {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  requestedDays: number;
  approvedDays?: number;
  isHalfDay?: boolean;
  status: string;
  createdAt: string;
}

export interface MyLeaveData {
  summary: MyLeaveSummary;
  balances: MyLeaveBalance[];
  history: MyLeaveHistory[];
  upcoming: MyUpcomingLeave[];
}

export interface MyOnboardingTask {
  id: string;
  taskName: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface MyOnboarding {
  id?: string;
  status: string;
  progressPercent: number;
  startedAt?: string;
  completedAt?: string | null;
  tasks: MyOnboardingTask[];
}

export interface MyDocumentSummary {
  total: number;
  verified: number;
  pending: number;
  expired: number;
}

export interface MyPunchReadiness {
  businessDate: string;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInBlockedReason: string | null;
  checkOutBlockedReason: string | null;
  setupHref: string | null;
}

export interface MyWorkspace {
  identity: MyWorkspaceIdentity;
  businessDate?: string;
  timezone?: string;
  todayAttendance: MyAttendanceRecord | null;
  todayShift?: MyTodayShift | null;
  punchReadiness?: MyPunchReadiness | null;
  todayWorkPlan?: MyTodayWorkPlan | null;
  leave: {
    summary: MyLeaveSummary;
    balances: MyLeaveBalance[];
    upcoming: MyUpcomingLeave[];
  };
  onboarding: MyOnboarding;
  documents: {
    summary: MyDocumentSummary;
    expiringSoon: number;
    expired: number;
  };
  assets?: {
    assignedCount?: number;
    items?: Array<{
      id: string;
      status: string;
      assignedDate: string;
      asset?: {
        assetCode?: string;
        assetName?: string;
      };
    }>;
  };
}

export interface MyAssetSummary {
  physicalAssigned: number;
  activeLicenses: number;
  acknowledgementPending: number;
  openRequests: number;
}

export interface MyPendingAssetRequest {
  id: string;
  requestType: string;
  status: string;
  requestedAt: string;
}

export interface MyPhysicalAssignment {
  id: string;
  version: number;
  custodyStatus: string;
  assignedDate: string;
  acknowledgedAt?: string | null;
  allowedActions: string[];
  pendingRequest?: MyPendingAssetRequest | null;
  asset?: {
    id: string;
    assetCode: string;
    assetName: string;
    version: number;
    kind?: string;
  };
}

export interface MyLicenseAllocation {
  id: string;
  version: number;
  status: string;
  allocatedAt: string;
  acknowledgedAt?: string | null;
  allowedActions: string[];
  pendingRequest?: MyPendingAssetRequest | null;
  pool?: {
    id: string;
    assetCode: string;
    assetName: string;
    version: number;
    kind?: string;
  };
}

export interface MyAssetsResponse {
  summary: MyAssetSummary;
  physicalAssignments: MyPhysicalAssignment[];
  licenseAllocations: MyLicenseAllocation[];
}

export interface MyOvertimeRequest {
  id: string;
  businessDate: string;
  eligibleMinutes: number;
  requestedMinutes?: number | null;
  approvedMinutes?: number | null;
  status: string;
  requestedSettlement?: string | null;
  approvedSettlement?: string | null;
}

export interface MyCompOffCredit {
  id: string;
  sourceDate: string;
  earnedDays: number;
  availableDays: number;
  reservedDays: number;
  usedDays: number;
  expiresOn: string;
  status: string;
}

export interface MyAttendanceException {
  id: string;
  type: string;
  status: string;
  businessDate: string;
  attendanceId?: string | null;
  attendance?: { id: string } | null;
}

export interface MyCalendarDay {
  date: string;
  employees: Array<{
    employeeId: string;
    state: string;
    dayType: string | null;
    portion?: string | null;
    shiftName?: string | null;
    attendanceStatus?: string | null;
    leaveStatus?: string | null;
    leaveTypeName?: string | null;
    leaveTypeId?: string | null;
    dayPortion?: string | null;
    holidayName?: string | null;
    holidaySource?: "LEGACY_HOLIDAYS" | "BUSINESS_CALENDAR" | null;
    holidayCalendarId?: string | null;
    approvalStage?: string | null;
    overtimeStatus?: string | null;
  }>;
}

export interface MyLeavePreview {
  requestedWorkingDays: number;
  fromCalendarDate: string;
  toCalendarDate: string;
  timezone: string;
  excludedHolidays: string[];
  excludedNonWorkingDays: string[];
  isHalfDay: boolean;
  balance: {
    year: number;
    leaveTypeId: string;
    leaveName: string | null;
    entitlement: number;
    used: number;
    pending: number;
    available: number;
    afterSubmit: { available: number; pending: number; used: number };
  } | null;
  canSubmit: boolean;
  blockReason: string | null;
  setupLinks: { myCalendar: string; leaveBalancesTab: string };
}

export interface CreateMyLeaveRequestInput {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  isHalfDay?: boolean;
  reason?: string;
}

export interface LeaveTypeOption {
  id: string;
  leaveCode: string;
  leaveName: string;
  category?: "STANDARD" | "COMP_OFF" | "UNPAID" | "OPTIONAL_HOLIDAY";
  allowHalfDay: boolean;
  isActive: boolean;
}

export type {
  OptionalHolidayCatalog,
  OptionalHolidayCatalogHoliday,
} from "@/features/optional-holiday/types";
