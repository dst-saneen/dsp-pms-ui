import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { AuditService } from '../audit/audit.service';

import {
  LeavePolicyMatrixQueryDto,
  ReplaceLeavePolicyMatrixDto,
} from './dto/leave-policy-matrix.dto';
import {
  LEAVE_POLICY_MATRIX_IMPACT_SAMPLE,
  LEAVE_POLICY_MATRIX_MAX_CELLS,
  buildLeavePolicyMatrixSnapshotToken,
  leavePolicyMatrixLockKey,
} from './leave-policy-matrix.util';

type MatrixPolicy = {
  id: string;
  designationId: string | null;
  leaveTypeId: string;
  annualEntitlement: Prisma.Decimal;
  isActive: boolean;
  updatedAt: Date;
  carryForwardLimit: Prisma.Decimal | null;
  maxConsecutiveDays: number | null;
  allowNegativeBalance: boolean;
};

export type LeavePolicyMatrixImpact = {
  year: number;
  missingBalanceCount: number;
  entitlementChangedCount: number;
  missingBalances: Array<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    leaveTypeId: string;
    leaveTypeName: string;
    designationId: string;
  }>;
  entitlementChanges: Array<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    leaveTypeId: string;
    leaveTypeName: string;
    designationId: string;
    previousDays: number;
    nextDays: number;
  }>;
  balancesNotUpdated: true;
};

