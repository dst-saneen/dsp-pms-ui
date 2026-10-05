import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrganizationScopeService } from '../auth';
import { LeavePolicyResolverService } from '../leave-policy/leave-policy-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveBalanceLedgerService } from './leave-balance-ledger.service';

import { GenerateEmployeeLeaveBalancesDto } from './dto/generate-employee-leave-balances.dto';
import {
  LeaveBalanceGenerationCreateItem,
  LeaveBalanceGenerationIssue,
  LeaveBalanceGenerationResult,
  LeaveBalanceGenerationRetainItem,
} from './leave-balance-generation.types';

const GENERATION_BATCH_SIZE = 25;

@Injectable()
export class LeaveBalanceGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly leavePolicyResolver: LeavePolicyResolverService,
    private readonly leaveBalanceLedger: LeaveBalanceLedgerService,
  ) {}

  async generate(
    dto: GenerateEmployeeLeaveBalancesDto,
  ): Promise<LeaveBalanceGenerationResult> {
    await this.assertAuthorizedScope(dto);

    const dryRun = Boolean(dto.dryRun);
    const employees = await this.loadEligibleEmployees(dto);
    const leaveTypesByCompany = await this.loadLeaveTypesByCompany(
      employees.map((employee) => employee.companyId),
    );

    const existingBalances = await this.prisma.employeeLeaveBalance.findMany({
      where: {
        year: dto.year,
        isActive: true,
        employeeId: { in: employees.map((employee) => employee.id) },
      },
      select: {
        id: true,
        employeeId: true,
        leaveTypeId: true,
        used: true,
        pending: true,
      },
    });

    const existingByKey = new Map(
      existingBalances.map((balance) => [
        `${balance.employeeId}:${balance.leaveTypeId}`,
        balance,
      ]),
    );

    const previousBalances =
      employees.length === 0
        ? []
        : await this.prisma.employeeLeaveBalance.findMany({
            where: {
              year: dto.year - 1,
              isActive: true,
              employeeId: { in: employees.map((employee) => employee.id) },
            },
            select: {
              employeeId: true,
              leaveTypeId: true,
              balance: true,
            },
          });

    const previousByKey = new Map(
      previousBalances.map((balance) => [
        `${balance.employeeId}:${balance.leaveTypeId}`,
        Number(balance.balance),
      ]),
    );

    const createPreview: LeaveBalanceGenerationCreateItem[] = [];
    const retainPreview: LeaveBalanceGenerationRetainItem[] = [];
    const configurationErrors: LeaveBalanceGenerationIssue[] = [];
    const employeesWithoutMatchingPolicy: LeaveBalanceGenerationIssue[] = [];
    const usedPolicyIds = new Set<string>();

    for (const employee of employees) {
      const leaveTypes = leaveTypesByCompany.get(employee.companyId) ?? [];

      for (const leaveType of leaveTypes) {
        const key = `${employee.id}:${leaveType.id}`;
        const existing = existingByKey.get(key);

        if (existing) {
          retainPreview.push({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: dto.year,
            balanceId: existing.id,
            used: Number(existing.used),
            pending: Number(existing.pending),
          });
          continue;
        }

        try {
          const policy = await this.leavePolicyResolver.resolvePolicy({
            companyId: employee.companyId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            designationId: employee.designationId,
            leaveTypeId: leaveType.id,
          });

          usedPolicyIds.add(policy.id);

          const previousBalance = previousByKey.get(key) ?? 0;
          const carryForward = this.calculateCarryForward({
            carryForwardAllowed: leaveType.carryForwardAllowed,
            carryForwardLimit:
              policy.carryForwardLimit == null
                ? null
                : Number(policy.carryForwardLimit),
            previousBalance,
          });
          const entitlement = Number(policy.annualEntitlement) + carryForward;

          createPreview.push({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: dto.year,
            entitlement,
            annualEntitlement: Number(policy.annualEntitlement),
            carryForward,
            policyId: policy.id,
            companyId: employee.companyId,
            branchId: employee.branchId,
          });
        } catch (error) {
          if (error instanceof ConflictException) {
            configurationErrors.push({
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              leaveTypeId: leaveType.id,
              code: 'LEAVE_POLICY_CONFIGURATION_CONFLICT',
              message:
                'Multiple leave policies match at the same specificity for this employee and leave type',
            });
            continue;
          }

          if (error instanceof NotFoundException) {
            employeesWithoutMatchingPolicy.push({
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              leaveTypeId: leaveType.id,
              code: 'LEAVE_POLICY_NOT_FOUND',
              message:
                'No active leave policy matches this employee and leave type',
            });
            continue;
          }

          throw error;
        }
      }
    }

    let createdCount = 0;
    if (!dryRun && createPreview.length > 0) {
      createdCount = await this.persistCreates(createPreview);
    }

    return {
      dryRun,
      year: dto.year,
      eligibleEmployeeCount: employees.length,
      applicablePolicyCount: usedPolicyIds.size,
      balancesToCreate: createPreview.length,
      existingBalancesToRetain: retainPreview.length,
      createdCount: dryRun ? 0 : createdCount,
      configurationErrors,
      employeesWithoutMatchingPolicy,
      createPreview: dryRun ? createPreview : createPreview.slice(0, 100),
      retainPreview: dryRun ? retainPreview : retainPreview.slice(0, 100),
    };
  }

  private async assertAuthorizedScope(
    dto: GenerateEmployeeLeaveBalancesDto,
  ): Promise<void> {
    if (dto.companyId) {
      await this.organizationScope.assertCurrentCompany(dto.companyId);
    }

    if (dto.branchId) {
      await this.organizationScope.assertCurrentBranch(dto.branchId);
    }

    if (dto.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          company: { select: { companyGroupId: true } },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      await this.organizationScope.assertCurrentCompany(employee.companyId);
      await this.organizationScope.assertCurrentBranch(employee.branchId);

      if (employee.company.companyGroupId) {
        this.organizationScope.assertCurrentCompanyGroup(
          employee.company.companyGroupId,
        );
      }
    }
  }

  private async loadEligibleEmployees(dto: GenerateEmployeeLeaveBalancesDto) {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();
    const scopedCompanyId =
      dto.companyId ?? this.organizationScope.companyIdOrUndefined();
    const scopedBranchId =
      dto.branchId ?? this.organizationScope.branchIdOrUndefined();

    return this.prisma.employee.findMany({
      where: {
        isActive: true,
        employmentStatus: 'ACTIVE',
        ...(dto.employeeId ? { id: dto.employeeId } : {}),
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
        ...(!scopedCompanyId && companyGroupId
          ? { company: { companyGroupId } }
          : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        designationId: true,
      },
      orderBy: { employeeCode: 'asc' },
    });
  }

  private async loadLeaveTypesByCompany(companyIds: string[]) {
    const uniqueCompanyIds = [...new Set(companyIds)];
    const map = new Map<
      string,
      Array<{ id: string; carryForwardAllowed: boolean }>
    >();

    if (uniqueCompanyIds.length === 0) {
      return map;
    }

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: {
        companyId: { in: uniqueCompanyIds },
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        carryForwardAllowed: true,
      },
      orderBy: { leaveName: 'asc' },
    });

    for (const leaveType of leaveTypes) {
      const list = map.get(leaveType.companyId) ?? [];
      list.push({
        id: leaveType.id,
        carryForwardAllowed: leaveType.carryForwardAllowed,
      });
      map.set(leaveType.companyId, list);
    }

    return map;
  }

  calculateCarryForward(params: {
    carryForwardAllowed: boolean;
    carryForwardLimit: number | null;
    previousBalance: number;
  }): number {
    if (!params.carryForwardAllowed) {
      return 0;
    }

    const available = Math.max(0, params.previousBalance);
    if (params.carryForwardLimit == null) {
      return available;
    }

    return Math.min(available, Math.max(0, params.carryForwardLimit));
  }

  private async persistCreates(
    creates: LeaveBalanceGenerationCreateItem[],
  ): Promise<number> {
    let createdCount = 0;

    for (
      let index = 0;
      index < creates.length;
      index += GENERATION_BATCH_SIZE
    ) {
      const batch = creates.slice(index, index + GENERATION_BATCH_SIZE);

      await this.prisma.$transaction(async (tx) => {
        for (const item of batch) {
          const existing = await tx.employeeLeaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: item.employeeId,
                leaveTypeId: item.leaveTypeId,
                year: item.year,
              },
            },
          });

          if (existing) {
            // Idempotent: never reset used/pending on an existing row.
            continue;
          }

          await this.leaveBalanceLedger.createGeneratedBalance({
            tx,
            employee: {
              id: item.employeeId,
              companyId: item.companyId,
              branchId: item.branchId,
            },
            leaveTypeId: item.leaveTypeId,
            year: item.year,
            annualEntitlement: item.annualEntitlement,
            carryForward: item.carryForward,
          });
          createdCount += 1;
        }
      });
    }

    return createdCount;
  }
}
