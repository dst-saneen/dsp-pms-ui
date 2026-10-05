import {
  BusinessCalendarRuleMode,
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

import {
  buildVersionChecksumPayload,
  computeVersionContentChecksum,
} from './business-calendar-checksum.util';
import { buildBusinessCalendarScopeKey } from './business-calendar-scope.util';
import { isValidIanaTimeZone } from './business-calendar-validators';
import { mapHolidayPortionToBusinessDayEffect } from './business-calendar-migration.util';

export type BackfillExpectedCounts = {
  companies: number;
  branches: number;
  workingDays: number;
  holidays: number;
};

export type BackfillOptions = {
  apply: boolean;
  expected: BackfillExpectedCounts;
  effectiveYear: number;
  actorUserId: string;
  companyId?: string;
  allowProduction: boolean;
  databaseName: string;
  databaseSchema: string;
};

export type BackfillPlanItem = {
  action: string;
  scope: string;
  detail: string;
  skipped?: boolean;
  reason?: string;
};

export type BackfillReport = {
  dryRun: boolean;
  databaseName: string;
  databaseSchema: string;
  effectiveYear: number;
  counts: BackfillExpectedCounts & {
    actualCompanies: number;
    actualBranches: number;
    actualWorkingDays: number;
    actualHolidays: number;
  };
  plan: BackfillPlanItem[];
  flags: {
    companyCalendarsNeedingWorkingWeek: string[];
    branchesSkippedMissingTimezone: string[];
    holidaysSkipped: string[];
  };
  applied: {
    calendarsCreated: number;
    versionsCreated: number;
    eventsCreated: number;
    weekRulesCreated: number;
  };
};

type Db = PrismaClient;

function parseDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function effectiveYearStart(year: number): Date {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('effectiveYear must be an integer between 2000 and 2100');
  }
  return new Date(Date.UTC(year, 0, 1));
}

