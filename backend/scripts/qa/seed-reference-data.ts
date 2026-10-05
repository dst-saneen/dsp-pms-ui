import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DayPortion, type Prisma } from '@prisma/client';

import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  readQaSchemaFingerprint,
} from '../assert-destructive-db-guard';
import { createPrismaClient } from '../create-prisma-client';
import {
  REFERENCE_DATA_CONTRACT,
  referenceDataContractFingerprint,
  validateReferenceDataContract,
} from './reference-data-contract';
import { buildReferenceMasterDataPlan } from './reference-master-data';
import { seedReferenceMasterData } from './reference-master-data-seeder';
import {
  buildReferencePersonaProvisioningPlan,
  readReferencePersonaPassword,
  seedReferencePersonas,
} from './reference-persona-seeder';

type SeedStats = { created: number; updated: number; unchanged: number };

function resolveGitExecutable(): string {
  const configured = process.env.GIT_BIN?.trim();
  if (configured) {
    return configured;
  }

  const windowsDefault = 'C:\\Program Files\\Git\\cmd\\git.exe';
  return process.platform === 'win32' && existsSync(windowsDefault)
    ? windowsDefault
    : 'git';
}

function changed<T extends object>(
  current: T,
  desired: Partial<Record<keyof T, unknown>>,
): boolean {
  return Object.entries(desired).some(([key, value]) => {
    const currentValue = current[key as keyof T];
    if (currentValue instanceof Date && value instanceof Date) {
      return currentValue.getTime() !== value.getTime();
    }
    return currentValue !== value;
  });
}

function record(stats: SeedStats, action: keyof SeedStats): void {
  stats[action] += 1;
}

