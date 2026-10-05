import { Injectable } from '@nestjs/common';
import { PayrollActionEntityType, Prisma } from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  ArchiveSalaryComponentDto,
  CreateSalaryComponentDto,
  SearchSalaryComponentDto,
  UpdateSalaryComponentDto,
} from '../dto/salary-component.dto';
import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import { PayrollCapabilityService } from './payroll-capability.service';
import { PayrollCommandReceiptService } from './payroll-command-receipt.service';
import { PayrollResponseMapper } from './payroll-response.mapper';
import { PayrollScopeService } from './payroll-scope.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class PayrollSalaryComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly receipts: PayrollCommandReceiptService,
    private readonly capabilities: PayrollCapabilityService,
    private readonly mapper: PayrollResponseMapper,
  ) {}

  async findPage(
    query: SearchSalaryComponentDto,
    context: PayrollAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where: Prisma.SalaryComponentWhereInput = {
      companyId,
      ...(query.includeInactive ? {} : { archivedAt: null, isActive: true }),
      ...(query.keyword
        ? {
            OR: [
              {
                componentCode: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
              {
                componentName: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rows, total] = await Promise.all([
      this.prisma.salaryComponent.findMany({
        where,
        orderBy: { componentCode: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salaryComponent.count({ where }),
    ]);

    return this.mapper.toPaginated(
      rows.map((row) =>
        this.mapper.toSalaryComponent(
          row,
          this.capabilities.getSalaryComponentAllowedActions(row, context),
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const component = await this.prisma.salaryComponent.findFirst({
      where: { id, companyId },
    });

    if (!component) {
      this.scope.notFound('Salary component');
    }

    return this.mapper.toSalaryComponent(
      component,
      this.capabilities.getSalaryComponentAllowedActions(component, context),
    );
  }

  create(dto: CreateSalaryComponentDto, context: PayrollAccessContext) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_SALARY_COMPONENT',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        const componentName = dto.componentName.trim();
        const componentCode = await this.resolveUniqueComponentCode(
          tx,
          companyId,
          dto.componentCode,
          componentName,
        );

        const created = await tx.salaryComponent.create({
          data: {
            companyId,
            componentCode,
            componentName,
            componentType: dto.componentType,
            componentTypeEnum: dto.componentType,
            description: dto.description?.trim() || null,
            createdByUserId: context.userId,
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          created.id,
          'CREATE',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('SALARY_COMPONENT', created.id);
      },
      (id) => this.findOne(id, context),
    );
  }

  update(
    id: string,
    dto: UpdateSalaryComponentDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_SALARY_COMPONENT',
      { ...dto, id },
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        const existing = await tx.salaryComponent.findFirst({
          where: { id, companyId },
        });

        if (!existing) {
          this.scope.notFound('Salary component');
        }

        this.scope.assertExpectedVersion(existing.version, dto.expectedVersion);

        const inUse = await tx.employeeSalaryLine.findFirst({
          where: {
            salaryComponentId: id,
            employeeSalary: {
              payrollRunEmployees: {
                some: {
                  payrollRun: {
                    statusEnum: {
                      in: ['CALCULATED', 'APPROVED', 'PAID', 'LEGACY_IMPORTED'],
                    },
                  },
                },
              },
            },
          },
        });

        if (inUse) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.SALARY_COMPONENT_IN_USE,
            'Salary component is referenced by an immutable payroll calculation.',
          );
        }

        const updated = await tx.salaryComponent.update({
          where: { id },
          data: {
            componentName: dto.componentName?.trim() ?? existing.componentName,
            description:
              dto.description !== undefined
                ? dto.description?.trim() || null
                : existing.description,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          updated.id,
          'UPDATE',
          existing.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('SALARY_COMPONENT', updated.id);
      },
      (entityId) => this.findOne(entityId, context),
    );
  }

  archive(
    id: string,
    dto: ArchiveSalaryComponentDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'ARCHIVE_SALARY_COMPONENT',
      { ...dto, id },
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        const existing = await tx.salaryComponent.findFirst({
          where: { id, companyId },
        });

        if (!existing) {
          this.scope.notFound('Salary component');
        }

        this.scope.assertExpectedVersion(existing.version, dto.expectedVersion);

        const updated = await tx.salaryComponent.update({
          where: { id },
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
          'ARCHIVE',
          existing.version,
          updated.version,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        return this.receipts.commandMeta('SALARY_COMPONENT', updated.id);
      },
      (entityId) => this.findOne(entityId, context),
    );
  }

  private assertManage(context: PayrollAccessContext) {
    if (!context.permissions.includes(PAYROLL_PERMISSIONS.PAYROLL_MANAGE)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Missing payroll manage permission.',
      );
    }
  }

  private async resolveUniqueComponentCode(
    tx: DbClient,
    companyId: string,
    requestedCode: string | undefined,
    componentName: string,
  ): Promise<string> {
    const baseSource = requestedCode?.trim() || componentName;
    let base = this.scope.normalizeCode(baseSource).slice(0, 40);
    if (!base) {
      base = 'COMP';
    }

    let candidate = base;
    let suffix = 2;
    while (
      await tx.salaryComponent.findFirst({
        where: { companyId, componentCode: candidate },
        select: { id: true },
      })
    ) {
      if (requestedCode?.trim()) {
        throw new DomainConflictException(
          PAYROLL_ERROR_CODES.VALIDATION_ERROR,
          'Component code already exists for this Company.',
        );
      }
      const suffixText = `_${suffix}`;
      candidate = `${base.slice(0, Math.max(1, 40 - suffixText.length))}${suffixText}`;
      suffix += 1;
      if (suffix > 999) {
        throw new DomainConflictException(
          PAYROLL_ERROR_CODES.VALIDATION_ERROR,
          'Unable to generate a unique component code.',
        );
      }
    }

    return candidate;
  }

  private async recordEvent(
    tx: DbClient,
    companyId: string,
    entityId: string,
    action: string,
    versionBefore: number,
    versionAfter: number,
    operationId: string,
    actorUserId: string,
    reason?: string,
  ) {
    await this.scope.recordActionEvent(tx, {
      companyId,
      entityType: PayrollActionEntityType.SALARY_COMPONENT,
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
