import { Injectable, Logger } from '@nestjs/common';
import {
  AttendancePeriodStatus,
  OvertimeRequestStatus,
  OvertimeSettlementType,
  Prisma,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OfficeFinanceFeatureService } from '../../office-finance/services/office-finance-feature.service';

import type { PayrollBlocker, PayrollWarning } from '../dto/payroll-api.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import {
  PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES,
  PayrollScopeService,
} from './payroll-scope.service';
import { PayrollFeatureService } from './payroll-feature.service';

export type PayrollDbClient = Prisma.TransactionClient | PrismaService;

export interface PreflightResult {
  blockers: PayrollBlocker[];
  warnings: PayrollWarning[];
  eligibleEmployeeCount: number;
}

@Injectable()
export class PayrollPreflightService {
  private readonly logger = new Logger(PayrollPreflightService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly financeFeature: OfficeFinanceFeatureService,
    private readonly feature: PayrollFeatureService,
  ) {}

  /**
   * @param tx Optional transaction client; defaults to root Prisma for GET/dashboard.
   */
  async evaluate(
    companyId: string,
    year: number,
    month: number,
    payrollRunId?: string,
    tx: PayrollDbClient = this.prisma,
  ): Promise<PreflightResult> {
    try {
      return await this.evaluateWithClient(
        tx,
        companyId,
        year,
        month,
        payrollRunId,
      );
    } catch (error) {
      if (error instanceof DomainConflictException) {
        throw error;
      }
      this.logger.error(
        `Payroll preflight failed companyId=${companyId} period=${year}-${month}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_PREFLIGHT_FAILED,
        'Payroll preflight failed due to a database error.',
      );
    }
  }

  private async evaluateWithClient(
    db: PayrollDbClient,
    companyId: string,
    year: number,
    month: number,
    payrollRunId?: string,
  ): Promise<PreflightResult> {
    const blockers: PayrollBlocker[] = [];
    const warnings: PayrollWarning[] = [];
    const { periodStart, periodEnd } = this.scope.getPeriodBounds(year, month);
    const readiness = await this.feature.getReadiness(companyId);
    for (const code of readiness.blockedReasons) {
      blockers.push({
        code,
        message: `Payroll dependency is not ready: ${code}.`,
      });
    }

    const profile = await db.companyFinancialProfile.findUnique({
      where: { companyId },
    });

    if (!profile?.baseCurrencyCode || !profile.payrollExpenseCategoryId) {
      blockers.push({
        code: PAYROLL_ERROR_CODES.PAYROLL_FINANCE_SETUP_REQUIRED,
        message:
          'Company financial profile, base currency or payroll expense category is not configured.',
      });
    }

    if (!(await this.financeFeature.isEnabledForCompany(companyId))) {
      blockers.push({
        code: PAYROLL_ERROR_CODES.PAYROLL_FINANCE_SCOPE_NOT_ENABLED,
        message: 'Finance is not enabled for this Company.',
      });
    }

    const existingRun = await db.payrollRun.findFirst({
      where: {
        companyId,
        payrollYear: year,
        payrollMonth: month,
        ...(payrollRunId ? { NOT: { id: payrollRunId } } : {}),
        statusEnum: { not: 'CANCELLED' },
      },
    });

    if (existingRun) {
      blockers.push({
        code: PAYROLL_ERROR_CODES.PAYROLL_PERIOD_EXISTS,
        message:
          'Another payroll run already exists for this Company and month.',
        entityId: existingRun.id,
      });
    }

    const eligibleEmployees = await db.employee.findMany({
      where: {
        companyId,
        isActive: true,
        employmentStatus: { in: [...PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES] },
      },
      include: {
        designation: true,
      },
    });

    const branchIds = [...new Set(eligibleEmployees.map((e) => e.branchId))];

    for (const branchId of branchIds) {
      const period = await db.attendancePeriod.findFirst({
        where: {
          companyId,
          branchId,
          periodYear: year,
          periodMonth: month,
        },
      });

      if (
        !period ||
        (period.status !== AttendancePeriodStatus.PAYROLL_PENDING &&
          period.status !== AttendancePeriodStatus.CLOSED)
      ) {
        blockers.push({
          code: PAYROLL_ERROR_CODES.ATTENDANCE_PERIOD_NOT_READY,
          message:
            'Branch attendance period is missing or not in PAYROLL_PENDING/CLOSED status.',
          entityId: branchId,
        });
      } else {
        const inUse = await db.payrollRunAttendancePeriod.findFirst({
          where: {
            attendancePeriodId: period.id,
            payrollRun: {
              companyId,
              statusEnum: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
              ...(payrollRunId ? { NOT: { id: payrollRunId } } : {}),
            },
          },
        });
        if (inUse) {
          blockers.push({
            code: PAYROLL_ERROR_CODES.ATTENDANCE_PERIOD_IN_USE_BY_PAYROLL,
            message:
              'Attendance period is already linked to another calculated or paid payroll run.',
            entityId: period.id,
          });
        }
      }
    }

    for (const employee of eligibleEmployees) {
      const entityLabel = this.employeeLabel(employee);

      const salaryOverlaps = await this.hasOverlappingSalaryRanges(
        db,
        companyId,
        employee.id,
      );

      if (salaryOverlaps) {
        blockers.push({
          code: PAYROLL_ERROR_CODES.SALARY_REVISION_OVERLAP,
          message: `${entityLabel}: salary dates overlap - end the wrong package so only one covers this month.`,
          entityId: employee.id,
          entityLabel,
        });
      }

      const taxOverlaps = await this.hasOverlappingTaxProfiles(
        db,
        companyId,
        employee.id,
      );

      if (taxOverlaps) {
        blockers.push({
          code: PAYROLL_ERROR_CODES.TAX_PROFILE_OVERLAP,
          message: `${entityLabel}: tax profiles overlap - keep one clean range for this month.`,
          entityId: employee.id,
          entityLabel,
        });
      }

      const salary = await this.findEffectiveSalaryHead(
        db,
        companyId,
        employee.id,
        periodStart,
        periodEnd,
      );

      if (!salary) {
        warnings.push({
          code: 'MISSING_SALARY_REVISION',
          message: `${entityLabel}: no salary package for this month (pay may be 0 until you add one).`,
          entityId: employee.id,
          entityLabel,
        });
      }

      const tax = await this.findEffectiveTaxProfile(
        db,
        companyId,
        employee.id,
        periodStart,
        periodEnd,
      );

      if (!tax) {
        warnings.push({
          code: 'MISSING_TAX_PROFILE',
          message: `${entityLabel}: no tax profile (tax remains zero until a profile is added).`,
          entityId: employee.id,
          entityLabel,
        });
      }

      if (employee.joiningDate && employee.joiningDate > periodStart) {
        warnings.push({
          code: 'JOINER_IN_PERIOD',
          message: `${entityLabel}: joined during this month - check joining date vs full-month pay.`,
          entityId: employee.id,
          entityLabel,
        });
      }

      const separation = await db.employeeSeparation.findFirst({
        where: {
          employeeId: employee.id,
          lastWorkingDate: { gte: periodStart, lte: periodEnd },
        },
      });

      if (separation) {
        warnings.push({
          code: 'LEAVER_IN_PERIOD',
          message: `${entityLabel}: last working day falls in this month - check final pay.`,
          entityId: employee.id,
          entityLabel,
        });
      }
    }

    const overtimeRows = await db.overtimeRequest.findMany({
      where: {
        companyId,
        status: OvertimeRequestStatus.APPROVED,
        approvedSettlement: OvertimeSettlementType.PAYROLL_PENDING,
        businessDate: { gte: periodStart, lte: periodEnd },
      },
    });

    for (const overtime of overtimeRows) {
      const claimed = await this.isSourceClaimed(
        db,
        companyId,
        'OVERTIME',
        overtime.id,
        payrollRunId,
      );

      if (!claimed) {
        const adjusted = payrollRunId
          ? await db.payrollRunAdjustment.findFirst({
              where: {
                payrollRunId,
                sourceType: 'OVERTIME',
                sourceId: overtime.id,
                archivedAt: null,
                cancelledAt: null,
              },
            })
          : null;

        if (!adjusted) {
          warnings.push({
            code: 'UNCLAIMED_OVERTIME',
            message:
              'Approved payroll-pending overtime is not represented by an adjustment.',
            entityId: overtime.id,
          });
        }
      }
    }

    const unpaidLeaves = await db.leaveRequest.findMany({
      where: {
        employee: { companyId },
        status: 'APPROVED',
        fromDate: { lte: periodEnd },
        toDate: { gte: periodStart },
        leaveType: { isPaid: false },
      },
    });

    for (const leave of unpaidLeaves) {
      const claimed = await this.isSourceClaimed(
        db,
        companyId,
        'UNPAID_LEAVE',
        leave.id,
        payrollRunId,
      );

      if (!claimed) {
        const adjusted = payrollRunId
          ? await db.payrollRunAdjustment.findFirst({
              where: {
                payrollRunId,
                sourceType: 'UNPAID_LEAVE',
                sourceId: leave.id,
                archivedAt: null,
                cancelledAt: null,
              },
            })
          : null;

        if (!adjusted) {
          warnings.push({
            code: 'UNCLAIMED_UNPAID_LEAVE',
            message:
              'Approved unpaid leave is not represented by an adjustment.',
            entityId: leave.id,
          });
        }
      }
    }

    return {
      blockers,
      warnings,
      eligibleEmployeeCount: eligibleEmployees.length,
    };
  }

  assertNoBlockers(result: PreflightResult) {
    if (result.blockers.length > 0) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_PREFLIGHT_BLOCKED,
        result.blockers[0]?.message ?? 'Payroll preflight is blocked.',
      );
    }
  }

  async findEffectiveSalaryHead(
    tx: PayrollDbClient,
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return tx.employeeSalary.findFirst({
      where: {
        companyId,
        employeeId,
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
      },
      select: { id: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findEffectiveSalary(
    tx: PayrollDbClient,
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return tx.employeeSalary.findFirst({
      where: {
        companyId,
        employeeId,
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
      },
      include: {
        lines: { include: { salaryComponent: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findEffectiveTaxProfile(
    tx: PayrollDbClient,
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return tx.employeeTaxProfile.findFirst({
      where: {
        companyId,
        employeeId,
        archivedAt: null,
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findActiveDeductions(
    tx: PayrollDbClient,
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return tx.employeeDeduction.findMany({
      where: {
        companyId,
        employeeId,
        isActive: true,
        archivedAt: null,
        startMonth: { lte: periodEnd },
        OR: [{ endMonth: null }, { endMonth: { gte: periodStart } }],
      },
    });
  }

  private async hasOverlappingSalaryRanges(
    db: PayrollDbClient,
    companyId: string,
    employeeId: string,
  ): Promise<boolean> {
    const rows = await db.employeeSalary.findMany({
      where: { companyId, employeeId },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: 'asc' },
    });

    return this.rangesOverlap(
      rows.map((row) => ({
        from: row.effectiveFrom,
        to: row.effectiveTo,
      })),
    );
  }

  private async hasOverlappingTaxProfiles(
    db: PayrollDbClient,
    companyId: string,
    employeeId: string,
  ): Promise<boolean> {
    const rows = await db.employeeTaxProfile.findMany({
      where: {
        companyId,
        employeeId,
        archivedAt: null,
        effectiveFrom: { not: null },
      },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: 'asc' },
    });

    return this.rangesOverlap(
      rows.flatMap((row) =>
        row.effectiveFrom
          ? [{ from: row.effectiveFrom, to: row.effectiveTo }]
          : [],
      ),
    );
  }

  private rangesOverlap(
    ranges: Array<{ from: Date; to: Date | null }>,
  ): boolean {
    for (let index = 0; index < ranges.length; index += 1) {
      for (let other = index + 1; other < ranges.length; other += 1) {
        const left = ranges[index];
        const right = ranges[other];
        const leftStart = left.from.getTime();
        const leftEnd = left.to?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightStart = right.from.getTime();
        const rightEnd = right.to?.getTime() ?? Number.POSITIVE_INFINITY;

        if (leftStart <= rightEnd && rightStart <= leftEnd) {
          return true;
        }
      }
    }

    return false;
  }

  private async isSourceClaimed(
    tx: PayrollDbClient,
    companyId: string,
    sourceType: 'OVERTIME' | 'UNPAID_LEAVE',
    sourceId: string,
    excludeRunId?: string,
  ) {
    const adjustment = await tx.payrollRunAdjustment.findFirst({
      where: {
        companyId,
        sourceType,
        sourceId,
        archivedAt: null,
        cancelledAt: null,
        payrollRun: {
          statusEnum: { not: 'CANCELLED' },
          ...(excludeRunId ? { NOT: { id: excludeRunId } } : {}),
        },
      },
    });

    return Boolean(adjustment);
  }

  private employeeLabel(employee: {
    firstName: string | null;
    lastName: string | null;
    employeeCode: string;
  }) {
    const name = [employee.firstName, employee.lastName]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
      .trim();
    return name ? `${name} (${employee.employeeCode})` : employee.employeeCode;
  }
}