async function seedOrganizationFoundation(
  tx: Prisma.TransactionClient,
): Promise<SeedStats> {
  const stats: SeedStats = { created: 0, updated: 0, unchanged: 0 };
  const groupIds = new Map<string, string>();
  const companyIds = new Map<string, string>();

  for (const definition of REFERENCE_DATA_CONTRACT.groups) {
    const existing = await tx.companyGroup.findUnique({
      where: { groupCode: definition.code },
      select: {
        id: true,
        groupName: true,
        description: true,
        isActive: true,
      },
    });
    const desired = {
      groupName: definition.name,
      description: 'Synthetic reference organization for QA only.',
      isActive: true,
    };
    if (!existing) {
      const created = await tx.companyGroup.create({
        data: {
          groupCode: definition.code,
          ...desired,
        },
        select: { id: true },
      });
      groupIds.set(definition.code, created.id);
      record(stats, 'created');
    } else {
      groupIds.set(definition.code, existing.id);
      if (changed(existing, desired)) {
        await tx.companyGroup.update({
          where: { id: existing.id },
          data: desired,
        });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }
  }

  for (const definition of REFERENCE_DATA_CONTRACT.companies) {
    const companyGroupId = groupIds.get(definition.groupCode);
    if (!companyGroupId) {
      throw new Error(`Missing seeded Company Group ${definition.groupCode}.`);
    }
    const existing = await tx.company.findUnique({
      where: { companyCode: definition.code },
      select: {
        id: true,
        companyName: true,
        companyGroupId: true,
        registrationNo: true,
        taxNumber: true,
        legalCountryCode: true,
        isActive: true,
      },
    });
    const desired = {
      companyName: definition.name,
      companyGroupId,
      registrationNo: `${definition.code}-SYNTHETIC`,
      taxNumber: `${definition.code}-QA-TAX`,
      legalCountryCode: definition.legalCountryCode,
      isActive: true,
    };
    if (!existing) {
      const created = await tx.company.create({
        data: {
          companyCode: definition.code,
          ...desired,
        },
        select: { id: true },
      });
      companyIds.set(definition.code, created.id);
      record(stats, 'created');
    } else {
      companyIds.set(definition.code, existing.id);
      if (changed(existing, desired)) {
        await tx.company.update({ where: { id: existing.id }, data: desired });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }
  }

  for (const definition of REFERENCE_DATA_CONTRACT.companies) {
    const companyId = companyIds.get(definition.code);
    if (!companyId) {
      throw new Error(`Missing seeded Company ${definition.code}.`);
    }

    const branchIds = new Map<string, string>();
    for (const branch of definition.branches) {
      const existing = await tx.branch.findUnique({
        where: {
          companyId_branchCode: { companyId, branchCode: branch.code },
        },
        select: {
          id: true,
          branchName: true,
          city: true,
          countryCode: true,
          countrySubdivisionCode: true,
          timezone: true,
          isActive: true,
          workingCalendarReviewedAt: true,
        },
      });
      const desired = {
        branchName: branch.name,
        city: branch.city,
        countryCode: branch.countryCode,
        countrySubdivisionCode: branch.subdivisionCode,
        timezone: branch.timezone,
        isActive: true,
        workingCalendarReviewedAt: new Date('2026-09-17T00:00:00.000Z'),
      };
      if (!existing) {
        const created = await tx.branch.create({
          data: {
            companyId,
            branchCode: branch.code,
            ...desired,
          },
          select: { id: true },
        });
        branchIds.set(branch.code, created.id);
        record(stats, 'created');
      } else {
        branchIds.set(branch.code, existing.id);
        const comparison = {
          branchName: desired.branchName,
          city: desired.city,
          countryCode: desired.countryCode,
          countrySubdivisionCode: desired.countrySubdivisionCode,
          timezone: desired.timezone,
          isActive: desired.isActive,
          workingCalendarReviewedAt: desired.workingCalendarReviewedAt,
        };
        if (changed(existing, comparison)) {
          await tx.branch.update({
            where: { id: existing.id },
            data: desired,
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }
    }

    for (const branch of definition.branches) {
      const branchId = branchIds.get(branch.code);
      if (!branchId) {
        throw new Error(`Missing seeded Branch ${branch.code}.`);
      }
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
        const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
        const existing = await tx.branchWorkingDay.findUnique({
          where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
          select: { id: true, isWorkingDay: true, dayPortion: true },
        });
        const desired = { isWorkingDay, dayPortion: DayPortion.FULL_DAY };
        if (!existing) {
          await tx.branchWorkingDay.create({
            data: { branchId, dayOfWeek, ...desired },
          });
          record(stats, 'created');
        } else if (changed(existing, desired)) {
          await tx.branchWorkingDay.update({
            where: { id: existing.id },
            data: desired,
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }

      for (const department of branch.departments) {
        const existing = await tx.department.findUnique({
          where: {
            branchId_departmentCode: {
              branchId,
              departmentCode: department.code,
            },
          },
          select: {
            id: true,
            companyId: true,
            departmentName: true,
            isActive: true,
          },
        });
        const desired = {
          companyId,
          departmentName: department.name,
          isActive: true,
        };
        if (!existing) {
          await tx.department.create({
            data: {
              companyId,
              branchId,
              departmentCode: department.code,
              departmentName: department.name,
              isActive: true,
            },
          });
          record(stats, 'created');
        } else if (changed(existing, desired)) {
          await tx.department.update({
            where: { id: existing.id },
            data: desired,
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }
    }

    for (const designation of definition.designations) {
      const existing = await tx.designation.findUnique({
        where: {
          companyId_designationCode: {
            companyId,
            designationCode: designation.code,
          },
        },
        select: {
          id: true,
          departmentId: true,
          designationName: true,
          isActive: true,
        },
      });
      const desired = {
        departmentId: null,
        designationName: designation.name,
        isActive: true,
      };
      if (!existing) {
        await tx.designation.create({
          data: {
            companyId,
            designationCode: designation.code,
            ...desired,
          },
        });
        record(stats, 'created');
      } else if (changed(existing, desired)) {
        await tx.designation.update({
          where: { id: existing.id },
          data: desired,
        });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }

    if (definition.groupCode === 'DSP-REF-QA') {
      const shifts = [
        {
          code: 'DAY-QA',
          name: 'Normal Day QA',
          startTime: '09:00',
          endTime: '18:00',
          isNightShift: false,
          isDefault: true,
        },
        {
          code: 'OVERNIGHT-QA',
          name: 'Overnight QA',
          startTime: '22:00',
          endTime: '07:00',
          isNightShift: true,
          isDefault: false,
        },
      ];
      for (const shift of shifts) {
        const existing = await tx.shift.findUnique({
          where: {
            companyId_shiftCode: { companyId, shiftCode: shift.code },
          },
          select: {
            id: true,
            shiftName: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
            graceInMinutes: true,
            graceOutMinutes: true,
            isNightShift: true,
            isDefault: true,
            isActive: true,
            remarks: true,
          },
        });
        const desired = {
          shiftName: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: 60,
          graceInMinutes: 15,
          graceOutMinutes: 15,
          isNightShift: shift.isNightShift,
          isDefault: shift.isDefault,
          isActive: true,
          remarks: 'Synthetic QA reference shift.',
        };
        const comparable = {
          shiftName: desired.shiftName,
          startTime: desired.startTime,
          endTime: desired.endTime,
          breakMinutes: desired.breakMinutes,
          graceInMinutes: desired.graceInMinutes,
          graceOutMinutes: desired.graceOutMinutes,
          isNightShift: desired.isNightShift,
          isDefault: desired.isDefault,
          isActive: desired.isActive,
          remarks: desired.remarks,
        };
        if (!existing) {
          await tx.shift.create({
            data: { companyId, shiftCode: shift.code, ...desired },
          });
          record(stats, 'created');
        } else if (changed(existing, comparable)) {
          await tx.shift.update({
            where: { id: existing.id },
            data: desired,
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }
    }
  }

  return stats;
}

async function main(): Promise<void> {
  validateReferenceDataContract();
  const contractFingerprint = referenceDataContractFingerprint();
  const masterDataPlan = buildReferenceMasterDataPlan();
  const personaPlan = buildReferencePersonaProvisioningPlan();
  const apply = process.argv.includes('--apply');
  const allowPersonaCredentialRotation = process.argv.includes(
    '--rotate-persona-credentials',
  );
  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'PLAN_ONLY',
          contractVersion: REFERENCE_DATA_CONTRACT.version,
          contractFingerprint,
          groups: REFERENCE_DATA_CONTRACT.groups.length,
          companies: REFERENCE_DATA_CONTRACT.companies.length,
          branches: REFERENCE_DATA_CONTRACT.companies.reduce(
            (total, company) => total + company.branches.length,
            0,
          ),
          personas: REFERENCE_DATA_CONTRACT.personas.length,
          personaProvisioning: {
            users: personaPlan.profiles.filter((profile) => profile.userRecord)
              .length,
            employees: personaPlan.profiles.filter(
              (profile) => profile.employeeRecord,
            ).length,
            customRoles: personaPlan.customRoles,
            departmentGrants: personaPlan.departmentGrants.length,
            credentialEnvironmentVariable:
              personaPlan.credentialEnvironmentVariable,
          },
          masterData: {
            seededLayers: masterDataPlan
              .filter((layer) => layer.mode === 'SEEDED')
              .map((layer) => ({ key: layer.key, itemCount: layer.itemCount })),
            contractOnlyLayers: masterDataPlan
              .filter((layer) => layer.mode === 'CONTRACT_ONLY')
              .map((layer) => ({
                key: layer.key,
                itemCount: layer.itemCount,
                reason: layer.reason,
              })),
          },
          note: 'No database connection was opened. Pass --apply only in the guarded staging environment.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const target = assertQaWriteEnvironment('seed-reference-data');
  const personaPassword = readReferencePersonaPassword();
  const databaseClient = await createPrismaClient();
  const { prisma } = databaseClient;
  try {
    await assertQaStagingSentinel(prisma, 'seed-reference-data', target);
    const schemaFingerprintBefore = await readQaSchemaFingerprint(prisma);
    const seedResult = await prisma.$transaction(
      async (tx) => {
        const organizationFoundation = await seedOrganizationFoundation(tx);
        const stableMasterData = await seedReferenceMasterData(tx);
        const stablePersonas = await seedReferencePersonas(
          tx,
          stableMasterData.actorUserId,
          personaPassword,
          { allowCredentialRotation: allowPersonaCredentialRotation },
        );
        return { organizationFoundation, stableMasterData, stablePersonas };
      },
      {
        isolationLevel: 'Serializable',
        maxWait: 10_000,
        timeout: 120_000,
      },
    );
    const schemaFingerprintAfter = await readQaSchemaFingerprint(prisma);
    if (schemaFingerprintBefore !== schemaFingerprintAfter) {
      throw new Error(
        'Reference seeding changed the schema structure; refusing to record success.',
      );
    }

    const gitCommit = execFileSync(
      resolveGitExecutable(),
      ['rev-parse', 'HEAD'],
      {
        cwd: resolve(process.cwd(), '..'),
        encoding: 'utf8',
      },
    ).trim();
    const evidence = {
      executedAt: new Date().toISOString(),
      gitCommit,
      target,
      contractFingerprint,
      schemaFingerprintBefore,
      schemaFingerprintAfter,
      stats: seedResult,
      zeroDataDriftOnRerun:
        seedResult.organizationFoundation.created === 0 &&
        seedResult.organizationFoundation.updated === 0 &&
        seedResult.stableMasterData.totals.created === 0 &&
        seedResult.stableMasterData.totals.updated === 0 &&
        seedResult.stablePersonas.totals.created === 0 &&
        seedResult.stablePersonas.totals.updated === 0,
      seededLayers: [
        'company-groups',
        'companies',
        'branches',
        'branch-working-week',
        'departments',
        'designations',
        'company-shifts',
        'qa-seed-audit-actor',
        'custom-roles-and-permissions',
        'stable-employees',
        'reporting-lines',
        'stable-users',
        'scoped-role-assignments',
        'department-asset-grants',
        ...masterDataPlan
          .filter((layer) => layer.mode === 'SEEDED')
          .map((layer) => layer.key),
      ],
      contractOnlyLayers: masterDataPlan
        .filter((layer) => layer.mode === 'CONTRACT_ONLY')
        .map((layer) => ({ key: layer.key, reason: layer.reason })),
    };
    const evidenceDirectory = resolve(
      process.cwd(),
      process.env.QA_EVIDENCE_DIR?.trim() || '.qa-runs',
    );
    mkdirSync(evidenceDirectory, { recursive: true });
    const evidencePath = resolve(
      evidenceDirectory,
      `reference-seed-${Date.now()}.json`,
    );
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    console.log(JSON.stringify({ ...evidence, evidencePath }, null, 2));
  } finally {
    await databaseClient.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
