import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class WorkforceCalendarFilterDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  state?: string;
}

export class TeamCalendarFilterDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class WorkforceCalendarEmployeeOptionsQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export type PrivacyCalendarState =
  | 'AVAILABLE'
  | 'SCHEDULED'
  | 'ON_LEAVE'
  | 'PENDING_LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'PRESENT'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'UNSCHEDULED';

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
  /** Present for self / HR operational views only. */
  shiftName?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  attendanceStatus?: string | null;
  leaveStatus?: string | null;
  leaveTypeName?: string | null;
  /** Present for self / authorized manager-HR views so the UI can match a leave type. */
  leaveTypeId?: string | null;
  dayPortion?: string | null;
  holidayName?: string | null;
  holidaySource?: 'LEGACY_HOLIDAYS' | 'BUSINESS_CALENDAR' | null;
  holidayCalendarId?: string | null;
  approvalStage?: string | null;
  overtimeStatus?: string | null;
}

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

export interface WorkforceCalendarDay {
  date: string;
  employees: WorkforceCalendarEmployeeDay[];
}

export interface WorkforceCalendarResponse {
  fromDate: string;
  toDate: string;
  accessMode: string;
  days: WorkforceCalendarDay[];
}
