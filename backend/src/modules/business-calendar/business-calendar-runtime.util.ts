import {
  BusinessDayEffect,
  BusinessDayStatus,
  DayPortion,
} from '@prisma/client';

export type RuntimeWeekRule = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  dayPortion: DayPortion;
  ruleMode: string;
};

export type RuntimeEvent = {
  id: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  businessDayEffect: BusinessDayEffect;
  paidHoliday: boolean;
  targets: Array<{
    targetType: string;
    companyId: string;
    branchId: string | null;
  }>;
};

export type ResolutionStep = {
  layer: string;
  code: string;
  detail: string;
  eventId?: string;
};

export type ResolvedBusinessDay = {
  dayStatus: BusinessDayStatus;
  dayPortion: DayPortion;
  reasonCode: string;
  reasonText: string;
  controllingEventId: string | null;
  resolutionTrace: ResolutionStep[];
  sourceChecksum: string;
};

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function appliesToOffice(
  event: RuntimeEvent,
  companyId: string,
  branchId: string | null,
): boolean {
  return event.targets.some((target) => {
    if (target.companyId !== companyId) return false;
    if (target.targetType === 'COMPANY') return true;
    if (target.targetType === 'BRANCH') {
      return !!branchId && target.branchId === branchId;
    }
    return false;
  });
}

function eventCoversDate(event: RuntimeEvent, businessDate: Date): boolean {
  const day = dateKey(businessDate);
  return dateKey(event.startDate) <= day && day <= dateKey(event.endDate);
}

function applyEffect(
  current: {
    dayStatus: BusinessDayStatus;
    dayPortion: DayPortion;
    controllingEventId: string | null;
  },
  effect: BusinessDayEffect,
  eventId: string,
): {
  dayStatus: BusinessDayStatus;
  dayPortion: DayPortion;
  controllingEventId: string | null;
} {
  switch (effect) {
    case BusinessDayEffect.NONE:
      return current;
    case BusinessDayEffect.NON_WORKING_DAY:
      return {
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        controllingEventId: eventId,
      };
    case BusinessDayEffect.WORKING_DAY_OVERRIDE:
      return {
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FULL_DAY,
        controllingEventId: eventId,
      };
    case BusinessDayEffect.FIRST_HALF_NON_WORKING:
      return {
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FIRST_HALF,
        controllingEventId: eventId,
      };
    case BusinessDayEffect.SECOND_HALF_NON_WORKING:
      return {
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.SECOND_HALF,
        controllingEventId: eventId,
      };
    default:
      return current;
  }
}

function pickWeekRule(
  rules: RuntimeWeekRule[],
  dayOfWeek: number,
): RuntimeWeekRule | undefined {
  return rules.find((rule) => rule.dayOfWeek === dayOfWeek);
}

