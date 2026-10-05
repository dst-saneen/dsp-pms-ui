import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
  BusinessPartyType,
  FinanceAccountType,
  FinanceCategoryType,
  FinancePeriodStatus,
  LeaveTypeCategory,
  Prisma,
  ProjectStatus,
  ProjectType,
  SalaryComponentType,
  UserStatus,
} from '@prisma/client';

import { REFERENCE_MASTER_DATA } from './reference-master-data';

export type SeedStats = {
  created: number;
  updated: number;
  unchanged: number;
};

export type ReferenceMasterSeedResult = {
  actorUserId: string;
  layers: Record<string, SeedStats>;
  totals: SeedStats;
};

// The live schema requires every non-INVITED User to have a non-null value.
// This deliberately invalid Argon2 marker can never authenticate, and the
// DISABLED status is rejected before password verification.
export const DISABLED_QA_ACTOR_PASSWORD_MARKER =
  '!QA-DISABLED-NO-CREDENTIAL-ARGON2-INVALID!';

const SEEDED_LAYER_KEYS = [
  'qa-seed-audit-actor',
  'financial-profiles-categories-accounts-and-open-periods',
  'salary-components',
  'leave-types-and-branch-policies',
  'workforce-approval-routes',
  'business-parties-and-baseline-projects',
  'asset-and-software-licence-baseline',
] as const;

type SeededLayerKey = (typeof SEEDED_LAYER_KEYS)[number];

function emptyStats(): SeedStats {
  return { created: 0, updated: 0, unchanged: 0 };
}

function createLayerStats(): Record<SeededLayerKey, SeedStats> {
  return Object.fromEntries(
    SEEDED_LAYER_KEYS.map((key) => [key, emptyStats()]),
  ) as Record<SeededLayerKey, SeedStats>;
}

function record(stats: SeedStats, action: keyof SeedStats): void {
  stats[action] += 1;
}

function hasEquals(
  value: unknown,
): value is { equals: (other: unknown) => boolean } {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { equals?: unknown };
  return typeof candidate.equals === 'function';
}

function valuesEqual(current: unknown, desired: unknown): boolean {
  if (current instanceof Date && desired instanceof Date) {
    return current.getTime() === desired.getTime();
  }
  if (hasEquals(current)) {
    return current.equals(desired);
  }
  return current === desired;
}

function changed<T extends object>(
  current: T,
  desired: Partial<Record<keyof T, unknown>>,
): boolean {
  return Object.entries(desired).some(
    ([key, value]) => !valuesEqual(current[key as keyof T], value),
  );
}

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function sumStats(values: ReadonlyArray<SeedStats>): SeedStats {
  return values.reduce(
    (total, value) => ({
      created: total.created + value.created,
      updated: total.updated + value.updated,
      unchanged: total.unchanged + value.unchanged,
    }),
    emptyStats(),
  );
}

async function requireCompany(
  tx: Prisma.TransactionClient,
  companyCode: string,
) {
  const company = await tx.company.findUnique({
    where: { companyCode },
    select: { id: true, companyCode: true },
  });
  if (!company) {
    throw new Error(`Missing seeded Company ${companyCode}.`);
  }
  return company;
}

async function requireBranch(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchCode: string,
) {
  const branch = await tx.branch.findUnique({
    where: { companyId_branchCode: { companyId, branchCode } },
    select: { id: true, companyId: true, branchCode: true },
  });
  if (!branch || branch.companyId !== companyId) {
    throw new Error(`Missing seeded Branch ${branchCode}.`);
  }
  return branch;
}

async function requireDepartment(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string,
  departmentCode: string,
) {
  const department = await tx.department.findUnique({
    where: { branchId_departmentCode: { branchId, departmentCode } },
    select: { id: true, companyId: true, branchId: true },
  });
  if (
    !department ||
    department.companyId !== companyId ||
    department.branchId !== branchId
  ) {
    throw new Error(`Missing seeded Department ${departmentCode}.`);
  }
  return department;
}

