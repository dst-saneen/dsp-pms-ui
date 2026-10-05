import { BadRequestException, Injectable } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { OrganizationScopeService } from '../auth';
import { ForbiddenException } from '@nestjs/common';
import { NumberSeriesService } from '../number-series';
import { DEFAULT_COMPANY_MODULE_CODES } from '../module-capabilities/company-module-entitlement.service';
import { UpdateCompanyModuleEntitlementsDto } from './dto/update-company-module-entitlements.dto';

const COMPANY_MODULE_DEPENDENCIES: Partial<
  Record<CompanyModuleCode, readonly CompanyModuleCode[]>
> = {
  [CompanyModuleCode.PAYROLL]: [
    CompanyModuleCode.FINANCE,
    CompanyModuleCode.FILE_STORAGE,
  ],
  [CompanyModuleCode.RECRUITMENT_SHORTLIST]: [CompanyModuleCode.RECRUITMENT],
};

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(data: CreateCompanyDto) {
    const scope = this.organizationScope.current();
    let companyGroupId = data.companyGroupId;

    if (!scope.isGlobal) {
      if (scope.scopeLevel !== 'COMPANY_GROUP' || !scope.activeCompanyGroupId) {
        throw new ForbiddenException(
          'Only a global or Organization Owner account can create a company.',
        );
      }

      if (companyGroupId && companyGroupId !== scope.activeCompanyGroupId) {
        throw new NotFoundException('Company Group not found');
      }

      companyGroupId = scope.activeCompanyGroupId;
    } else if (!companyGroupId) {
      throw new ForbiddenException(
        'A Company Group is required when creating a company.',
      );
    }

    const companyCode = await this.numberSeries.next(
      'COMPANY',
      'GLOBAL',
      'COM',
    );
    const company = await this.prisma.company.create({
      data: {
        ...data,
        companyGroupId,
        companyCode,
      },
    });

    await this.auditService.log('Company', company.id, 'CREATE', null, company);

    return company;
  }

  async findAll() {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();
    const companyId = this.organizationScope.companyIdOrUndefined();

    return this.prisma.company.findMany({
      where: companyGroupId
        ? { companyGroupId }
        : companyId
          ? { id: companyId }
          : undefined,
      include: {
        companyGroup: true,
        parentCompany: {
          select: {
            id: true,
            companyCode: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        companyName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();
    const companyId = this.organizationScope.companyIdOrUndefined();

    if (!companyGroupId && companyId && companyId !== id) {
      throw new NotFoundException('Company not found');
    }

    const company = await this.prisma.company.findFirst({
      where: {
        id,
        ...(companyGroupId ? { companyGroupId } : {}),
      },
      include: {
        companyGroup: true,
        parentCompany: {
          select: {
            id: true,
            companyCode: true,
            companyName: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async findModuleEntitlements(id: string) {
    await this.findOne(id);
    const rows = await this.prisma.companyModuleEntitlement.findMany({
      where: { companyId: id },
      select: { module: true, isEnabled: true },
    });
    const enabledByModule = new Map(
      rows.map((row) => [row.module, row.isEnabled]),
    );

    return {
      companyId: id,
      entitlements: DEFAULT_COMPANY_MODULE_CODES.map((module) => ({
        module,
        isEnabled: enabledByModule.get(module) ?? false,
      })),
    };
  }

  async updateModuleEntitlements(
    id: string,
    dto: UpdateCompanyModuleEntitlementsDto,
  ) {
    const current = await this.findModuleEntitlements(id);
    const nextByModule = new Map(
      current.entitlements.map((entitlement) => [
        entitlement.module,
        entitlement.isEnabled,
      ]),
    );

    for (const entitlement of dto.entitlements) {
      nextByModule.set(entitlement.module, entitlement.isEnabled);
    }

    this.assertValidModuleDependencies(nextByModule);

    const next = DEFAULT_COMPANY_MODULE_CODES.map((module) => ({
      module,
      isEnabled: nextByModule.get(module) ?? false,
    }));

    await this.prisma.$transaction(async (tx) => {
      for (const entitlement of dto.entitlements) {
        await tx.companyModuleEntitlement.upsert({
          where: {
            companyId_module: {
              companyId: id,
              module: entitlement.module,
            },
          },
          create: {
            companyId: id,
            module: entitlement.module,
            isEnabled: entitlement.isEnabled,
          },
          update: { isEnabled: entitlement.isEnabled },
        });
      }

      await this.auditService.log(
        'CompanyModuleEntitlement',
        id,
        'UPDATE',
        current.entitlements,
        next,
        { tx },
      );
    });

    return { companyId: id, entitlements: next };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const oldCompany = await this.findOne(id);
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();

    if (
      companyGroupId &&
      dto.companyGroupId &&
      dto.companyGroupId !== companyGroupId
    ) {
      throw new NotFoundException('Company Group not found');
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: {
        ...dto,
        ...(companyGroupId ? { companyGroupId } : {}),
      },
    });

    await this.auditService.log(
      'Company',
      id,
      'UPDATE',
      oldCompany,
      updatedCompany,
    );

    return updatedCompany;
  }

  async remove(id: string) {
    const company = await this.findOne(id);

    await this.auditService.log('Company', id, 'DELETE', company, null);

    return this.prisma.company.delete({
      where: { id },
    });
  }

  private assertValidModuleDependencies(
    enabledByModule: ReadonlyMap<CompanyModuleCode, boolean>,
  ): void {
    for (const [module, dependencies] of Object.entries(
      COMPANY_MODULE_DEPENDENCIES,
    ) as Array<[CompanyModuleCode, readonly CompanyModuleCode[]]>) {
      if (!enabledByModule.get(module)) {
        continue;
      }

      const missing = dependencies.filter(
        (dependency) => !enabledByModule.get(dependency),
      );
      if (missing.length === 0) {
        continue;
      }

      if (module === CompanyModuleCode.PAYROLL) {
        throw new BadRequestException(
          'Payroll requires Finance and File storage to be enabled.',
        );
      }

      throw new BadRequestException(
        'Recruitment shortlist requires Recruitment to be enabled.',
      );
    }
  }
}
