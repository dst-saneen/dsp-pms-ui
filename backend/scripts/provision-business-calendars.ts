/**
 * Stage 10 — guarded office calendar provision (dry-run by default).
 * Wraps Business Calendar ensure semantics via Prisma (no Nest DI).
 *
 * Usage:
 *   npx tsx scripts/provision-business-calendars.ts --company-id=<uuid> --actor-user-id=<uuid>
 *   ... --apply
 *
 * A Company Calendar timezone must be explicitly supplied with
 * --default-timezone unless every active Branch has the same valid timezone.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
} from '@prisma/client';

import { buildBusinessCalendarScopeKey } from '../src/modules/business-calendar/business-calendar-scope.util';
import {
  isOfficeLocationReady,
  isValidIanaTimeZone,
} from '../src/modules/business-calendar/business-calendar-validators';
import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  readRuntimeDatabaseIdentity,
} from './assert-destructive-db-guard';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function systemSourceId(): string {
  return createHash('md5')
    .update('business-calendar-event-source:GLOBAL:MANUAL')
    .digest('hex');
}

function resolveCompanyCalendarTimezone(
  requestedTimezone: string | undefined,
  branches: Array<{ branchCode: string; timezone: string | null }>,
): string {
  const requested = requestedTimezone?.trim();
  if (
    requestedTimezone !== undefined &&
    (!requested || !isValidIanaTimeZone(requested))
  ) {
    throw new Error('--default-timezone must be a valid IANA timezone');
  }
  if (requested) {
    return requested;
  }

  if (branches.length === 0) {
    throw new Error(
      '--default-timezone is required when no active Branch provides a timezone',
    );
  }

  const invalidBranches = branches.filter(
    (branch) =>
      !branch.timezone?.trim() || !isValidIanaTimeZone(branch.timezone.trim()),
  );
  if (invalidBranches.length > 0) {
    throw new Error(
      `--default-timezone is required because active Branch timezones are missing or invalid: ${invalidBranches.map((branch) => branch.branchCode).join(', ')}`,
    );
  }

  const configuredTimezones = [
    ...new Set(branches.map((branch) => branch.timezone!.trim())),
  ];
  if (configuredTimezones.length !== 1) {
    throw new Error(
      '--default-timezone is required because active Branches have different timezones',
    );
  }

  return configuredTimezones[0];
}

async function main() {
  const apply = flag('apply');
  const writeTarget = apply
    ? assertQaWriteEnvironment('migration:calendar:provision')
    : undefined;
  const allowProduction = flag('allow-production');
  const companyId = arg('company-id');
  const actorUserId = arg('actor-user-id');
  const requestedDefaultTimezone = arg('default-timezone');
  const reportPath =
    arg('report') ??
    resolve(
      process.cwd(),
      `../docs/product/business-calendar-stage-10-provision-report${apply ? '-applied' : '-dry-run'}.json`,
    );

  if (!companyId) throw new Error('--company-id=<uuid> is required');
  if (!actorUserId) throw new Error('--actor-user-id=<uuid> is required');

  const prismaClient = await createPrismaClient();
  const { prisma } = prismaClient;
  try {
    const runtimeTarget = await readRuntimeDatabaseIdentity(
      prisma,
      'migration:calendar:provision',
    );
    if (writeTarget) {
      await assertQaStagingSentinel(
        prisma,
        'migration:calendar:provision',
        writeTarget,
      );
    }
    const databaseName = runtimeTarget.databaseName;
    if (/prod|production/i.test(databaseName) && !allowProduction) {
      throw new Error(
        `Refusing production-like database "${databaseName}" without --allow-production`,
      );
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, isActive: true },
    });
    if (!company) throw new Error('Company not found or inactive');

    const branches = await prisma.branch.findMany({
      where: { companyId, isActive: true },
      orderBy: { branchCode: 'asc' },
    });

    const plan: Array<Record<string, unknown>> = [];
    const companyScope = buildBusinessCalendarScopeKey('COMPANY', companyId);
    const existingCompany = await prisma.businessCalendar.findFirst({
      where: { scopeKey: companyScope },
    });
    const companyCalendarTimezone = existingCompany
      ? existingCompany.defaultTimezone
      : resolveCompanyCalendarTimezone(requestedDefaultTimezone, branches);

    if (!existingCompany) {
      plan.push({
        action: 'CREATE_COMPANY_CALENDAR',
        companyId,
        calendarCode: 'MAIN',
        defaultTimezone: companyCalendarTimezone,
        runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
      });
      if (apply) {
        await prisma.businessCalendar.create({
          data: {
            companyId,
            branchId: null,
            parentCalendarId: null,
            scope: BusinessCalendarScope.COMPANY,
            scopeKey: companyScope,
            calendarCode: 'MAIN',
            calendarName: `${company.companyCode} Company Calendar`,
            defaultTimezone: companyCalendarTimezone,
            runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
            isActive: true,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      }
    } else {
      plan.push({
        action: 'KEEP_COMPANY_CALENDAR',
        calendarId: existingCompany.id,
        runtimeMode: existingCompany.runtimeMode,
      });
    }

    const parent =
      existingCompany ??
      (apply
        ? await prisma.businessCalendar.findFirstOrThrow({
            where: { scopeKey: companyScope },
          })
        : null);

    for (const branch of branches) {
      const branchTimezone = branch.timezone?.trim();
      const location = isOfficeLocationReady({
        countryCode: branch.countryCode,
        countrySubdivisionCode: branch.countrySubdivisionCode,
        timezone: branchTimezone,
      });
      const branchScope = buildBusinessCalendarScopeKey('BRANCH', branch.id);
      const existingBranch = await prisma.businessCalendar.findFirst({
        where: { scopeKey: branchScope },
      });
      if (existingBranch) {
        plan.push({
          action: 'KEEP_BRANCH_CALENDAR',
          branchId: branch.id,
          branchCode: branch.branchCode,
          calendarId: existingBranch.id,
          runtimeMode: existingBranch.runtimeMode,
          locationReady: location.ready,
        });
        continue;
      }

      plan.push({
        action: location.ready
          ? 'CREATE_BRANCH_CALENDAR'
          : 'SKIP_BRANCH_LOCATION_INCOMPLETE',
        branchId: branch.id,
        branchCode: branch.branchCode,
        timezone: branchTimezone,
        missing: location.missing,
        runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
      });

      if (apply && location.ready && parent && branchTimezone) {
        await prisma.businessCalendar.create({
          data: {
            companyId,
            branchId: branch.id,
            parentCalendarId: parent.id,
            scope: BusinessCalendarScope.BRANCH,
            scopeKey: branchScope,
            calendarCode: branch.branchCode,
            calendarName: `${branch.branchCode} Branch Calendar`,
            defaultTimezone: branchTimezone,
            runtimeMode: BusinessCalendarRuntimeMode.LEGACY,
            isActive: true,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      }
    }

    const report = {
      dryRun: !apply,
      databaseName,
      target: runtimeTarget,
      companyId,
      actorUserId,
      defaultTimezone: companyCalendarTimezone,
      plan,
      note: 'All new calendars stay LEGACY. Do not enable ACTIVE until Stage 5 shadow parity is approved.',
      systemSourceIdProbe: systemSourceId(),
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: !apply,
          target: runtimeTarget,
          reportPath,
          plannedCreates: plan.filter((p) =>
            String(p.action).startsWith('CREATE'),
          ).length,
          plannedSkips: plan.filter((p) => String(p.action).startsWith('SKIP'))
            .length,
        },
        null,
        2,
      ),
    );
  } finally {
    await prismaClient.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