async function seedAuditActor(
  tx: Prisma.TransactionClient,
  stats: SeedStats,
): Promise<string> {
  const definition = REFERENCE_MASTER_DATA.seedActor;
  const normalizedUsername = definition.username.toLocaleLowerCase('en-US');
  const normalizedEmail = definition.email.toLocaleLowerCase('en-US');
  const existing = await tx.user.findUnique({
    where: { normalizedUsername },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      normalizedEmail: true,
      employeeId: true,
      passwordHash: true,
      status: true,
      mustChangePassword: true,
    },
  });
  const desired = {
    username: definition.username,
    displayName: definition.displayName,
    email: definition.email,
    normalizedEmail,
    passwordHash: DISABLED_QA_ACTOR_PASSWORD_MARKER,
    status: UserStatus.DISABLED,
    mustChangePassword: false,
  };
  if (!existing) {
    const created = await tx.user.create({
      data: {
        ...desired,
        normalizedUsername,
      },
      select: { id: true },
    });
    record(stats, 'created');
    return created.id;
  }
  if (
    existing.employeeId !== null ||
    existing.passwordHash !== DISABLED_QA_ACTOR_PASSWORD_MARKER ||
    (existing.normalizedEmail !== null &&
      existing.normalizedEmail !== normalizedEmail)
  ) {
    throw new Error(
      'QA reference seed actor collides with a login-capable or Employee-linked User.',
    );
  }
  if (changed(existing, desired)) {
    await tx.user.update({ where: { id: existing.id }, data: desired });
    record(stats, 'updated');
  } else {
    record(stats, 'unchanged');
  }
  return existing.id;
}

