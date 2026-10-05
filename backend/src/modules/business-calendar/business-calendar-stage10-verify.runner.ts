import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
} from '@prisma/client';

import {
  isOfficeLocationReady,
  isValidIanaTimeZone,
} from './business-calendar-validators';
import { buildBusinessCalendarScopeKey } from './business-calendar-scope.util';

export const STAGE10_REQUIRED_TABLES = [
  'business_calendars',
  'business_calendar_versions',
  'business_calendar_working_week_rules',
  'business_calendar_events',
  'business_calendar_event_targets',
  'business_calendar_runtime_days',
  'business_calendar_amendments',
  'business_calendar_impacts',
  'business_calendar_import_batches',
  'business_calendar_import_rows',
  'leave_request_calendar_days',
] as const;

export type Stage10OfficeReadiness = {
  companyId: string;
  companyCode: string;
  branchId: string | null;
  branchCode: string | null;
  scope: 'COMPANY' | 'BRANCH';
  timezoneOk: boolean;
  locationOk: boolean;
  calendarId: string | null;
  runtimeMode: BusinessCalendarRuntimeMode | null;
  readyForShadow: boolean;
  blockers: string[];
};

export type Stage10VerifyReport = {
  generatedAt: string;
  databaseName: string;
  databaseSchema: string;
  migrationPresent: boolean;
  missingTables: string[];
  permissionCodesPresent: string[];
  missingPermissionCodes: string[];
  calendars: {
    total: number;
    legacy: number;
    shadow: number;
    active: number;
  };
  offices: Stage10OfficeReadiness[];
  pilot?: {
    companyId?: string;
    branchId?: string;
    office?: Stage10OfficeReadiness | null;
  };
  ok: boolean;
  notes: string[];
};

const REQUIRED_PERMISSIONS = [
  'calendar.business.read',
  'calendar.business.manage',
  'calendar.business.review',
  'calendar.business.publish',
  'calendar.business.amend',
  'calendar.business.import',
  'calendar.business.runtime.preview',
  'calendar.business.protected-override',
];

type PrismaLike = {
  $queryRawUnsafe: <T = unknown>(
    query: string,
    ...values: unknown[]
  ) => Promise<T>;
  businessCalendar: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        companyId: string;
        branchId: string | null;
        scope: BusinessCalendarScope;
        runtimeMode: BusinessCalendarRuntimeMode;
        defaultTimezone: string;
        isActive: boolean;
        company: { id: string; companyCode: string };
        branch: {
          id: string;
          branchCode: string;
          timezone: string | null;
          countryCode: string | null;
          countrySubdivisionCode: string | null;
        } | null;
      }>
    >;
  };
  permission: {
    findMany: (args: unknown) => Promise<Array<{ code: string }>>;
  };
  company: {
    findMany: (
      args: unknown,
    ) => Promise<Array<{ id: string; companyCode: string; isActive: boolean }>>;
  };
  branch: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        companyId: string;
        branchCode: string;
        timezone: string | null;
        countryCode: string | null;
        countrySubdivisionCode: string | null;
        isActive: boolean;
      }>
    >;
  };
};

