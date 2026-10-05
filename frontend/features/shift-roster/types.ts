"use client";

export type ShiftRosterStatus = "DRAFT" | "PUBLISHED" | "LOCKED" | "ARCHIVED" | string;

export interface ShiftRosterEntryOverride {
  id: string;
  reason?: string | null;
  newSnapshot?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface ShiftRosterEmployee {
  id?: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
}

export interface ShiftRosterShift {
  id?: string;
  shiftCode?: string;
  shiftName?: string;
}

export interface ShiftRosterEntry {
  id: string;
  employeeId: string;
  workDate: string;
  dayType: string;
  dayPortion?: string | null;
  shiftId?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  employee?: ShiftRosterEmployee | null;
  shift?: ShiftRosterShift | null;
  overrides?: ShiftRosterEntryOverride[];
}

export interface ShiftRoster {
  id: string;
  companyId: string;
  branchId: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  status: ShiftRosterStatus;
  branch?: { branchName?: string } | null;
  company?: { companyName?: string } | null;
  entries?: ShiftRosterEntry[];
}

export interface ShiftRosterFilters {
  branchId?: string;
  companyId?: string;
  status?: string;
}

export interface CreateShiftRosterInput {
  branchId: string;
  periodStart: string;
  periodEnd: string;
}

export interface GenerateShiftRosterInput extends CreateShiftRosterInput {
  shiftRosterId?: string;
  dryRun?: boolean;
}

export interface ShiftRosterGenerateWarning {
  code: string;
  message: string;
  employeeId?: string;
  workDate?: string;
}

export interface ShiftRosterGenerateResult {
  dryRun: boolean;
  summary?: {
    toCreate?: number;
    toUpdate?: number;
    toRetain?: number;
    toSkip?: number;
    toDelete?: number;
    [key: string]: number | string | boolean | null | undefined;
  };
  entries?: ShiftRosterEntry[];
  warnings?: Array<string | ShiftRosterGenerateWarning>;
  roster?: ShiftRoster;
  includedEmployees?: string[];
  excludedEmployees?: Array<{ employeeId: string; reason: string }>;
}

export interface RosterVersionInput {
  expectedVersion: number;
}

export interface OverrideRosterEntryInput extends RosterVersionInput {
  shiftRosterEntryId: string;
  reason: string;
  newSnapshot: Record<string, unknown>;
}
