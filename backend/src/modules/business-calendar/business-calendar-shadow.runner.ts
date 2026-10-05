import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarVersionStatus,
  PrismaClient,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  addMonthsUtc,
  eachDateInclusive,
  resolveBusinessDay,
  type RuntimeEvent,
  type RuntimeWeekRule,
} from './business-calendar-runtime.util';
import {
  categorizeParityDifference,
  resolveLegacyBusinessDay,
  type ParityDifferenceCategory,
} from './business-calendar-migration.util';
import { isValidIanaTimeZone } from './business-calendar-validators';

export type ShadowCompareOptions = {
  companyId: string;
  branchId: string;
  actorUserId: string;
  activateShadow: boolean;
  allowProduction: boolean;
  databaseName: string;
  databaseSchema: string;
  reportPath?: string;
  /** Use draft backfill versions when no published version exists */
  allowDraftVersions: boolean;
};

export type ShadowParityReport = {
  companyId: string;
  branchId: string;
  timezoneValid: boolean;
  hasCompanyWorkingWeek: boolean;
  companyVersionId: string | null;
  branchVersionId: string | null;
  range: { from: string; to: string; dayCount: number };
  totals: {
    compared: number;
    matched: number;
    differed: number;
  };
  categories: Record<ParityDifferenceCategory, number>;
  samples: Array<{
    date: string;
    category: ParityDifferenceCategory;
    legacy: string;
    next: string;
  }>;
  unexplainedCount: number;
  runtimeMode: string | null;
  activatedShadow: boolean;
};

function assertEnvironmentGuards(options: ShadowCompareOptions) {
  const name = options.databaseName.toLowerCase();
  const looksProd =
    name.includes('prod') ||
    name.includes('production') ||
    options.databaseSchema.toLowerCase().includes('prod');
  if (looksProd && !options.allowProduction) {
    throw new Error(
      `Refusing production-like database "${options.databaseName}". Pass --allow-production to override.`,
    );
  }
}

async function loadVersionBundle(
  prisma: PrismaClient,
  calendarId: string,
  allowDraft: boolean,
) {
  const published = await prisma.businessCalendarVersion.findFirst({
    where: {
      calendarId,
      status: BusinessCalendarVersionStatus.PUBLISHED,
    },
    orderBy: { versionNumber: 'desc' },
    include: {
      workingWeekRules: true,
      events: { include: { targets: true } },
    },
  });
  if (published) return published;

  if (!allowDraft) return null;

  return prisma.businessCalendarVersion.findFirst({
    where: {
      calendarId,
      status: {
        in: [
          BusinessCalendarVersionStatus.DRAFT,
          BusinessCalendarVersionStatus.IN_REVIEW,
        ],
      },
      changeReason: 'Stage 5 legacy backfill',
    },
    orderBy: { versionNumber: 'desc' },
    include: {
      workingWeekRules: true,
      events: { include: { targets: true } },
    },
  });
}

function toRuntimeWeek(
  rules: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    dayPortion: RuntimeWeekRule['dayPortion'];
    ruleMode: string;
  }>,
): RuntimeWeekRule[] {
  return rules.map((rule) => ({
    dayOfWeek: rule.dayOfWeek,
    isWorkingDay: rule.isWorkingDay,
    dayPortion: rule.dayPortion,
    ruleMode: rule.ruleMode,
  }));
}

function toRuntimeEvents(
  events: Array<{
    id: string;
    eventName: string;
    startDate: Date;
    endDate: Date;
    businessDayEffect: RuntimeEvent['businessDayEffect'];
    paidHoliday: boolean;
    targets: Array<{
      targetType: string;
      companyId: string;
      branchId: string | null;
    }>;
  }>,
): RuntimeEvent[] {
  return events.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    startDate: event.startDate,
    endDate: event.endDate,
    businessDayEffect: event.businessDayEffect,
    paidHoliday: event.paidHoliday,
    targets: event.targets.map((target) => ({
      targetType: target.targetType,
      companyId: target.companyId,
      branchId: target.branchId,
    })),
  }));
}

/**
 * Shadow parity window: previous 12 months + current year remainder + next 18 months.
 * Implemented as: today-12m → today+18m (covers work-order intent in one bounded range).
 */
export function buildShadowCompareRange(today = new Date()): {
  from: Date;
  to: Date;
} {
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  start.setUTCMonth(start.getUTCMonth() - 12);
  const end = addMonthsUtc(
    new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    ),
    18,
  );
  return { from: start, to: end };
}

