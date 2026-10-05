import { ShiftRosterDayType } from '@prisma/client';

import {
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
  LeaveRequestStatus,
} from '../employee-leave/constants';

import type { PrivacyCalendarState } from './dto';

export function calculatePrivacyState(input: {
  rosterDayType: ShiftRosterDayType | null;
  holiday: boolean;
  leaveStatus: string | null;
  attendanceStatus: string | null;
}): PrivacyCalendarState {
  if (
    input.leaveStatus === LeaveRequestStatus.APPROVED ||
    input.leaveStatus === 'APPROVED'
  ) {
    return 'ON_LEAVE';
  }
  if (
    input.leaveStatus === LeaveRequestStatus.SUBMITTED ||
    input.leaveStatus === LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS
  ) {
    return 'PENDING_LEAVE';
  }
  if (input.holiday || input.rosterDayType === ShiftRosterDayType.HOLIDAY) {
    return 'HOLIDAY';
  }
  if (input.rosterDayType === ShiftRosterDayType.WEEK_OFF) {
    return 'WEEK_OFF';
  }
  if (input.attendanceStatus === 'PRESENT') return 'PRESENT';
  if (input.attendanceStatus === 'HALF_DAY') return 'HALF_DAY';
  if (input.attendanceStatus === 'ABSENT') return 'ABSENT';
  if (input.rosterDayType === ShiftRosterDayType.WORKING) return 'SCHEDULED';
  if (input.rosterDayType === ShiftRosterDayType.SCHEDULED_HALF_DAY) {
    return 'SCHEDULED';
  }
  if (input.attendanceStatus) return 'UNSCHEDULED';
  return 'AVAILABLE';
}
