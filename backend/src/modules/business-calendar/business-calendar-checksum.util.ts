import { createHash } from 'node:crypto';

export type ChecksumWorkingWeekRule = {
  dayOfWeek: number;
  ruleMode: string;
  isWorkingDay: boolean;
  dayPortion: string;
  reason: string | null;
};

export type ChecksumEventTarget = {
  targetType: string;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  employeeId: string | null;
  projectId: string | null;
};

export type ChecksumEvent = {
  eventCode: string | null;
  eventName: string;
  eventTypeId: string;
  eventCategoryId: string;
  eventSourceId: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startsAt: string | null;
  endsAt: string | null;
  eventTimezone: string | null;
  businessDayEffect: string;
  paidHoliday: boolean;
  isOptionalHoliday: boolean;
  isProtected: boolean;
  targets: ChecksumEventTarget[];
};

export type VersionChecksumPayload = {
  effectiveFrom: string;
  effectiveTo: string | null;
  workingWeekRules: ChecksumWorkingWeekRule[];
  events: ChecksumEvent[];
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

function toDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

export function buildVersionChecksumPayload(input: {
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  workingWeekRules: Array<{
    dayOfWeek: number;
    ruleMode: string;
    isWorkingDay: boolean;
    dayPortion: string;
    reason?: string | null;
  }>;
  events: Array<{
    eventCode?: string | null;
    eventName: string;
    eventTypeId: string;
    eventCategoryId: string;
    eventSourceId: string;
    allDay: boolean;
    startDate: Date | string;
    endDate: Date | string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    eventTimezone?: string | null;
    businessDayEffect: string;
    paidHoliday: boolean;
    isOptionalHoliday?: boolean;
    isProtected: boolean;
    targets: Array<{
      targetType: string;
      companyId: string;
      branchId?: string | null;
      departmentId?: string | null;
      employeeId?: string | null;
      projectId?: string | null;
    }>;
  }>;
}): VersionChecksumPayload {
  const workingWeekRules = [...input.workingWeekRules]
    .map((rule) => ({
      dayOfWeek: rule.dayOfWeek,
      ruleMode: rule.ruleMode,
      isWorkingDay: rule.isWorkingDay,
      dayPortion: rule.dayPortion,
      reason: rule.reason ?? null,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const events = [...input.events]
    .map((event) => ({
      eventCode: event.eventCode ?? null,
      eventName: event.eventName,
      eventTypeId: event.eventTypeId,
      eventCategoryId: event.eventCategoryId,
      eventSourceId: event.eventSourceId,
      allDay: event.allDay,
      startDate: toDateKey(event.startDate),
      endDate: toDateKey(event.endDate),
      startsAt: toIsoOrNull(event.startsAt),
      endsAt: toIsoOrNull(event.endsAt),
      eventTimezone: event.eventTimezone ?? null,
      businessDayEffect: event.businessDayEffect,
      paidHoliday: event.paidHoliday,
      isOptionalHoliday: event.isOptionalHoliday ?? false,
      isProtected: event.isProtected,
      targets: [...event.targets]
        .map((target) => ({
          targetType: target.targetType,
          companyId: target.companyId,
          branchId: target.branchId ?? null,
          departmentId: target.departmentId ?? null,
          employeeId: target.employeeId ?? null,
          projectId: target.projectId ?? null,
        }))
        .sort((a, b) =>
          `${a.targetType}:${a.companyId}:${a.branchId}:${a.departmentId}:${a.employeeId}:${a.projectId}`.localeCompare(
            `${b.targetType}:${b.companyId}:${b.branchId}:${b.departmentId}:${b.employeeId}:${b.projectId}`,
          ),
        ),
    }))
    .sort((a, b) =>
      `${a.startDate}:${a.eventName}:${a.eventTypeId}`.localeCompare(
        `${b.startDate}:${b.eventName}:${b.eventTypeId}`,
      ),
    );

  return {
    effectiveFrom: toDateKey(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? toDateKey(input.effectiveTo) : null,
    workingWeekRules,
    events,
  };
}

export function computeVersionContentChecksum(
  payload: VersionChecksumPayload,
): string {
  const canonical = JSON.stringify(sortKeysDeep(payload));
  return createHash('sha256').update(canonical).digest('hex');
}
