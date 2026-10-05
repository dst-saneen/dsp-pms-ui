export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedHours?: number | string | null;
  workedMinutes?: number | null;
  lateMinutes?: number | null;
  earlyDepartureMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  exceptionCount?: number | null;
  exceptions?: Array<{ id: string; type?: string; status?: string }> | null;
  remarks?: string | null;
  employee?: {
    id: string;
    employeeCode?: string;
    firstName?: string;
    lastName?: string | null;
    branch?: { timezone?: string | null } | null;
  } | null;
}

export interface CorrectAttendanceInput {
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  correctionReason: string;
  remarks?: string;
}

export type AttendanceViewMode = "today" | "month" | "all";

export interface AttendanceListResult {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
