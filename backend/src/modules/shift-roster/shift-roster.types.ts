import {
  DayPortion,
  ShiftRosterDayType,
  ShiftRosterEntrySource,
} from '@prisma/client';

export type ShiftRosterGenerationAction =
  'create' | 'update' | 'retain' | 'skip' | 'delete';

export interface ShiftRosterScheduleSnapshot {
  shiftId: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  breakMinutes: number;
  scheduledNetMinutes: number;
  dayType: ShiftRosterDayType;
  dayPortion: DayPortion;
  timezone: string;
}

export interface ShiftRosterGenerationEntry {
  employeeId: string;
  workDate: string;
  dayType: ShiftRosterDayType;
  dayPortion: DayPortion;
  shiftId: string | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  breakMinutes: number;
  scheduledNetMinutes: number;
  timezone: string;
  generationKey: string;
  source: ShiftRosterEntrySource;
  action: ShiftRosterGenerationAction;
  existingEntryId?: string;
  businessCalendarRuntimeDayId?: string | null;
}

export interface ShiftRosterGenerationWarning {
  code: string;
  message: string;
  employeeId?: string;
  workDate?: string;
}

export interface ShiftRosterGenerationResult {
  branchId: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  includedEmployees: string[];
  excludedEmployees: Array<{ employeeId: string; reason: string }>;
  warnings: ShiftRosterGenerationWarning[];
  entries: ShiftRosterGenerationEntry[];
  summary: {
    toCreate: number;
    toUpdate: number;
    toRetain: number;
    toSkip: number;
    toDelete: number;
  };
}