async function seedFinanceMasters(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  financeStats: SeedStats,
  partyStats: SeedStats,
): Promise<Map<string, string>> {
  const partyIds = new Map<string, string>();

  for (const definition of REFERENCE_MASTER_DATA.finance) {
    const company = await requireCompany(tx, definition.companyCode);
    const categoryIds = new Map<string, string>();

    for (const category of definition.categories) {
      const existing = await tx.financeCategory.findUnique({
        where: {
          companyId_categoryCode: {
            companyId: company.id,
            categoryCode: category.code,
          },
        },
        select: {
          id: true,
          categoryName: true,
          categoryType: true,
          description: true,
          isActive: true,
          archivedAt: true,
          archiveReason: true,
          updatedByUserId: true,
        },
      });
      const desired = {
        categoryName: category.name,
        categoryType: category.type as FinanceCategoryType,
        description: 'Synthetic QA reference Finance category.',
        isActive: true,
        archivedAt: null,
        archiveReason: null,
        updatedByUserId: actorUserId,
      };
      if (!existing) {
        const created = await tx.financeCategory.create({
          data: {
            companyId: company.id,
            categoryCode: category.code,
            ...desired,
            createdByUserId: actorUserId,
          },
          select: { id: true },
        });
        categoryIds.set(category.code, created.id);
        record(financeStats, 'created');
      } else {
        categoryIds.set(category.code, existing.id);
        if (changed(existing, desired)) {
          await tx.financeCategory.update({
            where: { id: existing.id },
            data: { ...desired, version: { increment: 1 } },
          });
          record(financeStats, 'updated');
        } else {
          record(financeStats, 'unchanged');
        }
      }
    }

    const payrollExpenseCategoryId = categoryIds.get(
      definition.payrollExpenseCategoryCode,
    );
    if (!payrollExpenseCategoryId) {
      throw new Error(
        `Missing Payroll expense category ${definition.payrollExpenseCategoryCode}.`,
      );
    }
    const profile = await tx.companyFinancialProfile.findUnique({
      where: { companyId: company.id },
      select: {
        id: true,
        baseCurrencyCode: true,
        reportingStartDate: true,
        payrollExpenseCategoryId: true,
        updatedByUserId: true,
      },
    });
    const desiredProfile = {
      baseCurrencyCode: definition.baseCurrencyCode,
      reportingStartDate: asDate(definition.reportingStartDate),
      payrollExpenseCategoryId,
      updatedByUserId: actorUserId,
    };
    if (!profile) {
      await tx.companyFinancialProfile.create({
        data: {
          companyId: company.id,
          ...desiredProfile,
          createdByUserId: actorUserId,
        },
      });
      record(financeStats, 'created');
    } else if (changed(profile, desiredProfile)) {
      if (profile.baseCurrencyCode !== definition.baseCurrencyCode) {
        const transactionCount = await tx.financeTransaction.count({
          where: { companyId: company.id },
        });
        if (transactionCount > 0) {
          throw new Error(
            `${definition.companyCode} Finance currency cannot be reconciled after transactions exist.`,
          );
        }
      }
      await tx.companyFinancialProfile.update({
        where: { companyId: company.id },
        data: { ...desiredProfile, version: { increment: 1 } },
      });
      record(financeStats, 'updated');
    } else {
      record(financeStats, 'unchanged');
    }

    for (const account of definition.accounts) {
      const existing = await tx.financePaymentAccount.findUnique({
        where: {
          companyId_accountCode: {
            companyId: company.id,
            accountCode: account.code,
          },
        },
        select: {
          id: true,
          accountName: true,
          accountType: true,
          currencyCode: true,
          openingBalance: true,
          openingDate: true,
          bankName: true,
          isActive: true,
          archivedAt: true,
          archiveReason: true,
          updatedByUserId: true,
        },
      });
      const desired = {
        accountName: account.name,
        accountType: account.type as FinanceAccountType,
        currencyCode: definition.baseCurrencyCode,
        openingBalance: new Prisma.Decimal(0),
        openingDate: asDate(account.openingDate),
        bankName:
          account.type === 'BANK'
            ? 'Synthetic QA Bank'
            : (null as string | null),
        isActive: true,
        archivedAt: null,
        archiveReason: null,
        updatedByUserId: actorUserId,
      };
      if (!existing) {
        await tx.financePaymentAccount.create({
          data: {
            companyId: company.id,
            branchId: null,
            accountCode: account.code,
            ...desired,
            createdByUserId: actorUserId,
          },
        });
        record(financeStats, 'created');
      } else if (changed(existing, desired)) {
        if (existing.currencyCode !== definition.baseCurrencyCode) {
          const transactionCount = await tx.financeTransaction.count({
            where: {
              companyId: company.id,
              OR: [
                { sourceAccountId: existing.id },
                { destinationAccountId: existing.id },
              ],
            },
          });
          if (transactionCount > 0) {
            throw new Error(
              `${account.code} currency cannot be reconciled after transactions exist.`,
            );
          }
        }
        await tx.financePaymentAccount.update({
          where: { id: existing.id },
          data: { ...desired, version: { increment: 1 } },
        });
        record(financeStats, 'updated');
      } else {
        record(financeStats, 'unchanged');
      }
    }

    for (const period of definition.periods) {
      const existing = await tx.financePeriod.findUnique({
        where: {
          companyId_periodYear_periodMonth: {
            companyId: company.id,
            periodYear: period.year,
            periodMonth: period.month,
          },
        },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
        },
      });
      const desired = {
        periodStart: asDate(period.startDate),
        periodEnd: asDate(period.endDate),
        status: FinancePeriodStatus.OPEN,
      };
      if (!existing) {
        await tx.financePeriod.create({
          data: {
            companyId: company.id,
            periodYear: period.year,
            periodMonth: period.month,
            ...desired,
            createdByUserId: actorUserId,
          },
        });
        record(financeStats, 'created');
      } else if (existing.status !== FinancePeriodStatus.OPEN) {
        throw new Error(
          `${definition.companyCode} ${period.year}-${String(period.month).padStart(2, '0')} is not OPEN; the reference seeder will not bypass the period workflow.`,
        );
      } else if (changed(existing, desired)) {
        await tx.financePeriod.update({
          where: { id: existing.id },
          data: { ...desired, version: { increment: 1 } },
        });
        record(financeStats, 'updated');
      } else {
        record(financeStats, 'unchanged');
      }
    }

    for (const party of definition.parties) {
      const existing = await tx.businessParty.findUnique({
        where: {
          companyId_partyCode: {
            companyId: company.id,
            partyCode: party.code,
          },
        },
        select: {
          id: true,
          normalizedName: true,
          displayName: true,
          partyType: true,
          isActive: true,
          archivedAt: true,
          archiveReason: true,
          updatedByUserId: true,
        },
      });
      const desired = {
        normalizedName: party.name.trim().replace(/\s+/g, ' ').toUpperCase(),
        displayName: party.name,
        partyType: party.type as BusinessPartyType,
        isActive: true,
        archivedAt: null,
        archiveReason: null,
        updatedByUserId: actorUserId,
      };
      if (!existing) {
        const created = await tx.businessParty.create({
          data: {
            companyId: company.id,
            partyCode: party.code,
            ...desired,
            createdByUserId: actorUserId,
          },
          select: { id: true },
        });
        partyIds.set(`${definition.companyCode}:${party.code}`, created.id);
        record(partyStats, 'created');
      } else {
        partyIds.set(`${definition.companyCode}:${party.code}`, existing.id);
        if (changed(existing, desired)) {
          await tx.businessParty.update({
            where: { id: existing.id },
            data: { ...desired, version: { increment: 1 } },
          });
          record(partyStats, 'updated');
        } else {
          record(partyStats, 'unchanged');
        }
      }
    }
  }

  return partyIds;
}

