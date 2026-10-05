"use client";

export interface AttendanceSnapshot {
  id: string;
  attendanceDate: string;
  lateMinutes?: number | null;
  earlyDepartureMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  workedMinutes?: number | null;
}

export interface WorkforceEmployee {
  id: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string | null;
}

export interface AttendanceException {
  id: string;
  employeeId: string;
  branchId: string;
  attendanceId?: string | null;
  businessDate: string;
  type: string;
  status: string;
  detectedAt: string;
  employee?: WorkforceEmployee | null;
  attendance?: AttendanceSnapshot | null;
}

export interface AttendanceRegularization {
  id: string;
  employeeId: string;
  branchId: string;
  attendanceId: string;
  attendanceExceptionId?: string | null;
  proposedCheckInAt?: string | null;
  proposedCheckOutAt?: string | null;
  status: string;
  submittedAt: string;
  employee?: WorkforceEmployee | null;
  attendance?: AttendanceSnapshot | null;
  attendanceException?: AttendanceException | null;
}

export interface AttendanceExceptionFilters {
  employeeId?: string;
  branchId?: string;
  status?: string;
  type?: string;
}

export interface AttendanceRegularizationFilters {
  employeeId?: string;
  status?: string;
}
