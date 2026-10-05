import { Injectable } from '@nestjs/common';
import { PayrollActionEntityType, Prisma } from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  ArchiveEmployeeDeductionDto,
  CreateEmployeeDeductionDto,
  CreateSalaryRevisionDto,
  CreateTaxProfileDto,
  EndSalaryRevisionDto,
  EndTaxProfileDto,
  UpdateEmployeeDeductionDto,
} from '../dto/employee-input.dto';
import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import { resolveTaxProfileCountry } from '../policies/payroll-country-contract';
import { PayrollCommandReceiptService } from './payroll-command-receipt.service';
import { PayrollResponseMapper } from './payroll-response.mapper';
import { PayrollScopeService } from './payroll-scope.service';

type DbClient = Prisma.TransactionClient;

export function assertSalaryRevisionEndDate(
  effectiveFrom: Date,
  effectiveTo: Date,
): void {
  if (effectiveTo < effectiveFrom) {
    throw new DomainConflictException(
      PAYROLL_ERROR_CODES.VALIDATION_ERROR,
      'effectiveTo cannot be before effectiveFrom.',
    );
  }
}

@Injectable()
export class PayrollEmployeeInputsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly receipts: PayrollCommandReceiptService,
    private readonly mapper: PayrollResponseMapper,
  ) {}

  async listSalaryRevisions(employeeId: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    const employee = await this.scope.assertEmployeeScope(employeeId);

    if (employee.companyId !== companyId) {
      this.scope.notFound('Employee');
    }

    const rows = await this.prisma.employeeSalary.findMany({
      where: { companyId, employeeId },
      include: {
        lines: {
          include: { salaryComponent: true },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return rows.map((row) => this.mapper.toSalaryRevision(row));
  }

  async createSalaryRevision(
    employeeId: string,
    dto: CreateSalaryRevisionDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'CREATE_SALARY_REVISION',
      { ...dto, employeeId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const effectiveFrom = this.scope.parseDate(
          dto.effectiveFrom,
          'effectiveFrom',
        );

        const current = await tx.employeeSalary.findFirst({
          where: {
            companyId,
            employeeId,
            isActive: true,
            effectiveTo: null,
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (
          current &&
          dto.expectedCurrentRevisionVersion !== undefined &&
          current.version !== dto.expectedCurrentRevisionVersion
        ) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_VERSION_CONFLICT,
            'Current salary revision version has changed.',
          );
        }

        if (current && effectiveFrom <= current.effectiveFrom) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.SALARY_REVISION_OVERLAP,
            'effectiveFrom must be after the current revision start date.',
          );
        }

        const componentIds = dto.lines.map((line) => line.salaryComponentId);
        const components = await tx.salaryComponent.findMany({
          where: {
            id: { in: componentIds },
            companyId,
            archivedAt: null,
            isActive: true,
          },
        });

        if (components.length !== new Set(componentIds).size) {
          this.scope.notFound('Salary component');
        }

        if (new Set(componentIds).size !== componentIds.length) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.VALIDATION_ERROR,
            'Duplicate salary components are not allowed in one revision.',
          );
        }

        if (current) {
          const endDate = new Date(effectiveFrom);
          endDate.setUTCDate(endDate.getUTCDate() - 1);

          await tx.employeeSalary.update({
            where: { id: current.id },
            data: {
              isActive: false,
              effectiveTo: endDate,
              endedAt: new Date(),
              endedByUserId: context.userId,
              version: { increment: 1 },
            },
          });
        }

        const created = await tx.employeeSalary.create({
          data: {
            companyId,
            employeeId,
            effectiveFrom,
            remarks: dto.remarks?.trim() || null,
            createdByUserId: context.userId,
          },
        });

        // Nested create cannot set companyId on compound-FK child rows in Prisma;
        // create lines explicitly after the parent exists.
        await tx.employeeSalaryLine.createMany({
          data: dto.lines.map((line) => ({
            companyId,
            employeeSalaryId: created.id,
            salaryComponentId: line.salaryComponentId,
            amount: this.scope.parseMoney(line.amount, 'amount'),
          })),
        });

        const createdWithLines = await tx.employeeSalary.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            lines: { include: { salaryComponent: true } },
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          createdWithLines.id,
          PayrollActionEntityType.SALARY_REVISION,
          'CREATE',
          0,
          createdWithLines.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta(
          'SALARY_REVISION',
          createdWithLines.id,
        );
      },
      async (id) => {
        const row = await this.prisma.employeeSalary.findUnique({
          where: { id },
          include: {
            lines: { include: { salaryComponent: true } },
          },
        });
        if (!row) {
          this.scope.notFound('Salary revision');
        }
        return this.mapper.toSalaryRevision(row);
      },
    );
  }

  async endSalaryRevision(
    employeeId: string,
    revisionId: string,
    dto: EndSalaryRevisionDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'END_SALARY_REVISION',
      { ...dto, employeeId, revisionId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const revision = await tx.employeeSalary.findFirst({
          where: { id: revisionId, companyId, employeeId },
        });

        if (!revision) {
          this.scope.notFound('Salary revision');
        }

        this.scope.assertExpectedVersion(revision.version, dto.expectedVersion);

        const inUse = await tx.payrollRunEmployee.findFirst({
          where: {
            employeeSalaryId: revisionId,
            payrollRun: {
              statusEnum: {
                in: ['CALCULATED', 'APPROVED', 'PAID', 'LEGACY_IMPORTED'],
              },
            },
          },
        });

        if (inUse) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.SALARY_REVISION_IN_USE,
            'Salary revision is referenced by an immutable payroll run.',
          );
        }

        const effectiveTo = this.scope.parseDate(
          dto.effectiveTo,
          'effectiveTo',
        );
        assertSalaryRevisionEndDate(revision.effectiveFrom, effectiveTo);

        const updated = await tx.employeeSalary.update({
          where: { id: revisionId },
          data: {
            effectiveTo,
            isActive: false,
            endedAt: new Date(),
            endedByUserId: context.userId,
            version: { increment: 1 },
          },
          include: {
            lines: { include: { salaryComponent: true } },
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          updated.id,
          PayrollActionEntityType.SALARY_REVISION,
          'END',
          revision.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('SALARY_REVISION', updated.id);
      },
      async (id) => {
        const row = await this.prisma.employeeSalary.findUnique({
          where: { id },
          include: { lines: { include: { salaryComponent: true } } },
        });
        if (!row) {
          this.scope.notFound('Salary revision');
        }
        return this.mapper.toSalaryRevision(row);
      },
    );
  }

  async listTaxProfiles(employeeId: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    const employee = await this.scope.assertEmployeeScope(employeeId);

    if (employee.companyId !== companyId) {
      this.scope.notFound('Employee');
    }

    const rows = await this.prisma.employeeTaxProfile.findMany({
      where: { companyId, employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return rows.map((row) => this.mapper.toTaxProfile(row));
  }

  async createTaxProfile(
    employeeId: string,
    dto: CreateTaxProfileDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'CREATE_TAX_PROFILE',
      { ...dto, employeeId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const effectiveFrom = this.scope.parseDate(
          dto.effectiveFrom,
          'effectiveFrom',
        );
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { legalCountryCode: true },
        });
        const countryCode = resolveTaxProfileCountry(
          company?.legalCountryCode,
          dto.countryCode,
        );

        const current = await tx.employeeTaxProfile.findFirst({
          where: {
            companyId,
            employeeId,
            isActive: true,
            effectiveTo: null,
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (
          current &&
          effectiveFrom <= (current.effectiveFrom ?? effectiveFrom)
        ) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.SALARY_REVISION_OVERLAP,
            'Tax profile effective range overlaps an existing profile.',
          );
        }

        if (current) {
          const endDate = new Date(effectiveFrom);
          endDate.setUTCDate(endDate.getUTCDate() - 1);
          await tx.employeeTaxProfile.update({
            where: { id: current.id },
            data: {
              isActive: false,
              effectiveTo: endDate,
              endedAt: new Date(),
              endedByUserId: context.userId,
              version: { increment: 1 },
            },
          });
        }

        const created = await tx.employeeTaxProfile.create({
          data: {
            companyId,
            employeeId,
            countryCode,
            taxRegime: dto.taxRegime?.trim() || null,
            monthlyTaxAmount: this.scope.parseMoney(
              dto.monthlyTaxAmount,
              'monthlyTaxAmount',
            ),
            effectiveFrom,
            createdByUserId: context.userId,
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          created.id,
          PayrollActionEntityType.TAX_PROFILE,
          'CREATE',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('TAX_PROFILE', created.id);
      },
      async (id) => {
        const row = await this.prisma.employeeTaxProfile.findUnique({
          where: { id },
        });
        if (!row) {
          this.scope.notFound('Tax profile');
        }
        return this.mapper.toTaxProfile(row);
      },
    );
  }

  async endTaxProfile(
    employeeId: string,
    profileId: string,
    dto: EndTaxProfileDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'END_TAX_PROFILE',
      { ...dto, employeeId, profileId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const profile = await tx.employeeTaxProfile.findFirst({
          where: { id: profileId, companyId, employeeId },
        });

        if (!profile) {
          this.scope.notFound('Tax profile');
        }

        this.scope.assertExpectedVersion(profile.version, dto.expectedVersion);

        const effectiveTo = this.scope.parseDate(
          dto.effectiveTo,
          'effectiveTo',
        );

        const updated = await tx.employeeTaxProfile.update({
          where: { id: profileId },
          data: {
            effectiveTo,
            isActive: false,
            endedAt: new Date(),
            endedByUserId: context.userId,
            version: { increment: 1 },
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          updated.id,
          PayrollActionEntityType.TAX_PROFILE,
          'END',
          profile.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('TAX_PROFILE', updated.id);
      },
      async (id) => {
        const row = await this.prisma.employeeTaxProfile.findUnique({
          where: { id },
        });
        if (!row) {
          this.scope.notFound('Tax profile');
        }
        return this.mapper.toTaxProfile(row);
      },
    );
  }

  async listDeductions(employeeId: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    const employee = await this.scope.assertEmployeeScope(employeeId);

    if (employee.companyId !== companyId) {
      this.scope.notFound('Employee');
    }

    const rows = await this.prisma.employeeDeduction.findMany({
      where: { companyId, employeeId },
      orderBy: { startMonth: 'desc' },
    });

    return rows.map((row) => this.mapper.toDeduction(row));
  }

  async createDeduction(
    employeeId: string,
    dto: CreateEmployeeDeductionDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'CREATE_EMPLOYEE_DEDUCTION',
      { ...dto, employeeId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const startMonth = this.scope.parseDate(dto.startMonth, 'startMonth');
        const endMonth = dto.endMonth
          ? this.scope.parseDate(dto.endMonth, 'endMonth')
          : null;

        if (endMonth && endMonth < startMonth) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.VALIDATION_ERROR,
            'endMonth must be on or after startMonth.',
          );
        }

        const deductionCode = dto.deductionCode
          ? this.scope.normalizeCode(dto.deductionCode)
          : null;

        if (deductionCode) {
          const duplicate = await tx.employeeDeduction.findFirst({
            where: { companyId, deductionCode },
          });
          if (duplicate) {
            throw new DomainConflictException(
              PAYROLL_ERROR_CODES.VALIDATION_ERROR,
              'Deduction code already exists for this Company.',
            );
          }
        }

        const created = await tx.employeeDeduction.create({
          data: {
            companyId,
            employeeId,
            deductionCode,
            deductionName: dto.deductionName.trim(),
            monthlyAmount: this.scope.parseMoney(
              dto.monthlyAmount,
              'monthlyAmount',
            ),
            startMonth,
            endMonth,
            remarks: dto.remarks?.trim() || null,
            createdByUserId: context.userId,
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          created.id,
          PayrollActionEntityType.RECURRING_DEDUCTION,
          'CREATE',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('RECURRING_DEDUCTION', created.id);
      },
      async (id) => {
        const row = await this.prisma.employeeDeduction.findUnique({
          where: { id },
        });
        if (!row) {
          this.scope.notFound('Employee deduction');
        }
        return this.mapper.toDeduction(row);
      },
    );
  }

  async updateDeduction(
    employeeId: string,
    deductionId: string,
    dto: UpdateEmployeeDeductionDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'UPDATE_EMPLOYEE_DEDUCTION',
      { ...dto, employeeId, deductionId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const existing = await tx.employeeDeduction.findFirst({
          where: { id: deductionId, companyId, employeeId },
        });

        if (!existing) {
          this.scope.notFound('Employee deduction');
        }

        this.scope.assertExpectedVersion(existing.version, dto.expectedVersion);

        const endMonth =
          dto.endMonth !== undefined
            ? dto.endMonth
              ? this.scope.parseDate(dto.endMonth, 'endMonth')
              : null
            : existing.endMonth;

        if (endMonth && endMonth < existing.startMonth) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.VALIDATION_ERROR,
            'endMonth must be on or after startMonth.',
          );
        }

        const updated = await tx.employeeDeduction.update({
          where: { id: deductionId },
          data: {
            deductionName: dto.deductionName?.trim() ?? existing.deductionName,
            monthlyAmount: dto.monthlyAmount
              ? this.scope.parseMoney(dto.monthlyAmount, 'monthlyAmount')
              : existing.monthlyAmount,
            endMonth,
            remarks:
              dto.remarks !== undefined
                ? dto.remarks?.trim() || null
                : existing.remarks,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          updated.id,
          PayrollActionEntityType.RECURRING_DEDUCTION,
          'UPDATE',
          existing.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('RECURRING_DEDUCTION', updated.id);
      },
      async (id) => {
        const row = await this.prisma.employeeDeduction.findUnique({
          where: { id },
        });
        if (!row) {
          this.scope.notFound('Employee deduction');
        }
        return this.mapper.toDeduction(row);
      },
    );
  }

  async archiveDeduction(
    employeeId: string,
    deductionId: string,
    dto: ArchiveEmployeeDeductionDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const employee = await this.resolveEmployeeCompany(employeeId);

    return this.receipts.execute(
      context,
      employee.companyId,
      'ARCHIVE_EMPLOYEE_DEDUCTION',
      { ...dto, employeeId, deductionId },
      async (tx) => {
        const employee = await this.scope.assertEmployeeScope(employeeId);
        const companyId = employee.companyId;
        await this.scope.assertCompanyScope(companyId);

        const existing = await tx.employeeDeduction.findFirst({
          where: { id: deductionId, companyId, employeeId },
        });

        if (!existing) {
          this.scope.notFound('Employee deduction');
        }

        this.scope.assertExpectedVersion(existing.version, dto.expectedVersion);

        const updated = await tx.employeeDeduction.update({
          where: { id: deductionId },
          data: {
            isActive: false,
            archivedAt: new Date(),
            archivedByUserId: context.userId,
            archiveReason: dto.reason,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          updated.id,
          PayrollActionEntityType.RECURRING_DEDUCTION,
          'ARCHIVE',
          existing.version,
          updated.version,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        return this.receipts.commandMeta('RECURRING_DEDUCTION', updated.id);
      },
      async (id) => {
        const row = await this.prisma.employeeDeduction.findUnique({
          where: { id },
        });
        if (!row) {
          this.scope.notFound('Employee deduction');
        }
        return this.mapper.toDeduction(row);
      },
    );
  }

  private async resolveEmployeeCompany(employeeId: string) {
    const employee = await this.scope.assertEmployeeScope(employeeId);
    await this.scope.assertCompanyScope(employee.companyId);
    return employee;
  }

  private assertManage(context: PayrollAccessContext) {
    if (!context.permissions.includes(PAYROLL_PERMISSIONS.PAYROLL_MANAGE)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Missing payroll manage permission.',
      );
    }
  }

  private async recordEvent(
    tx: DbClient,
    companyId: string,
    entityId: string,
    entityType: PayrollActionEntityType,
    action: string,
    versionBefore: number,
    versionAfter: number,
    operationId: string,
    actorUserId: string,
    reason?: string,
  ) {
    await this.scope.recordActionEvent(tx, {
      companyId,
      entityType,
      entityId,
      action,
      actorUserId,
      operationId,
      versionBefore,
      versionAfter,
      privateReason: reason ?? null,
    });
  }
}