async function seedSalaryComponents(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  stats: SeedStats,
): Promise<void> {
  for (const definition of REFERENCE_MASTER_DATA.salaryComponents) {
    const company = await requireCompany(tx, definition.companyCode);
    for (const component of definition.components) {
      const existing = await tx.salaryComponent.findUnique({
        where: {
          companyId_componentCode: {
            companyId: company.id,
            componentCode: component.code,
          },
        },
        select: {
          id: true,
          componentName: true,
          componentType: true,
          componentTypeEnum: true,
          description: true,
          isActive: true,
          archivedAt: true,
          archiveReason: true,
          updatedByUserId: true,
        },
      });
      const componentType = component.type as SalaryComponentType;
      const desired = {
        componentName: component.name,
        componentType,
        componentTypeEnum: componentType,
        description: 'Synthetic QA reference Salary component.',
        isActive: true,
        archivedAt: null,
        archiveReason: null,
        updatedByUserId: actorUserId,
      };
      if (!existing) {
        await tx.salaryComponent.create({
          data: {
            companyId: company.id,
            componentCode: component.code,
            ...desired,
            createdByUserId: actorUserId,
          },
        });
        record(stats, 'created');
      } else if (changed(existing, desired)) {
        await tx.salaryComponent.update({
          where: { id: existing.id },
          data: { ...desired, version: { increment: 1 } },
        });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }
  }
}

async function seedLeaveMasters(
  tx: Prisma.TransactionClient,
  stats: SeedStats,
): Promise<void> {
  for (const definition of REFERENCE_MASTER_DATA.leave) {
    const company = await requireCompany(tx, definition.companyCode);
    const branches = await Promise.all(
      definition.branchCodes.map((branchCode) =>
        requireBranch(tx, company.id, branchCode),
      ),
    );

    for (const type of definition.types) {
      const existing = await tx.leaveType.findUnique({
        where: {
          companyId_leaveCode: {
            companyId: company.id,
            leaveCode: type.code,
          },
        },
        select: {
          id: true,
          leaveName: true,
          description: true,
          isPaid: true,
          requiresApproval: true,
          allowHalfDay: true,
          isActive: true,
          carryForwardAllowed: true,
          category: true,
        },
      });
      const desired = {
        leaveName: type.name,
        description: 'Synthetic QA reference Leave Type.',
        isPaid: type.paid,
        requiresApproval: true,
        allowHalfDay: type.halfDay,
        isActive: true,
        carryForwardAllowed: type.carryForward,
        category: type.category as LeaveTypeCategory,
      };
      let leaveTypeId: string;
      if (!existing) {
        const created = await tx.leaveType.create({
          data: {
            companyId: company.id,
            leaveCode: type.code,
            ...desired,
          },
          select: { id: true },
        });
        leaveTypeId = created.id;
        record(stats, 'created');
      } else {
        leaveTypeId = existing.id;
        if (changed(existing, desired)) {
          await tx.leaveType.update({
            where: { id: existing.id },
            data: desired,
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }

      if (type.annualEntitlement === null) {
        continue;
      }
      for (const branch of branches) {
        if (branch.companyId !== company.id) {
          throw new Error(
            `${branch.branchCode} is outside ${definition.companyCode}.`,
          );
        }
        const matches = await tx.leavePolicy.findMany({
          where: {
            companyId: company.id,
            branchId: branch.id,
            departmentId: null,
            designationId: null,
            leaveTypeId,
          },
          select: {
            id: true,
            annualEntitlement: true,
            carryForwardLimit: true,
            maxConsecutiveDays: true,
            allowNegativeBalance: true,
            maximumNegativeBalance: true,
            accrualMethod: true,
            accrualRate: true,
            accrualWorkingDays: true,
            carryForwardExpiryMonths: true,
            isActive: true,
          },
          take: 2,
        });
        if (matches.length > 1) {
          throw new Error(
            `${definition.companyCode}/${branch.branchCode}/${type.code} has duplicate nullable-scope Leave Policies.`,
          );
        }
        const desiredPolicy = {
          annualEntitlement: new Prisma.Decimal(type.annualEntitlement),
          carryForwardLimit:
            type.carryForwardLimit === null
              ? null
              : new Prisma.Decimal(type.carryForwardLimit),
          maxConsecutiveDays: null,
          allowNegativeBalance: type.category === 'UNPAID',
          maximumNegativeBalance:
            type.category === 'UNPAID' ? new Prisma.Decimal(365) : null,
          accrualMethod: 'YEARLY',
          accrualRate: null,
          accrualWorkingDays: null,
          carryForwardExpiryMonths: type.carryForward ? 3 : null,
          isActive: true,
        };
        const policy = matches[0];
        if (!policy) {
          await tx.leavePolicy.create({
            data: {
              companyId: company.id,
              branchId: branch.id,
              departmentId: null,
              designationId: null,
              leaveTypeId,
              ...desiredPolicy,
            },
          });
          record(stats, 'created');
        } else if (changed(policy, desiredPolicy)) {
          await tx.leavePolicy.update({
            where: { id: policy.id },
            data: desiredPolicy,
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }
    }
  }
}

async function seedApprovalRoutes(
  tx: Prisma.TransactionClient,
  stats: SeedStats,
): Promise<void> {
  for (const definition of REFERENCE_MASTER_DATA.approvalWorkflows) {
    const company = await requireCompany(tx, definition.companyCode);
    const scopeKey = `COMPANY:${company.id}:${definition.workflowCode}`;
    const existing = await tx.approvalWorkflow.findUnique({
      where: { scopeKey },
      select: {
        id: true,
        companyId: true,
        workflowCode: true,
        workflowName: true,
        isActive: true,
      },
    });
    const desired = {
      companyId: company.id,
      workflowCode: definition.workflowCode,
      workflowName: definition.workflowName,
      isActive: true,
    };
    let workflowId: string;
    if (!existing) {
      const created = await tx.approvalWorkflow.create({
        data: { scopeKey, ...desired },
        select: { id: true },
      });
      workflowId = created.id;
      record(stats, 'created');
    } else {
      workflowId = existing.id;
      if (changed(existing, desired)) {
        await tx.approvalWorkflow.update({
          where: { id: existing.id },
          data: desired,
        });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }

    const existingSteps = await tx.approvalWorkflowStep.findMany({
      where: { workflowId },
      select: {
        id: true,
        stepNo: true,
        approverType: true,
        approverRole: true,
      },
      orderBy: { stepNo: 'asc' },
    });
    const expectedNumbers = new Set(
      definition.steps.map((step) => step.stepNo),
    );
    const unexpected = existingSteps.filter(
      (step) => !expectedNumbers.has(step.stepNo),
    );
    if (unexpected.length > 0) {
      throw new Error(
        `${definition.companyCode} ${definition.workflowCode} has unexpected steps; the reference seeder will not delete workflow history.`,
      );
    }
    for (const step of definition.steps) {
      const current = existingSteps.find(
        (candidate) => candidate.stepNo === step.stepNo,
      );
      const desiredStep = {
        approverType: step.approverType,
        approverRole: step.approverRole,
      };
      if (!current) {
        await tx.approvalWorkflowStep.create({
          data: { workflowId, stepNo: step.stepNo, ...desiredStep },
        });
        record(stats, 'created');
      } else if (changed(current, desiredStep)) {
        await tx.approvalWorkflowStep.update({
          where: { id: current.id },
          data: desiredStep,
        });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }
  }
}

async function seedProjects(
  tx: Prisma.TransactionClient,
  partyIds: ReadonlyMap<string, string>,
  stats: SeedStats,
): Promise<void> {
  for (const definition of REFERENCE_MASTER_DATA.projects) {
    const company = await requireCompany(tx, definition.companyCode);
    const branch = await requireBranch(tx, company.id, definition.branchCode);
    const businessPartyId = definition.partyCode
      ? partyIds.get(`${definition.companyCode}:${definition.partyCode}`)
      : null;
    if (definition.partyCode && !businessPartyId) {
      throw new Error(`Missing seeded Business Party ${definition.partyCode}.`);
    }
    const existing = await tx.project.findUnique({
      where: {
        companyId_projectCode: {
          companyId: company.id,
          projectCode: definition.code,
        },
      },
      select: {
        id: true,
        projectName: true,
        description: true,
        businessPartyId: true,
        branchId: true,
        startDate: true,
        endDate: true,
        projectType: true,
        currency: true,
        currencyCode: true,
        expectedIncome: true,
        expenseBudget: true,
        status: true,
        statusV2: true,
      },
    });
    const desired = {
      projectName: definition.name,
      description: 'Synthetic QA reference Project. Do not use for live work.',
      businessPartyId,
      branchId: branch.id,
      startDate: asDate(definition.startDate),
      endDate: asDate(definition.endDate),
      projectType: definition.projectType as ProjectType,
      currency: definition.currencyCode,
      currencyCode: definition.currencyCode,
      expectedIncome:
        definition.expectedIncome === null
          ? null
          : new Prisma.Decimal(definition.expectedIncome),
      expenseBudget: new Prisma.Decimal(definition.expenseBudget),
      status: 'DRAFT',
      statusV2: ProjectStatus.DRAFT,
    };
    if (!existing) {
      await tx.project.create({
        data: {
          companyId: company.id,
          projectCode: definition.code,
          ...desired,
        },
      });
      record(stats, 'created');
    } else {
      if (
        existing.status !== 'DRAFT' ||
        existing.statusV2 !== ProjectStatus.DRAFT
      ) {
        throw new Error(
          `${definition.code} left DRAFT; the reference seeder will not reset Project workflow state.`,
        );
      }
      if (changed(existing, desired)) {
        await tx.project.update({
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

async function seedAssetBaseline(
  tx: Prisma.TransactionClient,
  stats: SeedStats,
): Promise<void> {
  for (const definition of REFERENCE_MASTER_DATA.assets) {
    const company = await requireCompany(tx, definition.companyCode);
    const branch = await requireBranch(tx, company.id, definition.branchCode);
    const department = await requireDepartment(
      tx,
      company.id,
      branch.id,
      definition.departmentCode,
    );
    const categoryIds = new Map<string, string>();
    for (const category of definition.categories) {
      const existing = await tx.assetCategory.findUnique({
        where: {
          companyId_assetCategoryCode: {
            companyId: company.id,
            assetCategoryCode: category.code,
          },
        },
        select: {
          id: true,
          assetCategoryName: true,
          description: true,
          isActive: true,
          archivedAt: true,
        },
      });
      const desired = {
        assetCategoryName: category.name,
        description: 'Synthetic QA reference Asset Category.',
        isActive: true,
        archivedAt: null,
      };
      if (!existing) {
        const created = await tx.assetCategory.create({
          data: {
            companyId: company.id,
            assetCategoryCode: category.code,
            ...desired,
          },
          select: { id: true },
        });
        categoryIds.set(category.code, created.id);
        record(stats, 'created');
      } else {
        categoryIds.set(category.code, existing.id);
        if (changed(existing, desired)) {
          await tx.assetCategory.update({
            where: { id: existing.id },
            data: { ...desired, version: { increment: 1 } },
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }
    }

    const typeRows = new Map<
      string,
      { id: string; kind: AssetKind; trackingMode: AssetTrackingMode }
    >();
    for (const type of definition.types) {
      const assetCategoryId = categoryIds.get(type.categoryCode);
      if (!assetCategoryId) {
        throw new Error(`Missing seeded Asset Category ${type.categoryCode}.`);
      }
      const kind = type.kind as AssetKind;
      const trackingMode = type.trackingMode as AssetTrackingMode;
      const existing = await tx.assetType.findUnique({
        where: {
          companyId_assetTypeCode: {
            companyId: company.id,
            assetTypeCode: type.code,
          },
        },
        select: {
          id: true,
          assetCategoryId: true,
          assetTypeName: true,
          description: true,
          kind: true,
          trackingMode: true,
          isActive: true,
          archivedAt: true,
        },
      });
      const desired = {
        assetCategoryId,
        assetTypeName: type.name,
        description: 'Synthetic QA reference Asset Type.',
        kind,
        trackingMode,
        isActive: true,
        archivedAt: null,
      };
      let assetTypeId: string;
      if (!existing) {
        const created = await tx.assetType.create({
          data: {
            companyId: company.id,
            assetTypeCode: type.code,
            ...desired,
          },
          select: { id: true },
        });
        assetTypeId = created.id;
        record(stats, 'created');
      } else {
        assetTypeId = existing.id;
        if (changed(existing, desired)) {
          await tx.assetType.update({
            where: { id: existing.id },
            data: { ...desired, version: { increment: 1 } },
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }
      typeRows.set(type.code, { id: assetTypeId, kind, trackingMode });
    }

    for (const inventory of definition.inventory) {
      const type = typeRows.get(inventory.typeCode);
      if (!type) {
        throw new Error(`Missing seeded Asset Type ${inventory.typeCode}.`);
      }
      const existing = await tx.asset.findUnique({
        where: {
          companyId_assetCode: {
            companyId: company.id,
            assetCode: inventory.code,
          },
        },
        select: {
          id: true,
          branchId: true,
          departmentId: true,
          assetName: true,
          assetTypeId: true,
          kind: true,
          trackingMode: true,
          serialNumber: true,
          serialNumberNormalized: true,
          location: true,
          remarks: true,
          status: true,
          lifecycleStatus: true,
          isActive: true,
          archivedAt: true,
        },
      });
      const desired = {
        branchId: branch.id,
        departmentId: department.id,
        assetName: inventory.name,
        assetTypeId: type.id,
        kind: type.kind,
        trackingMode: type.trackingMode,
        serialNumber: inventory.serialNumber,
        serialNumberNormalized: inventory.serialNumber?.toUpperCase() ?? null,
        location: inventory.location,
        remarks: 'Synthetic QA reference Asset. Do not assign outside QA.',
        status: 'AVAILABLE',
        lifecycleStatus: AssetLifecycleStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
      };
      let assetId: string;
      if (!existing) {
        const created = await tx.asset.create({
          data: {
            companyId: company.id,
            assetCode: inventory.code,
            ...desired,
          },
          select: { id: true },
        });
        assetId = created.id;
        record(stats, 'created');
      } else {
        assetId = existing.id;
        if (
          existing.status !== 'AVAILABLE' ||
          existing.lifecycleStatus !== AssetLifecycleStatus.ACTIVE
        ) {
          throw new Error(
            `${inventory.code} is not available and active; the reference seeder will not reset Asset workflow state.`,
          );
        }
        if (changed(existing, desired)) {
          await tx.asset.update({
            where: { id: existing.id },
            data: { ...desired, version: { increment: 1 } },
          });
          record(stats, 'updated');
        } else {
          record(stats, 'unchanged');
        }
      }

      if (inventory.softwareLicense) {
        const existingDetail = await tx.assetSoftwareLicenseDetail.findUnique({
          where: { assetId },
          select: {
            assetId: true,
            companyId: true,
            vendorName: true,
            productName: true,
            contractReference: true,
            seatCapacity: true,
            allocatedSeatCount: true,
          },
        });
        const desiredDetail = {
          companyId: company.id,
          vendorName: inventory.softwareLicense.vendorName,
          productName: inventory.softwareLicense.productName,
          contractReference: inventory.softwareLicense.contractReference,
          seatCapacity: inventory.softwareLicense.seatCapacity,
          allocatedSeatCount: 0,
        };
        if (!existingDetail) {
          await tx.assetSoftwareLicenseDetail.create({
            data: { assetId, ...desiredDetail },
          });
          record(stats, 'created');
        } else {
          if (existingDetail.allocatedSeatCount !== 0) {
            throw new Error(
              `${inventory.code} has active allocations; the reference seeder will not reset licence occupancy.`,
            );
          }
          if (changed(existingDetail, desiredDetail)) {
            await tx.assetSoftwareLicenseDetail.update({
              where: { assetId },
              data: desiredDetail,
            });
            record(stats, 'updated');
          } else {
            record(stats, 'unchanged');
          }
        }
      }
    }
  }
}

export async function seedReferenceMasterData(
  tx: Prisma.TransactionClient,
): Promise<ReferenceMasterSeedResult> {
  const layers = createLayerStats();
  const actorUserId = await seedAuditActor(tx, layers['qa-seed-audit-actor']);
  const partyIds = await seedFinanceMasters(
    tx,
    actorUserId,
    layers['financial-profiles-categories-accounts-and-open-periods'],
    layers['business-parties-and-baseline-projects'],
  );
  await seedSalaryComponents(tx, actorUserId, layers['salary-components']);
  await seedLeaveMasters(tx, layers['leave-types-and-branch-policies']);
  await seedApprovalRoutes(tx, layers['workforce-approval-routes']);
  await seedProjects(
    tx,
    partyIds,
    layers['business-parties-and-baseline-projects'],
  );
  await seedAssetBaseline(tx, layers['asset-and-software-licence-baseline']);

  return {
    actorUserId,
    layers,
    totals: sumStats(Object.values(layers)),
  };
}
