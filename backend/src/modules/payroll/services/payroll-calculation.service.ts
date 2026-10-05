import { Injectable } from '@nestjs/common';
import {
  AttendancePeriodStatus,
  PayrollAdjustmentDirection,
  PayrollLineSource,
  PayrollRunStatus,
  Prisma,
  SalaryComponentType,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';

import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PayrollPreflightService } from './payroll-preflight.service';
import {
  PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES,
  PayrollScopeService,
} from './payroll-scope.service';

type DbClient = Prisma.TransactionClient;

interface CalculationContext {
  companyId: string;
  payrollRunId: string;
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  actorUserId: string;
  operationId: string;
  expectedVersion: number;
}

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly scope: PayrollScopeService,
    private readonly preflight: PayrollPreflightService,
  ) {}

  async calculateWithinTransaction(
    tx: DbClient,
    input: CalculationContext,
  ): Promise<{
    totalEarnings: Prisma.Decimal;
    totalDeductions: Prisma.Decimal;
    totalNet: Prisma.Decimal;
    versionAfter: number;
  }> {
    const preflight = await this.preflight.evaluate(
      input.companyId,
      input.year,
      input.month,
      input.payrollRunId,
      tx,
    );
    this.preflight.assertNoBlockers(preflight);
    await this.clearSnapshots(tx, input.payrollRunId, input.companyId);

    const profile = await tx.companyFinancialProfile.findUnique({
      where: { companyId: input.companyId },
    });

    if (!profile?.baseCurrencyCode) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_FINANCE_SETUP_REQUIRED,
        'Company base currency is not configured.',
      );
    }

    const adjustments = await tx.payrollRunAdjustment.findMany({
      where: {
        payrollRunId: input.payrollRunId,
        archivedAt: null,
        cancelledAt: null,
      },
    });

    const eligibleEmployees = await tx.employee.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        employmentStatus: { in: [...PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES] },
      },
      include: { designation: true },
      orderBy: { id: 'asc' },
    });

    const branchIds = [...new Set(eligibleEmployees.map((e) => e.branchId))];
    const attendancePeriods = await tx.attendancePeriod.findMany({
      where: {
        companyId: input.companyId,
        branchId: { in: branchIds },
        periodYear: input.year,
        periodMonth: input.month,
        status: {
          in: [
            AttendancePeriodStatus.PAYROLL_PENDING,
            AttendancePeriodStatus.CLOSED,
          ],
        },
      },
      orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
    });

    for (const period of attendancePeriods) {
      await tx.payrollRunAttendancePeriod.create({
        data: {
          companyId: input.companyId,
          payrollRunId: input.payrollRunId,
          branchId: period.branchId,
          attendancePeriodId: period.id,
          attendancePeriodVersion: period.version,
          attendancePeriodStatus: period.status,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        },
      });
    }

    let runEarnings = new Prisma.Decimal(0);
    let runDeductions = new Prisma.Decimal(0);

    for (const employee of eligibleEmployees) {
      const salary = await this.preflight.findEffectiveSalary(
        tx,
        input.companyId,
        employee.id,
        input.periodStart,
        input.periodEnd,
      );

      if (!salary) {
        continue;
      }

      const taxProfile = await this.preflight.findEffectiveTaxProfile(
        tx,
        input.companyId,
        employee.id,
        input.periodStart,
        input.periodEnd,
      );

      const deductions = await this.preflight.findActiveDeductions(
        tx,
        input.companyId,
        employee.id,
        input.periodStart,
        input.periodEnd,
      );

      const employeeAdjustments = adjustments.filter(
        (adj) => adj.employeeId === employee.id,
      );

      const lineDrafts: Array<{
        source: PayrollLineSource;
        direction: PayrollAdjustmentDirection;
        lineCode: string;
        lineName: string;
        lineDescription?: string | null;
        amount: Prisma.Decimal;
        salaryComponentId?: string | null;
        taxProfileId?: string | null;
        recurringDeductionId?: string | null;
        adjustmentId?: string | null;
        overtimeRequestId?: string | null;
        leaveRequestId?: string | null;
      }> = [];

      for (const line of salary.lines) {
        const component = line.salaryComponent;
        const direction =
          (component.componentTypeEnum ?? component.componentType) ===
          SalaryComponentType.EARNING
            ? PayrollAdjustmentDirection.EARNING
            : PayrollAdjustmentDirection.DEDUCTION;

        lineDrafts.push({
          source: PayrollLineSource.SALARY_COMPONENT,
          direction,
          lineCode: component.componentCode,
          lineName: component.componentName,
          amount: line.amount,
          salaryComponentId: component.id,
        });
      }

      if (taxProfile && taxProfile.monthlyTaxAmount.greaterThan(0)) {
        lineDrafts.push({
          source: PayrollLineSource.TAX,
          direction: PayrollAdjustmentDirection.DEDUCTION,
          lineCode: 'TAX',
          lineName: 'Monthly tax',
          amount: taxProfile.monthlyTaxAmount,
          taxProfileId: taxProfile.id,
        });
      }

      for (const deduction of deductions) {
        lineDrafts.push({
          source: PayrollLineSource.RECURRING_DEDUCTION,
          direction: PayrollAdjustmentDirection.DEDUCTION,
          lineCode: deduction.deductionCode ?? 'DEDUCTION',
          lineName: deduction.deductionName,
          amount: deduction.monthlyAmount,
          recurringDeductionId: deduction.id,
        });
      }

      for (const adjustment of employeeAdjustments) {
        lineDrafts.push({
          source: adjustment.sourceType,
          direction: adjustment.direction,
          lineCode: adjustment.sourceType,
          lineName: adjustment.reason.slice(0, 120),
          lineDescription: adjustment.reason,
          amount: adjustment.amount,
          adjustmentId: adjustment.id,
          overtimeRequestId:
            adjustment.sourceType === PayrollLineSource.OVERTIME
              ? adjustment.sourceId
              : null,
          leaveRequestId:
            adjustment.sourceType === PayrollLineSource.UNPAID_LEAVE
              ? adjustment.sourceId
              : null,
        });
      }

      let grossEarnings = new Prisma.Decimal(0);
      let totalDeductions = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let recurringDeductionAmount = new Prisma.Decimal(0);

      for (const draft of lineDrafts) {
        if (draft.direction === PayrollAdjustmentDirection.EARNING) {
          grossEarnings = grossEarnings.add(draft.amount);
        } else {
          totalDeductions = totalDeductions.add(draft.amount);
          if (draft.source === PayrollLineSource.TAX) {
            taxAmount = taxAmount.add(draft.amount);
          } else if (draft.source === PayrollLineSource.RECURRING_DEDUCTION) {
            recurringDeductionAmount = recurringDeductionAmount.add(
              draft.amount,
            );
          }
        }
      }

      const netSalary = grossEarnings.sub(totalDeductions);
      if (netSalary.lessThan(0)) {
        throw new DomainConflictException(
          PAYROLL_ERROR_CODES.PAYROLL_NEGATIVE_NET,
          `Employee ${employee.employeeCode ?? employee.id} has a negative net salary.`,
        );
      }

      const displayName = [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      const runEmployee = await tx.payrollRunEmployee.create({
        data: {
          companyId: input.companyId,
          payrollRunId: input.payrollRunId,
          branchId: employee.branchId,
          employeeId: employee.id,
          employeeSalaryId: salary.id,
          employeeCode: employee.employeeCode,
          displayName: displayName || employee.employeeCode || employee.id,
          designationName: employee.designation?.designationName ?? null,
          payrollYear: input.year,
          payrollMonth: input.month,
          grossEarnings,
          taxAmount,
          deductionAmount: recurringDeductionAmount,
          totalDeductions,
          netSalary,
        },
      });

      let sequence = 1;
      for (const draft of lineDrafts) {
        await tx.payrollRunEmployeeLine.create({
          data: {
            companyId: input.companyId,
            payrollRunEmployeeId: runEmployee.id,
            lineSequence: sequence++,
            source: draft.source,
            direction: draft.direction,
            salaryComponentId: draft.salaryComponentId ?? null,
            taxProfileId: draft.taxProfileId ?? null,
            recurringDeductionId: draft.recurringDeductionId ?? null,
            adjustmentId: draft.adjustmentId ?? null,
            overtimeRequestId: draft.overtimeRequestId ?? null,
            leaveRequestId: draft.leaveRequestId ?? null,
            lineCode: draft.lineCode,
            lineName: draft.lineName,
            lineDescription: draft.lineDescription ?? null,
            amount: draft.amount,
          },
        });
      }

      runEarnings = runEarnings.add(grossEarnings);
      runDeductions = runDeductions.add(totalDeductions);
    }

    const totalNet = runEarnings.sub(runDeductions);
    const versionAfter = input.expectedVersion + 1;

    const cas = await tx.payrollRun.updateMany({
      where: {
        id: input.payrollRunId,
        companyId: input.companyId,
        version: input.expectedVersion,
        statusEnum: PayrollRunStatus.DRAFT,
      },
      data: {
        totalEarnings: runEarnings,
        totalDeductions: runDeductions,
        totalNet,
        currencyCode: profile.baseCurrencyCode,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        calculatedByUserId: input.actorUserId,
        calculatedAt: new Date(),
        status: 'CALCULATED',
        statusEnum: PayrollRunStatus.CALCULATED,
        version: versionAfter,
      },
    });

    if (cas.count !== 1) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_RUN_STATE_CHANGED,
        'Payroll run state changed during calculation.',
      );
    }

    return {
      totalEarnings: runEarnings,
      totalDeductions: runDeductions,
      totalNet,
      versionAfter,
    };
  }

  async clearSnapshots(tx: DbClient, payrollRunId: string, companyId: string) {
    const employees = await tx.payrollRunEmployee.findMany({
      where: { payrollRunId, companyId },
      select: { id: true },
    });

    if (employees.length > 0) {
      await tx.payrollRunEmployeeLine.deleteMany({
        where: {
          payrollRunEmployeeId: { in: employees.map((e) => e.id) },
        },
      });
    }

    await tx.payrollRunEmployee.deleteMany({
      where: { payrollRunId, companyId },
    });
    await tx.payrollRunAttendancePeriod.deleteMany({
      where: { payrollRunId, companyId },
    });
  }
}