@Injectable()
export class LeavePolicyMatrixService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getMatrix(query: LeavePolicyMatrixQueryDto) {
    const context = await this.loadContext(
      query.branchId,
      query.departmentId ?? null,
    );
    const policies = await this.loadScopePolicies(
      this.prisma,
      context.companyId,
      context.branchId,
      context.departmentId,
    );
    const cells = this.buildCells(
      context.designations,
      context.leaveTypes,
      policies,
    );
    return {
      companyId: context.companyId,
      branchId: context.branchId,
      departmentId: context.departmentId,
      snapshotToken: buildLeavePolicyMatrixSnapshotToken(policies),
      leaveTypes: context.leaveTypes,
      designations: context.designations,
      cells,
      impact: this.emptyImpact(),
    };
  }

  async replaceMatrix(dto: ReplaceLeavePolicyMatrixDto) {
    const context = await this.loadContext(
      dto.branchId,
      dto.departmentId ?? null,
    );
    this.assertCellsInGrid(dto.cells, context);
    if (dto.cells.length > LEAVE_POLICY_MATRIX_MAX_CELLS) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Matrix saves are limited to ${LEAVE_POLICY_MATRIX_MAX_CELLS} cells`,
      });
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${leavePolicyMatrixLockKey(context.branchId, context.departmentId)}, 0))`,
        );

        const existing = await this.loadScopePolicies(
          tx,
          context.companyId,
          context.branchId,
          context.departmentId,
        );
        const currentToken = buildLeavePolicyMatrixSnapshotToken(existing);
        if (currentToken !== dto.snapshotToken) {
          throw new ConflictException({
            code: WorkforceErrorCode.STALE_POLICY_MATRIX,
            message:
              'This matrix changed since it was loaded. Reload and try again.',
          });
        }

        const existingByKey = new Map(
          existing
            .filter((policy) => policy.designationId)
            .map((policy) => [
              this.cellKey(policy.designationId as string, policy.leaveTypeId),
              policy,
            ]),
        );
        const defaultsByLeaveType = new Map(
          existing
            .filter((policy) => !policy.designationId && policy.isActive)
            .map((policy) => [policy.leaveTypeId, policy]),
        );

        let created = 0;
        let updated = 0;
        let disabled = 0;
        let unchanged = 0;
        const submittedKeys = new Set<string>();
        const changedEntitlements: Array<{
          designationId: string;
          leaveTypeId: string;
          previousDays: number | null;
          nextDays: number | null;
          changed: boolean;
        }> = [];

        for (const cell of dto.cells) {
          const key = this.cellKey(cell.designationId, cell.leaveTypeId);
          submittedKeys.add(key);
          const current = existingByKey.get(key) ?? null;
          const previousDays = current?.isActive
            ? Number(current.annualEntitlement)
            : null;

          if (cell.enabled) {
            if (cell.annualEntitlement == null) {
              throw new BadRequestException({
                code: 'BAD_REQUEST',
                message: 'Enabled matrix cells require annual entitlement days',
              });
            }
            if (cell.annualEntitlement <= 0) {
              throw new BadRequestException({
                code: 'BAD_REQUEST',
                message:
                  'Enabled matrix cells require entitlement greater than zero',
              });
            }
            if (current?.isActive && previousDays === cell.annualEntitlement) {
              unchanged += 1;
              changedEntitlements.push({
                designationId: cell.designationId,
                leaveTypeId: cell.leaveTypeId,
                previousDays,
                nextDays: cell.annualEntitlement,
                changed: false,
              });
              continue;
            }
            if (current) {
              await tx.leavePolicy.update({
                where: { id: current.id },
                data: {
                  isActive: true,
                  annualEntitlement: cell.annualEntitlement,
                },
              });
              updated += 1;
            } else {
              const fallback = defaultsByLeaveType.get(cell.leaveTypeId);
              await tx.leavePolicy.create({
                data: {
                  companyId: context.companyId,
                  branchId: context.branchId,
                  departmentId: context.departmentId,
                  designationId: cell.designationId,
                  leaveTypeId: cell.leaveTypeId,
                  annualEntitlement: cell.annualEntitlement,
                  carryForwardLimit: fallback?.carryForwardLimit ?? null,
                  maxConsecutiveDays: fallback?.maxConsecutiveDays ?? null,
                  allowNegativeBalance: fallback?.allowNegativeBalance ?? false,
                },
              });
              created += 1;
            }
            changedEntitlements.push({
              designationId: cell.designationId,
              leaveTypeId: cell.leaveTypeId,
              previousDays,
              nextDays: cell.annualEntitlement,
              changed: previousDays !== cell.annualEntitlement,
            });
            continue;
          }

          if (current?.isActive) {
            await tx.leavePolicy.update({
              where: { id: current.id },
              data: { isActive: false },
            });
            disabled += 1;
            changedEntitlements.push({
              designationId: cell.designationId,
              leaveTypeId: cell.leaveTypeId,
              previousDays,
              nextDays: null,
              changed: true,
            });
          } else {
            unchanged += 1;
          }
        }

        for (const [key, current] of existingByKey) {
          if (
            submittedKeys.has(key) ||
            !current.isActive ||
            !current.designationId
          ) {
            continue;
          }
          await tx.leavePolicy.update({
            where: { id: current.id },
            data: { isActive: false },
          });
          disabled += 1;
          changedEntitlements.push({
            designationId: current.designationId,
            leaveTypeId: current.leaveTypeId,
            previousDays: Number(current.annualEntitlement),
            nextDays: null,
            changed: true,
          });
        }

        const nextPolicies = await this.loadScopePolicies(
          tx,
          context.companyId,
          context.branchId,
          context.departmentId,
        );
        await this.auditService.log(
          'LeavePolicyMatrix',
          context.branchId,
          'UPDATE',
          { snapshotToken: dto.snapshotToken },
          {
            departmentId: context.departmentId,
            reason: dto.reason.trim(),
            created,
            updated,
            disabled,
            unchanged,
            cellCount: dto.cells.length,
          },
          { tx },
        );

        return {
          created,
          updated,
          disabled,
          unchanged,
          changedEntitlements,
          snapshotToken: buildLeavePolicyMatrixSnapshotToken(nextPolicies),
          cells: this.buildCells(
            context.designations,
            context.leaveTypes,
            nextPolicies,
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      companyId: context.companyId,
      branchId: context.branchId,
      departmentId: context.departmentId,
      snapshotToken: result.snapshotToken,
      leaveTypes: context.leaveTypes,
      designations: context.designations,
      cells: result.cells,
      saved: {
        created: result.created,
        updated: result.updated,
        disabled: result.disabled,
        unchanged: result.unchanged,
      },
      impact: await this.buildImpact(
        this.prisma,
        context,
        result.changedEntitlements,
      ),
    };
  }

  private async loadContext(branchId: string, departmentId: string | null) {
    const branch = await this.employeeDomainScope.assertBranchInScope(branchId);
    if (departmentId) {
      await this.employeeDomainScope.assertDepartmentInScope(
        departmentId,
        branch.companyId,
        branch.id,
      );
    }

    const [leaveTypes, designations] = await Promise.all([
      this.prisma.leaveType.findMany({
        where: {
          companyId: branch.companyId,
          isActive: true,
          ...this.employeeDomainScope.leaveTypeWhere(),
        },
        select: { id: true, leaveCode: true, leaveName: true },
        orderBy: { leaveName: 'asc' },
      }),
      this.prisma.designation.findMany({
        where: {
          companyId: branch.companyId,
          isActive: true,
          ...this.employeeDomainScope.designationWhere(),
        },
        select: { id: true, designationCode: true, designationName: true },
        orderBy: { designationName: 'asc' },
      }),
    ]);

    return {
      companyId: branch.companyId,
      branchId: branch.id,
      departmentId,
      leaveTypes,
      designations,
    };
  }

  private async loadScopePolicies(
    db: Prisma.TransactionClient | PrismaService,
    companyId: string,
    branchId: string,
    departmentId: string | null,
  ): Promise<MatrixPolicy[]> {
    return db.leavePolicy.findMany({
      where: {
        companyId,
        branchId,
        departmentId,
        ...this.employeeDomainScope.leavePolicyWhere(),
      },
      select: {
        id: true,
        designationId: true,
        leaveTypeId: true,
        annualEntitlement: true,
        isActive: true,
        updatedAt: true,
        carryForwardLimit: true,
        maxConsecutiveDays: true,
        allowNegativeBalance: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  private buildCells(
    designations: Array<{ id: string }>,
    leaveTypes: Array<{ id: string }>,
    policies: MatrixPolicy[],
  ) {
    const byKey = new Map(
      policies
        .filter((policy) => policy.designationId && policy.isActive)
        .map((policy) => [
          this.cellKey(policy.designationId as string, policy.leaveTypeId),
          policy,
        ]),
    );
    return designations.flatMap((designation) =>
      leaveTypes.map((leaveType) => {
        const policy = byKey.get(this.cellKey(designation.id, leaveType.id));
        return {
          designationId: designation.id,
          leaveTypeId: leaveType.id,
          enabled: Boolean(policy),
          annualEntitlement: policy ? Number(policy.annualEntitlement) : null,
          policyId: policy?.id ?? null,
        };
      }),
    );
  }

  private assertCellsInGrid(
    cells: ReplaceLeavePolicyMatrixDto['cells'],
    context: {
      designations: Array<{ id: string }>;
      leaveTypes: Array<{ id: string }>;
    },
  ) {
    const designationIds = new Set(context.designations.map((row) => row.id));
    const leaveTypeIds = new Set(context.leaveTypes.map((row) => row.id));
    const seen = new Set<string>();
    for (const cell of cells) {
      if (!designationIds.has(cell.designationId)) {
        throw new NotFoundException('Designation not found');
      }
      if (!leaveTypeIds.has(cell.leaveTypeId)) {
        throw new NotFoundException('Leave type not found');
      }
      const key = this.cellKey(cell.designationId, cell.leaveTypeId);
      if (seen.has(key)) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Duplicate matrix cells are not allowed',
        });
      }
      seen.add(key);
    }
  }

  private async buildImpact(
    db: Prisma.TransactionClient | PrismaService,
    context: {
      companyId: string;
      branchId: string;
      departmentId: string | null;
      leaveTypes: Array<{ id: string; leaveName: string }>;
      designations: Array<{ id: string }>;
    },
    changedCells: Array<{
      designationId: string;
      leaveTypeId: string;
      previousDays: number | null;
      nextDays: number | null;
      changed: boolean;
    }>,
  ): Promise<LeavePolicyMatrixImpact> {
    const year = new Date().getUTCFullYear();
    const leaveTypeName = new Map(
      context.leaveTypes.map((row) => [row.id, row.leaveName]),
    );
    const designationIds = [
      ...new Set(changedCells.map((cell) => cell.designationId)),
    ];
    if (designationIds.length === 0) {
      return {
        year,
        missingBalanceCount: 0,
        entitlementChangedCount: 0,
        missingBalances: [],
        entitlementChanges: [],
        balancesNotUpdated: true,
      };
    }

    const employees = await db.employee.findMany({
      where: {
        companyId: context.companyId,
        branchId: context.branchId,
        isActive: true,
        designationId: { in: designationIds },
        ...(context.departmentId ? { departmentId: context.departmentId } : {}),
        ...this.employeeDomainScope.employeeWhere(),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        designationId: true,
      },
    });

    const balances = await db.employeeLeaveBalance.findMany({
      where: {
        year,
        isActive: true,
        employeeId: { in: employees.map((row) => row.id) },
        leaveTypeId: {
          in: [...new Set(changedCells.map((cell) => cell.leaveTypeId))],
        },
      },
      select: {
        employeeId: true,
        leaveTypeId: true,
        entitlement: true,
      },
    });
    const balanceByKey = new Map(
      balances.map((row) => [
        `${row.employeeId}:${row.leaveTypeId}`,
        Number(row.entitlement),
      ]),
    );

    const missingBalances: LeavePolicyMatrixImpact['missingBalances'] = [];
    const entitlementChanges: LeavePolicyMatrixImpact['entitlementChanges'] =
      [];
    const cellByDesigType = new Map(
      changedCells.map((cell) => [
        this.cellKey(cell.designationId, cell.leaveTypeId),
        cell,
      ]),
    );

    for (const employee of employees) {
      if (!employee.designationId) continue;
      const employeeName = [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' ');
      for (const leaveType of context.leaveTypes) {
        const cell = cellByDesigType.get(
          this.cellKey(employee.designationId, leaveType.id),
        );
        if (!cell) continue;
        const balanceKey = `${employee.id}:${leaveType.id}`;
        const hasBalance = balanceByKey.has(balanceKey);
        if (cell.nextDays != null && !hasBalance) {
          missingBalances.push({
            employeeId: employee.id,
            employeeCode: employee.employeeCode,
            employeeName,
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveTypeName.get(leaveType.id) ?? leaveType.id,
            designationId: employee.designationId,
          });
        }
        if (cell.changed && hasBalance && cell.nextDays != null) {
          entitlementChanges.push({
            employeeId: employee.id,
            employeeCode: employee.employeeCode,
            employeeName,
            leaveTypeId: leaveType.id,
            leaveTypeName: leaveTypeName.get(leaveType.id) ?? leaveType.id,
            designationId: employee.designationId,
            previousDays:
              cell.previousDays ?? Number(balanceByKey.get(balanceKey)),
            nextDays: cell.nextDays,
          });
        }
      }
    }

    return {
      year,
      missingBalanceCount: missingBalances.length,
      entitlementChangedCount: entitlementChanges.length,
      missingBalances: missingBalances.slice(
        0,
        LEAVE_POLICY_MATRIX_IMPACT_SAMPLE,
      ),
      entitlementChanges: entitlementChanges.slice(
        0,
        LEAVE_POLICY_MATRIX_IMPACT_SAMPLE,
      ),
      balancesNotUpdated: true,
    };
  }

  private cellKey(designationId: string, leaveTypeId: string) {
    return `${designationId}:${leaveTypeId}`;
  }

  private emptyImpact(): LeavePolicyMatrixImpact {
    return {
      year: new Date().getUTCFullYear(),
      missingBalanceCount: 0,
      entitlementChangedCount: 0,
      missingBalances: [],
      entitlementChanges: [],
      balancesNotUpdated: true,
    };
  }
}