export async function runStage10Verify(
  prisma: PrismaLike,
  input: {
    databaseName: string;
    databaseSchema: string;
    companyId?: string;
    branchId?: string;
    allowProduction?: boolean;
  },
): Promise<Stage10VerifyReport> {
  const notes: string[] = [];
  const prodLike = /prod|production/i.test(input.databaseName);
  if (prodLike && !input.allowProduction) {
    notes.push(
      'Database name looks production-like. Re-run with --allow-production only after backup evidence.',
    );
  }

  const tableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'`,
    input.databaseSchema,
  );
  const present = new Set(tableRows.map((row) => row.table_name));
  const missingTables = STAGE10_REQUIRED_TABLES.filter(
    (name) => !present.has(name),
  );

  const migrationRows = await prisma
    .$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name
     FROM "_prisma_migrations"
     WHERE migration_name LIKE '%business_calendar_foundation%'
     ORDER BY finished_at DESC NULLS LAST
     LIMIT 5`,
    )
    .catch(() => [] as Array<{ migration_name: string }>);

  const permissions = await prisma.permission.findMany({
    where: { code: { in: REQUIRED_PERMISSIONS } },
    select: { code: true },
  });
  const permissionCodesPresent = permissions.map((p) => p.code);
  const missingPermissionCodes = REQUIRED_PERMISSIONS.filter(
    (code) => !permissionCodesPresent.includes(code),
  );

  const calendars = await prisma.businessCalendar.findMany({
    where: {
      isActive: true,
      ...(input.companyId ? { companyId: input.companyId } : {}),
    },
    include: {
      company: { select: { id: true, companyCode: true } },
      branch: {
        select: {
          id: true,
          branchCode: true,
          timezone: true,
          countryCode: true,
          countrySubdivisionCode: true,
        },
      },
    },
  });

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(input.companyId ? { id: input.companyId } : {}),
    },
    select: { id: true, companyCode: true, isActive: true },
  });
  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.branchId ? { id: input.branchId } : {}),
    },
    select: {
      id: true,
      companyId: true,
      branchCode: true,
      timezone: true,
      countryCode: true,
      countrySubdivisionCode: true,
      isActive: true,
    },
  });

  const calendarByScope = new Map(
    calendars.map((calendar) => [
      calendar.scope === BusinessCalendarScope.COMPANY
        ? buildBusinessCalendarScopeKey('COMPANY', calendar.companyId)
        : buildBusinessCalendarScopeKey('BRANCH', calendar.branchId ?? ''),
      calendar,
    ]),
  );

  const offices: Stage10OfficeReadiness[] = [];

  for (const company of companies) {
    const scopeKey = buildBusinessCalendarScopeKey('COMPANY', company.id);
    const calendar = calendarByScope.get(scopeKey) ?? null;
    const blockers: string[] = [];
    const timezoneOk = !!(
      calendar?.defaultTimezone && isValidIanaTimeZone(calendar.defaultTimezone)
    );
    if (!timezoneOk) blockers.push('MISSING_OR_INVALID_TIMEZONE');
    if (!calendar) blockers.push('MISSING_COMPANY_CALENDAR');
    if (calendar?.runtimeMode === BusinessCalendarRuntimeMode.ACTIVE) {
      blockers.push('ALREADY_ACTIVE');
    }
    offices.push({
      companyId: company.id,
      companyCode: company.companyCode,
      branchId: null,
      branchCode: null,
      scope: 'COMPANY',
      timezoneOk,
      locationOk: true,
      calendarId: calendar?.id ?? null,
      runtimeMode: calendar?.runtimeMode ?? null,
      readyForShadow:
        blockers.filter((b) => b !== 'ALREADY_ACTIVE').length === 0,
      blockers,
    });
  }

  for (const branch of branches) {
    const scopeKey = buildBusinessCalendarScopeKey('BRANCH', branch.id);
    const calendar = calendarByScope.get(scopeKey) ?? null;
    const location = isOfficeLocationReady({
      countryCode: branch.countryCode,
      countrySubdivisionCode: branch.countrySubdivisionCode,
      timezone: branch.timezone,
    });
    const locationOk = location.ready;
    const timezoneOk = !!(
      branch.timezone && isValidIanaTimeZone(branch.timezone)
    );
    const blockers: string[] = [];
    if (!timezoneOk) blockers.push('MISSING_OR_INVALID_TIMEZONE');
    if (!locationOk) {
      blockers.push(`MISSING_LOCATION:${location.missing.join(',')}`);
    }
    if (!calendar) blockers.push('MISSING_BRANCH_CALENDAR');
    if (
      !calendarByScope.has(
        buildBusinessCalendarScopeKey('COMPANY', branch.companyId),
      )
    ) {
      blockers.push('MISSING_PARENT_COMPANY_CALENDAR');
    }
    if (calendar?.runtimeMode === BusinessCalendarRuntimeMode.ACTIVE) {
      blockers.push('ALREADY_ACTIVE');
    }
    const company = companies.find((c) => c.id === branch.companyId);
    offices.push({
      companyId: branch.companyId,
      companyCode: company?.companyCode ?? branch.companyId,
      branchId: branch.id,
      branchCode: branch.branchCode,
      scope: 'BRANCH',
      timezoneOk,
      locationOk,
      calendarId: calendar?.id ?? null,
      runtimeMode: calendar?.runtimeMode ?? null,
      readyForShadow:
        blockers.filter((b) => b !== 'ALREADY_ACTIVE').length === 0,
      blockers,
    });
  }

  const pilotOffice =
    input.branchId != null
      ? (offices.find((o) => o.branchId === input.branchId) ?? null)
      : input.companyId != null
        ? (offices.find(
            (o) => o.companyId === input.companyId && o.scope === 'COMPANY',
          ) ?? null)
        : null;

  const report: Stage10VerifyReport = {
    generatedAt: new Date().toISOString(),
    databaseName: input.databaseName,
    databaseSchema: input.databaseSchema,
    migrationPresent: migrationRows.length > 0,
    missingTables,
    permissionCodesPresent,
    missingPermissionCodes,
    calendars: {
      total: calendars.length,
      legacy: calendars.filter(
        (c) => c.runtimeMode === BusinessCalendarRuntimeMode.LEGACY,
      ).length,
      shadow: calendars.filter(
        (c) => c.runtimeMode === BusinessCalendarRuntimeMode.SHADOW,
      ).length,
      active: calendars.filter(
        (c) => c.runtimeMode === BusinessCalendarRuntimeMode.ACTIVE,
      ).length,
    },
    offices,
    pilot: {
      companyId: input.companyId,
      branchId: input.branchId,
      office: pilotOffice,
    },
    ok:
      missingTables.length === 0 &&
      missingPermissionCodes.length === 0 &&
      (!prodLike || !!input.allowProduction),
    notes,
  };

  if (missingTables.length) {
    notes.push(`Missing tables: ${missingTables.join(', ')}`);
  }
  if (missingPermissionCodes.length) {
    notes.push(`Missing permissions: ${missingPermissionCodes.join(', ')}`);
  }
  if (!report.migrationPresent) {
    notes.push(
      'Foundation migration not found in _prisma_migrations (deploy migration first).',
    );
    report.ok = false;
  }

  return report;
}