export async function runBusinessCalendarBackfill(
  prisma: Db,
  options: BackfillOptions,
): Promise<BackfillReport> {
  assertEnvironmentGuards(options);
  const effectiveFrom = effectiveYearStart(options.effectiveYear);

  const companyWhere: Prisma.CompanyWhereInput = {
    isActive: true,
    ...(options.companyId ? { id: options.companyId } : {}),
  };

  const [companies, branches, workingDays, holidays] = await Promise.all([
    prisma.company.findMany({
      where: companyWhere,
      orderBy: { companyCode: 'asc' },
    }),
    prisma.branch.findMany({
      where: {
        isActive: true,
        ...(options.companyId ? { companyId: options.companyId } : {}),
      },
      include: { workingDays: true },
      orderBy: { branchCode: 'asc' },
    }),
    prisma.branchWorkingDay.count({
      where: options.companyId
        ? { branch: { companyId: options.companyId, isActive: true } }
        : { branch: { isActive: true } },
    }),
    prisma.holiday.count({
      where: {
        isActive: true,
        ...(options.companyId ? { companyId: options.companyId } : {}),
      },
    }),
  ]);

  if (companies.length !== options.expected.companies) {
    throw new Error(
      `Company count mismatch: expected ${options.expected.companies}, found ${companies.length}`,
    );
  }
  if (branches.length !== options.expected.branches) {
    throw new Error(
      `Branch count mismatch: expected ${options.expected.branches}, found ${branches.length}`,
    );
  }
  if (workingDays !== options.expected.workingDays) {
    throw new Error(
      `Working-day count mismatch: expected ${options.expected.workingDays}, found ${workingDays}`,
    );
  }
  if (holidays !== options.expected.holidays) {
    throw new Error(
      `Holiday count mismatch: expected ${options.expected.holidays}, found ${holidays}`,
    );
  }

  const [holidayType, companyCategory, migrationSource] = await Promise.all([
    prisma.businessCalendarEventType.findFirst({
      where: { scopeKey: 'GLOBAL:HOLIDAY' },
    }),
    prisma.businessCalendarEventCategory.findFirst({
      where: { scopeKey: 'GLOBAL:COMPANY' },
    }),
    prisma.businessCalendarEventSource.findFirst({
      where: { scopeKey: 'GLOBAL:MIGRATION' },
    }),
  ]);
  if (!holidayType || !companyCategory || !migrationSource) {
    throw new Error(
      'Missing seeded GLOBAL HOLIDAY/COMPANY/MIGRATION metadata. Apply Stage 1 migration first.',
    );
  }

  const plan: BackfillPlanItem[] = [];
  const flags = {
    companyCalendarsNeedingWorkingWeek: [] as string[],
    branchesSkippedMissingTimezone: [] as string[],
    holidaysSkipped: [] as string[],
  };
  const applied = {
    calendarsCreated: 0,
    versionsCreated: 0,
    eventsCreated: 0,
    weekRulesCreated: 0,
  };

  const activeHolidays = await prisma.holiday.findMany({
    where: {
      isActive: true,
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    orderBy: [{ holidayDate: 'asc' }, { holidayName: 'asc' }],
  });

  for (const company of companies) {
    const companyBranches = branches.filter((b) => b.companyId === company.id);
    const defaultTimezone =
      companyBranches.find((b) => b.timezone && isValidIanaTimeZone(b.timezone))
        ?.timezone ?? null;

    if (!defaultTimezone) {
      plan.push({
        action: 'SKIP_COMPANY_CALENDAR',
        scope: company.companyCode,
        detail: 'No valid branch IANA timezone available; will not guess',
        skipped: true,
        reason: 'MISSING_TIMEZONE',
      });
      flags.companyCalendarsNeedingWorkingWeek.push(company.companyCode);
      continue;
    }

    const companyScopeKey = buildBusinessCalendarScopeKey(
      BusinessCalendarScope.COMPANY,
      company.id,
    );
    let companyCalendar = await prisma.businessCalendar.findFirst({
      where: {
        OR: [
          { scopeKey: companyScopeKey },
          { companyId: company.id, scope: BusinessCalendarScope.COMPANY },
        ],
      },
    });

    let companyCalendarId: string | null = companyCalendar?.id ?? null;
    if (!companyCalendar) {
      plan.push({
        action: 'CREATE_COMPANY_CALENDAR',
        scope: company.companyCode,
        detail: `LEGACY calendar timezone=${defaultTimezone}`,
      });
      if (options.apply) {
        companyCalendar = await prisma.businessCalendar.create({
          data: {
            companyId: company.id,
            branchId: null,
            parentCalendarId: null,
            scope: BusinessCalendarScope.COMPANY,
            scopeKey: companyScopeKey,
            calendarCode: 'MAIN',
            calendarName: `${company.companyName} Calendar`,
            defaultTimezone,
            runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
            isActive: true,
            createdByUserId: options.actorUserId,
            updatedByUserId: options.actorUserId,
          },
        });
        companyCalendarId = companyCalendar.id;
        applied.calendarsCreated += 1;
      } else {
        companyCalendarId = `dry-run-company-${company.id}`;
      }
    } else {
      plan.push({
        action: 'SKIP_COMPANY_CALENDAR',
        scope: company.companyCode,
        detail: 'Already exists',
        skipped: true,
      });
    }

    if (!companyCalendarId) continue;

    const existingCompanyDraft =
      options.apply && companyCalendar
        ? await prisma.businessCalendarVersion.findFirst({
            where: {
              calendarId: companyCalendar.id,
              changeReason: 'Stage 5 legacy backfill',
              status: BusinessCalendarVersionStatus.DRAFT,
            },
            include: { workingWeekRules: true, events: true },
          })
        : null;

    let companyVersionId = existingCompanyDraft?.id;
    if (!existingCompanyDraft) {
      plan.push({
        action: 'CREATE_COMPANY_MIGRATION_DRAFT',
        scope: company.companyCode,
        detail:
          'Draft only — not published. Company working week NOT inferred from branches.',
      });
      flags.companyCalendarsNeedingWorkingWeek.push(company.companyCode);

      if (options.apply && companyCalendar) {
        const checksum = computeVersionContentChecksum(
          buildVersionChecksumPayload({
            effectiveFrom,
            effectiveTo: null,
            workingWeekRules: [],
            events: [],
          }),
        );
        const latest = await prisma.businessCalendarVersion.findFirst({
          where: { calendarId: companyCalendar.id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });
        const version = await prisma.businessCalendarVersion.create({
          data: {
            calendarId: companyCalendar.id,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            status: BusinessCalendarVersionStatus.DRAFT,
            effectiveFrom,
            effectiveTo: null,
            changeReason: 'Stage 5 legacy backfill',
            contentChecksum: checksum,
            createdByUserId: options.actorUserId,
          },
        });
        companyVersionId = version.id;
        applied.versionsCreated += 1;
      }
    } else {
      plan.push({
        action: 'SKIP_COMPANY_MIGRATION_DRAFT',
        scope: company.companyCode,
        detail: 'Backfill draft already exists',
        skipped: true,
      });
      if (existingCompanyDraft.workingWeekRules.length < 7) {
        flags.companyCalendarsNeedingWorkingWeek.push(company.companyCode);
      }
    }

    const companyHolidays = activeHolidays.filter(
      (h) => h.companyId === company.id && h.branchId == null,
    );
    for (const holiday of companyHolidays) {
      const already =
        options.apply && companyVersionId
          ? await prisma.businessCalendarEvent.findFirst({
              where: { legacyHolidayId: holiday.id },
            })
          : null;
      if (already) {
        plan.push({
          action: 'SKIP_COMPANY_HOLIDAY_EVENT',
          scope: company.companyCode,
          detail: holiday.holidayName,
          skipped: true,
        });
        continue;
      }
      plan.push({
        action: 'CREATE_COMPANY_HOLIDAY_EVENT',
        scope: company.companyCode,
        detail: `${holiday.holidayName} @ ${holiday.holidayDate.toISOString().slice(0, 10)}`,
      });
      if (options.apply && companyVersionId) {
        await prisma.businessCalendarEvent.create({
          data: {
            calendarVersionId: companyVersionId,
            companyId: company.id,
            eventTypeId: holidayType.id,
            eventCategoryId: companyCategory.id,
            eventSourceId: migrationSource.id,
            eventCode: holiday.holidayCode ?? undefined,
            eventName: holiday.holidayName,
            description: holiday.description,
            allDay: true,
            startDate: parseDateOnly(holiday.holidayDate),
            endDate: parseDateOnly(holiday.holidayDate),
            businessDayEffect: mapHolidayPortionToBusinessDayEffect(
              holiday.dayPortion,
            ),
            paidHoliday: true,
            isProtected: false,
            legacyHolidayId: holiday.id,
            createdByUserId: options.actorUserId,
            targets: {
              create: [
                {
                  targetType: 'COMPANY',
                  companyId: company.id,
                },
              ],
            },
          },
        });
        applied.eventsCreated += 1;
      }
    }

    for (const branch of companyBranches) {
      if (!branch.timezone || !isValidIanaTimeZone(branch.timezone)) {
        plan.push({
          action: 'SKIP_BRANCH_CALENDAR',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: `Invalid or missing timezone (${branch.timezone ?? 'null'})`,
          skipped: true,
          reason: 'MISSING_TIMEZONE',
        });
        flags.branchesSkippedMissingTimezone.push(
          `${company.companyCode}/${branch.branchCode}`,
        );
        continue;
      }

      const branchHolidays = activeHolidays.filter(
        (h) => h.companyId === company.id && h.branchId === branch.id,
      );

      if (!options.apply) {
        plan.push({
          action: 'CREATE_OR_SKIP_BRANCH_CALENDAR',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: `LEGACY timezone=${branch.timezone}`,
        });
        plan.push({
          action: 'CREATE_OR_SKIP_BRANCH_MIGRATION_DRAFT',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: `OVERRIDE rules from BranchWorkingDay (${branch.workingDays.length}); holidays=${branchHolidays.length}`,
        });
        continue;
      }

      const realCompanyCalendar = await prisma.businessCalendar.findFirst({
        where: { companyId: company.id, scope: BusinessCalendarScope.COMPANY },
      });
      if (!realCompanyCalendar) continue;

      const branchScopeKey = buildBusinessCalendarScopeKey(
        BusinessCalendarScope.BRANCH,
        branch.id,
      );
      let branchCalendar = await prisma.businessCalendar.findFirst({
        where: {
          OR: [
            { scopeKey: branchScopeKey },
            { branchId: branch.id, scope: BusinessCalendarScope.BRANCH },
          ],
        },
      });
      if (!branchCalendar) {
        plan.push({
          action: 'CREATE_BRANCH_CALENDAR',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: `LEGACY parent=${realCompanyCalendar.calendarCode}`,
        });
        branchCalendar = await prisma.businessCalendar.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            parentCalendarId: realCompanyCalendar.id,
            scope: BusinessCalendarScope.BRANCH,
            scopeKey: branchScopeKey,
            calendarCode:
              `BR_${branch.branchCode.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`.slice(
                0,
                40,
              ),
            calendarName: `${branch.branchName} Calendar`,
            defaultTimezone: branch.timezone,
            runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
            isActive: true,
            createdByUserId: options.actorUserId,
            updatedByUserId: options.actorUserId,
          },
        });
        applied.calendarsCreated += 1;
      } else {
        plan.push({
          action: 'SKIP_BRANCH_CALENDAR',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: 'Already exists',
          skipped: true,
        });
      }

      let branchDraft = await prisma.businessCalendarVersion.findFirst({
        where: {
          calendarId: branchCalendar.id,
          changeReason: 'Stage 5 legacy backfill',
          status: BusinessCalendarVersionStatus.DRAFT,
        },
      });
      if (!branchDraft) {
        plan.push({
          action: 'CREATE_BRANCH_MIGRATION_DRAFT',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: `OVERRIDE rules from BranchWorkingDay (${branch.workingDays.length})`,
        });
        const weekRules = branch.workingDays.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          ruleMode: BusinessCalendarRuleMode.OVERRIDE,
          isWorkingDay: day.isWorkingDay,
          dayPortion: day.dayPortion,
          reason: 'Migrated from BranchWorkingDay',
        }));
        const checksum = computeVersionContentChecksum(
          buildVersionChecksumPayload({
            effectiveFrom,
            effectiveTo: null,
            workingWeekRules: weekRules,
            events: [],
          }),
        );
        const latest = await prisma.businessCalendarVersion.findFirst({
          where: { calendarId: branchCalendar.id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });
        branchDraft = await prisma.businessCalendarVersion.create({
          data: {
            calendarId: branchCalendar.id,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            status: BusinessCalendarVersionStatus.DRAFT,
            effectiveFrom,
            effectiveTo: null,
            changeReason: 'Stage 5 legacy backfill',
            contentChecksum: checksum,
            createdByUserId: options.actorUserId,
            workingWeekRules: {
              create: weekRules.map((rule) => ({
                dayOfWeek: rule.dayOfWeek,
                ruleMode: rule.ruleMode,
                isWorkingDay: rule.isWorkingDay,
                dayPortion: rule.dayPortion,
                reason: rule.reason,
              })),
            },
          },
        });
        applied.versionsCreated += 1;
        applied.weekRulesCreated += weekRules.length;
      } else {
        plan.push({
          action: 'SKIP_BRANCH_MIGRATION_DRAFT',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: 'Backfill draft already exists',
          skipped: true,
        });
      }

      for (const holiday of branchHolidays) {
        const already = await prisma.businessCalendarEvent.findFirst({
          where: { legacyHolidayId: holiday.id },
        });
        if (already) {
          plan.push({
            action: 'SKIP_BRANCH_HOLIDAY_EVENT',
            scope: `${company.companyCode}/${branch.branchCode}`,
            detail: holiday.holidayName,
            skipped: true,
          });
          continue;
        }
        plan.push({
          action: 'CREATE_BRANCH_HOLIDAY_EVENT',
          scope: `${company.companyCode}/${branch.branchCode}`,
          detail: `${holiday.holidayName} @ ${holiday.holidayDate.toISOString().slice(0, 10)}`,
        });
        await prisma.businessCalendarEvent.create({
          data: {
            calendarVersionId: branchDraft.id,
            companyId: company.id,
            eventTypeId: holidayType.id,
            eventCategoryId: companyCategory.id,
            eventSourceId: migrationSource.id,
            eventCode: holiday.holidayCode ?? undefined,
            eventName: holiday.holidayName,
            description: holiday.description,
            allDay: true,
            startDate: parseDateOnly(holiday.holidayDate),
            endDate: parseDateOnly(holiday.holidayDate),
            businessDayEffect: mapHolidayPortionToBusinessDayEffect(
              holiday.dayPortion,
            ),
            paidHoliday: true,
            isProtected: false,
            legacyHolidayId: holiday.id,
            createdByUserId: options.actorUserId,
            targets: {
              create: [
                {
                  targetType: 'BRANCH',
                  companyId: company.id,
                  branchId: branch.id,
                },
              ],
            },
          },
        });
        applied.eventsCreated += 1;
      }
    }
  }

  // Refresh checksums for created drafts after events
  if (options.apply) {
    const drafts = await prisma.businessCalendarVersion.findMany({
      where: {
        changeReason: 'Stage 5 legacy backfill',
        status: BusinessCalendarVersionStatus.DRAFT,
        ...(options.companyId
          ? { calendar: { companyId: options.companyId } }
          : {}),
      },
      include: {
        workingWeekRules: true,
        events: { include: { targets: true } },
      },
    });
    for (const draft of drafts) {
      const checksum = computeVersionContentChecksum(
        buildVersionChecksumPayload({
          effectiveFrom: draft.effectiveFrom,
          effectiveTo: draft.effectiveTo,
          workingWeekRules: draft.workingWeekRules,
          events: draft.events,
        }),
      );
      if (checksum !== draft.contentChecksum) {
        await prisma.businessCalendarVersion.update({
          where: { id: draft.id },
          data: { contentChecksum: checksum },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        entityName: 'BusinessCalendarBackfill',
        entityId: options.companyId ?? 'ALL',
        action: 'STAGE5_BACKFILL_APPLY',
        newValue: {
          calendarsCreated: applied.calendarsCreated,
          versionsCreated: applied.versionsCreated,
          eventsCreated: applied.eventsCreated,
          weekRulesCreated: applied.weekRulesCreated,
          flags,
        },
        userId: options.actorUserId,
      },
    });
  }

  return {
    dryRun: !options.apply,
    databaseName: options.databaseName,
    databaseSchema: options.databaseSchema,
    effectiveYear: options.effectiveYear,
    counts: {
      ...options.expected,
      actualCompanies: companies.length,
      actualBranches: branches.length,
      actualWorkingDays: workingDays,
      actualHolidays: holidays,
    },
    plan,
    flags: {
      companyCalendarsNeedingWorkingWeek: [
        ...new Set(flags.companyCalendarsNeedingWorkingWeek),
      ],
      branchesSkippedMissingTimezone: flags.branchesSkippedMissingTimezone,
      holidaysSkipped: flags.holidaysSkipped,
    },
    applied,
  };
}

function assertEnvironmentGuards(options: BackfillOptions) {
  const name = options.databaseName.toLowerCase();
  const looksProd =
    name.includes('prod') ||
    name.includes('production') ||
    options.databaseSchema.toLowerCase().includes('prod');
  if (looksProd && !options.allowProduction) {
    throw new Error(
      `Refusing production-like database "${options.databaseName}" / schema "${options.databaseSchema}". Pass --allow-production to override.`,
    );
  }
}
