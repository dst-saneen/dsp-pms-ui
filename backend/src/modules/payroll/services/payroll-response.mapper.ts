import { Injectable } from '@nestjs/common';
import {
  EmployeeDeduction,
  EmployeeSalary,
  EmployeeTaxProfile,
  PayrollRun,
  PayrollRunEmployee,
  PayrollRunEmployeeLine,
  Prisma,
  SalaryComponent,
} from '@prisma/client';

import type {
  PaginatedResponse,
  PayrollBlocker,
  PayrollRunProjection,
  PayrollWarning,
  TaxonomyAllowedAction,
} from '../dto/payroll-api.types';
import { PayrollCapabilityService } from './payroll-capability.service';
import { PayrollScopeService } from './payroll-scope.service';

@Injectable()
export class PayrollResponseMapper {
  constructor(
    private readonly scope: PayrollScopeService,
    private readonly capabilities: PayrollCapabilityService,
  ) {}

  toPaginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return this.scope.toPaginated(items, total, page, limit);
  }

  toSalaryComponent(
    component: SalaryComponent,
    allowedActions: TaxonomyAllowedAction[],
  ) {
    return {
      id: component.id,
      companyId: component.companyId,
      componentCode: component.componentCode,
      componentName: component.componentName,
      componentType: component.componentTypeEnum ?? component.componentType,
      description: component.description,
      version: component.version,
      isActive: component.isActive,
      archivedAt: component.archivedAt?.toISOString() ?? null,
      allowedActions,
      createdAt: component.createdAt.toISOString(),
      updatedAt: component.updatedAt.toISOString(),
    };
  }

  toSalaryRevision(
    revision: EmployeeSalary & {
      lines?: Array<{
        id: string;
        salaryComponentId: string;
        amount: import('@prisma/client').Prisma.Decimal;
        salaryComponent?: SalaryComponent;
      }>;
    },
  ) {
    return {
      id: revision.id,
      companyId: revision.companyId,
      employeeId: revision.employeeId,
      effectiveFrom: this.scope.formatDate(revision.effectiveFrom),
      effectiveTo: revision.effectiveTo
        ? this.scope.formatDate(revision.effectiveTo)
        : null,
      isActive: revision.isActive,
      remarks: revision.remarks,
      version: revision.version,
      lines: (revision.lines ?? []).map((line) => ({
        id: line.id,
        salaryComponentId: line.salaryComponentId,
        componentCode: line.salaryComponent?.componentCode ?? null,
        componentName: line.salaryComponent?.componentName ?? null,
        componentType:
          line.salaryComponent?.componentTypeEnum ??
          line.salaryComponent?.componentType ??
          null,
        amount: this.scope.decimalToString(line.amount),
      })),
      createdAt: revision.createdAt.toISOString(),
      updatedAt: revision.updatedAt.toISOString(),
    };
  }

  toTaxProfile(profile: EmployeeTaxProfile) {
    return {
      id: profile.id,
      companyId: profile.companyId,
      employeeId: profile.employeeId,
      countryCode: profile.countryCode,
      taxRegime: profile.taxRegime,
      monthlyTaxAmount: this.scope.decimalToString(profile.monthlyTaxAmount),
      effectiveFrom: profile.effectiveFrom
        ? this.scope.formatDate(profile.effectiveFrom)
        : null,
      effectiveTo: profile.effectiveTo
        ? this.scope.formatDate(profile.effectiveTo)
        : null,
      isActive: profile.isActive,
      version: profile.version,
      archivedAt: profile.archivedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  toDeduction(deduction: EmployeeDeduction) {
    return {
      id: deduction.id,
      companyId: deduction.companyId,
      employeeId: deduction.employeeId,
      deductionCode: deduction.deductionCode,
      deductionName: deduction.deductionName,
      monthlyAmount: this.scope.decimalToString(deduction.monthlyAmount),
      startMonth: this.scope.formatDate(deduction.startMonth),
      endMonth: deduction.endMonth
        ? this.scope.formatDate(deduction.endMonth)
        : null,
      remarks: deduction.remarks,
      isActive: deduction.isActive,
      version: deduction.version,
      archivedAt: deduction.archivedAt?.toISOString() ?? null,
      createdAt: deduction.createdAt.toISOString(),
      updatedAt: deduction.updatedAt.toISOString(),
    };
  }

  toRunProjection(
    run: PayrollRun,
    context: import('../payroll-access.types').PayrollAccessContext,
    blockers: PayrollBlocker[] = [],
    warnings: PayrollWarning[] = [],
  ): PayrollRunProjection {
    const status = this.scope.mapRunStatus(run.status, run.statusEnum);

    return {
      id: run.id,
      version: run.version,
      runNumber: run.runNumber ?? '',
      year: run.payrollYear,
      month: run.payrollMonth,
      status,
      currencyCode: run.currencyCode ?? '',
      totals: {
        earnings: this.scope.decimalToString(run.totalEarnings),
        deductions: this.scope.decimalToString(run.totalDeductions),
        net: this.scope.decimalToString(run.totalNet),
      },
      blockers,
      warnings,
      financeTransactionId: run.financeTransactionId,
      allowedActions: this.capabilities.getRunAllowedActions(run, context),
      remarks: run.remarks,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  toRunEmployee(
    row: PayrollRunEmployee & {
      lines?: PayrollRunEmployeeLine[];
    },
  ) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      displayName: row.displayName,
      designationName: row.designationName,
      grossEarnings: this.scope.decimalToString(row.grossEarnings),
      totalDeductions: this.scope.decimalToString(
        row.totalDeductions ?? row.taxAmount.add(row.deductionAmount),
      ),
      netSalary: this.scope.decimalToString(row.netSalary),
      lines: (row.lines ?? []).map((line) => ({
        id: line.id,
        lineSequence: line.lineSequence,
        source: line.source,
        direction: line.direction,
        lineCode: line.lineCode,
        lineName: line.lineName,
        lineDescription: line.lineDescription,
        amount: this.scope.decimalToString(line.amount),
      })),
    };
  }

  toPayslipSummary(payslip: {
    id: string;
    payrollRunId: string;
    payrollYear: number;
    payrollMonth: number;
    employeeCode: string;
    displayName: string;
    status: string;
    generatedAt: Date | null;
    payrollRun?: {
      runNumber: string | null;
      currencyCode: string | null;
    } | null;
    payrollRunEmployee?: {
      netSalary: Prisma.Decimal;
    } | null;
  }) {
    return {
      id: payslip.id,
      payrollRunId: payslip.payrollRunId,
      year: payslip.payrollYear,
      month: payslip.payrollMonth,
      payrollYear: payslip.payrollYear,
      payrollMonth: payslip.payrollMonth,
      runNumber: payslip.payrollRun?.runNumber ?? '',
      employeeCode: payslip.employeeCode,
      displayName: payslip.displayName,
      status: payslip.status,
      netSalary: this.scope.decimalToString(
        payslip.payrollRunEmployee?.netSalary,
      ),
      currencyCode: payslip.payrollRun?.currencyCode ?? '',
      generatedAt: payslip.generatedAt?.toISOString() ?? null,
      availableAt: payslip.generatedAt?.toISOString() ?? null,
    };
  }
}