function pickDatedEvent(
  events: RuntimeEvent[],
  companyId: string,
  branchId: string | null,
  businessDate: Date,
): RuntimeEvent | undefined {
  const matches = events.filter(
    (event) =>
      event.businessDayEffect !== BusinessDayEffect.NONE &&
      eventCoversDate(event, businessDate) &&
      appliesToOffice(event, companyId, branchId),
  );
  if (matches.length === 0) return undefined;
  // Deterministic: earliest start, then name, then id
  matches.sort((a, b) => {
    const byStart = dateKey(a.startDate).localeCompare(dateKey(b.startDate));
    if (byStart !== 0) return byStart;
    const byName = a.eventName.localeCompare(b.eventName);
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
  return matches[0];
}

/**
 * Deterministic business-day resolution (work order §7.2).
 * Company WW → Company event → Branch WW → Branch event.
 */
export function resolveBusinessDay(input: {
  companyId: string;
  branchId: string | null;
  businessDate: Date;
  companyWeekRules: RuntimeWeekRule[];
  companyEvents: RuntimeEvent[];
  branchWeekRules?: RuntimeWeekRule[];
  branchEvents?: RuntimeEvent[];
  sourceChecksum: string;
}): ResolvedBusinessDay {
  const trace: ResolutionStep[] = [];
  const dayOfWeek = input.businessDate.getUTCDay();

  const companyWeek = pickWeekRule(input.companyWeekRules, dayOfWeek);
  let state = {
    dayStatus: companyWeek?.isWorkingDay
      ? BusinessDayStatus.WORKING
      : BusinessDayStatus.NON_WORKING,
    dayPortion: companyWeek?.dayPortion ?? DayPortion.FULL_DAY,
    controllingEventId: null as string | null,
  };

  if (companyWeek) {
    trace.push({
      layer: 'COMPANY_WORKING_WEEK',
      code: companyWeek.isWorkingDay ? 'WORKING' : 'NON_WORKING',
      detail: `Company week day ${dayOfWeek}`,
    });
  } else {
    trace.push({
      layer: 'COMPANY_WORKING_WEEK',
      code: 'MISSING',
      detail: `No company working-week rule for day ${dayOfWeek}; default NON_WORKING`,
    });
    state.dayStatus = BusinessDayStatus.NON_WORKING;
  }

  const companyEvent = pickDatedEvent(
    input.companyEvents,
    input.companyId,
    null,
    input.businessDate,
  );
  if (companyEvent) {
    state = applyEffect(state, companyEvent.businessDayEffect, companyEvent.id);
    trace.push({
      layer: 'COMPANY_EVENT',
      code: companyEvent.businessDayEffect,
      detail: companyEvent.eventName,
      eventId: companyEvent.id,
    });
  }

  if (input.branchId) {
    const branchWeek = pickWeekRule(input.branchWeekRules ?? [], dayOfWeek);
    if (branchWeek) {
      state = {
        dayStatus: branchWeek.isWorkingDay
          ? BusinessDayStatus.WORKING
          : BusinessDayStatus.NON_WORKING,
        dayPortion: branchWeek.dayPortion,
        controllingEventId: null,
      };
      trace.push({
        layer: 'BRANCH_WORKING_WEEK',
        code: branchWeek.isWorkingDay ? 'WORKING' : 'NON_WORKING',
        detail: `Branch override day ${dayOfWeek}`,
      });
    }

    const branchEvent = pickDatedEvent(
      input.branchEvents ?? [],
      input.companyId,
      input.branchId,
      input.businessDate,
    );
    if (branchEvent) {
      state = applyEffect(state, branchEvent.businessDayEffect, branchEvent.id);
      trace.push({
        layer: 'BRANCH_EVENT',
        code: branchEvent.businessDayEffect,
        detail: branchEvent.eventName,
        eventId: branchEvent.id,
      });
    }
  }

  const reasonCode =
    state.controllingEventId != null
      ? 'EVENT'
      : trace.some((step) => step.layer === 'BRANCH_WORKING_WEEK')
        ? 'BRANCH_WEEK'
        : 'COMPANY_WEEK';

  const reasonText =
    [...trace].reverse().find((step) => step.code !== 'MISSING')?.detail ??
    'Resolved';

  return {
    dayStatus: state.dayStatus,
    dayPortion: state.dayPortion,
    reasonCode,
    reasonText,
    controllingEventId: state.controllingEventId,
    resolutionTrace: trace,
    sourceChecksum: input.sourceChecksum,
  };
}

const HOLIDAY_REASON_CODES = ['EVENT', 'LEGACY_HOLIDAY'] as const;

/** Matches consumer calendar classification for HOLIDAY (not week-off). */
export function isHolidayRuntimeDay(input: {
  dayStatus: BusinessDayStatus;
  dayPortion: DayPortion;
  reasonCode: string;
}): boolean {
  if (input.dayStatus === BusinessDayStatus.NON_WORKING) {
    return (HOLIDAY_REASON_CODES as readonly string[]).includes(
      input.reasonCode,
    );
  }
  if (
    input.dayPortion === DayPortion.FIRST_HALF ||
    input.dayPortion === DayPortion.SECOND_HALF
  ) {
    return input.reasonCode === 'EVENT';
  }
  return false;
}

export function eachDateInclusive(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function addMonthsUtc(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
