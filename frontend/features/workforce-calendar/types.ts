export type PrivacyCalendarState =
  | "AVAILABLE" | "SCHEDULED" | "ON_LEAVE" | "PENDING_LEAVE" | "HOLIDAY"
  | "WEEK_OFF" | "PRESENT" | "HALF_DAY" | "ABSENT" | "UNSCHEDULED";

export interface WorkforceCalendarEmployeeDay {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentId: string | null;
  branchId: string;
  state: PrivacyCalendarState;
  dayType: string | null;
  portion: string | null;
  isSelf: boolean;
  shiftName?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
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
}
export interface WorkforceCalendarDay { date: string; employees: WorkforceCalendarEmployeeDay[]; }
export interface WorkforceCalendarResponse { fromDate: string; toDate: string; accessMode: string; days: WorkforceCalendarDay[]; }
export interface WorkforceCalendarFilters { fromDate: string; toDate: string; branchId?: string; departmentId?: string; employeeId?: string; state?: string; }
export interface WorkforceCalendarEmployeeOption {
  id: string;
  employeeCode: string;
  fullName: string;
  branchId: string;
  departmentId: string | null;
  isSelf: boolean;
}
export interface WorkforceCalendarEmployeeOptionsResponse {
  accessMode: string;
  items: WorkforceCalendarEmployeeOption[];
}