export async function runBusinessCalendarShadowCompare(
  prisma: PrismaClient,
  options: ShadowCompareOptions,
): Promise<ShadowParityReport> {
  assertEnvironmentGuards(options);

  const branch = await prisma.branch.findFirst({
    where: {
      id: options.branchId,
      companyId: options.companyId,
      isActive: true,
    },
    include: { workingDays: true },
  });
  if (!branch) {
    throw new Error('Branch not found for company');
  }

  const timezoneValid = !!(
    branch.timezone && isValidIanaTimeZone(branch.timezone)
  );

  const companyCalendar = await prisma.businessCalendar.findFirst({
    where: { companyId: options.companyId, scope: 'COMPANY', isActive: true },
  });
  const branchCalendar = await prisma.businessCalendar.findFirst({
    where: {
      companyId: options.companyId,
      branchId: options.branchId,
      scope: 'BRANCH',
      isActive: true,
    },
  });
  if (!companyCalendar || !branchCalendar) {
    throw new Error(
      'Company and Branch calendars must exist (run Stage 5 backfill first)',
    );
  }

  const companyVersion = await loadVersionBundle(
    prisma,
    companyCalendar.id,
    options.allowDraftVersions,
  );
  const branchVersion = await loadVersionBundle(
    prisma,
    branchCalendar.id,
    options.allowDraftVersions,
  );
  if (!companyVersion || !branchVersion) {
    throw new Error(
      'Missing company/branch versions for compare. Backfill drafts or publish first.',
    );
  }

  const hasCompanyWorkingWeek = companyVersion.workingWeekRules.length === 7;
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId: options.companyId,
      isActive: true,
      OR: [{ branchId: null }, { branchId: options.branchId }],
    },
  });

  const { from, to } = buildShadowCompareRange();
  const categories: Record<ParityDifferenceCategory, number> = {
    MISSING_TIMEZONE: 0,
    MISSING_COMPANY_WORKING_WEEK: 0,
    HOLIDAY_PRECEDENCE: 0,
    HALF_DAY_HANDLING: 0,
    INVALID_LEGACY_DATE: 0,
    LEGITIMATE_BRANCH_OVERRIDE: 0,
    STATUS_MISMATCH: 0,
    UNEXPLAINED: 0,
  };
  const samples: ShadowParityReport['samples'] = [];
  let matched = 0;
  let differed = 0;

  const companyWeek = toRuntimeWeek(companyVersion.workingWeekRules);
  const companyEvents = toRuntimeEvents(companyVersion.events);
  const branchWeek = toRuntimeWeek(branchVersion.workingWeekRules);
  const branchEvents = toRuntimeEvents(branchVersion.events);

  for (const businessDate of eachDateInclusive(from, to)) {
    const legacy = resolveLegacyBusinessDay({
      businessDate,
      companyId: options.companyId,
      branchId: options.branchId,
      workingDays: branch.workingDays,
      holidays,
    });

    const sourceChecksum = createHash('sha256')
      .update(
        [
          companyVersion.contentChecksum,
          branchVersion.contentChecksum,
          businessDate.toISOString().slice(0, 10),
        ].join('|'),
      )
      .digest('hex');

    const next = resolveBusinessDay({
      companyId: options.companyId,
      branchId: options.branchId,
      businessDate,
      companyWeekRules: companyWeek,
      companyEvents,
      branchWeekRules: branchWeek,
      branchEvents,
      sourceChecksum,
    });

    const same =
      legacy.dayStatus === next.dayStatus &&
      String(legacy.dayPortion) === String(next.dayPortion);

    if (same) {
      matched += 1;
      continue;
    }

    differed += 1;
    const category = categorizeParityDifference({
      legacy,
      next,
      hasCompanyWorkingWeek,
      timezoneValid,
      branchHasOverride: branchWeek.some(
        (rule) => rule.dayOfWeek === businessDate.getUTCDay(),
      ),
    });
    categories[category] += 1;
    if (samples.length < 40) {
      samples.push({
        date: businessDate.toISOString().slice(0, 10),
        category,
        legacy: `${legacy.dayStatus}/${legacy.dayPortion}/${legacy.reasonCode}`,
        next: `${next.dayStatus}/${next.dayPortion}/${next.reasonCode}`,
      });
    }
  }

  let activatedShadow = false;
  if (options.activateShadow) {
    if (categories.UNEXPLAINED > 0 || categories.STATUS_MISMATCH > 0) {
      throw new Error(
        `Cannot activate SHADOW while unexplained/status mismatches remain (unexplained=${categories.UNEXPLAINED}, status=${categories.STATUS_MISMATCH})`,
      );
    }
    await prisma.businessCalendar.updateMany({
      where: {
        id: { in: [companyCalendar.id, branchCalendar.id] },
      },
      data: {
        runtimeMode: BusinessCalendarRuntimeMode.SHADOW,
        updatedByUserId: options.actorUserId,
      },
    });
    await prisma.auditLog.create({
      data: {
        entityName: 'BusinessCalendarShadow',
        entityId: branchCalendar.id,
        action: 'STAGE5_ACTIVATE_SHADOW',
        newValue: {
          companyId: options.companyId,
          branchId: options.branchId,
          matched,
          differed,
        },
        userId: options.actorUserId,
      },
    });
    activatedShadow = true;
  }

  const report: ShadowParityReport = {
    companyId: options.companyId,
    branchId: options.branchId,
    timezoneValid,
    hasCompanyWorkingWeek,
    companyVersionId: companyVersion.id,
    branchVersionId: branchVersion.id,
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      dayCount: eachDateInclusive(from, to).length,
    },
    totals: {
      compared: matched + differed,
      matched,
      differed,
    },
    categories,
    samples,
    unexplainedCount: categories.UNEXPLAINED + categories.STATUS_MISMATCH,
    runtimeMode: activatedShadow
      ? BusinessCalendarRuntimeMode.SHADOW
      : branchCalendar.runtimeMode,
    activatedShadow,
  };

  if (options.reportPath) {
    writeFileSync(
      resolve(options.reportPath),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
  }

  return report;
}
