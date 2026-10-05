import { BadRequestException, Injectable } from '@nestjs/common';

import { EmployeeDocumentCategoryRepository } from './repositories/employee-document-category.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { CreateEmployeeDocumentCategoryDto } from './dto/create-employee-document-category.dto';
import { UpdateEmployeeDocumentCategoryDto } from './dto/update-employee-document-category.dto';

@Injectable()
export class EmployeeDocumentCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: EmployeeDocumentCategoryRepository,
    private readonly auditService: AuditService,
    private readonly scope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateEmployeeDocumentCategoryDto) {
    await this.scope.assertCompanyInScope(dto.companyId);

    const duplicateCode = await this.repository.findFirst({
      where: {
        companyId: dto.companyId,
        categoryCode: dto.categoryCode.trim().toUpperCase(),
      },
    });

    if (duplicateCode) {
      throw new BadRequestException('Category code already exists');
    }

    const duplicateName = await this.repository.findFirst({
      where: {
        companyId: dto.companyId,
        categoryName: dto.categoryName.trim(),
      },
    });

    if (duplicateName) {
      throw new BadRequestException('Category name already exists');
    }

    const category = await this.repository.create({
      data: {
        companyId: dto.companyId,
        categoryCode: dto.categoryCode.trim().toUpperCase(),
        categoryName: dto.categoryName.trim(),
        description: dto.description?.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.log(
      'EmployeeDocumentCategory',
      category.id,
      'CREATE',
      null,
      category,
    );

    return category;
  }

  async findAll(companyId?: string) {
    return this.repository.findMany({
      where: {
        ...this.scope.documentCategoryWhere(),
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: true,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          categoryName: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const category = await this.repository.findFirst({
      where: {
        id,
        ...this.scope.documentCategoryWhere(),
      },
      include: {
        company: true,
      },
    });

    if (!category) {
      this.scope.notFound('Document category');
    }

    return category;
  }

  async lookup(companyId?: string) {
    return this.prisma.employeeDocumentCategory.findMany({
      where: {
        ...this.scope.documentCategoryWhere(),
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
      select: {
        id: true,
        categoryCode: true,
        categoryName: true,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          categoryName: 'asc',
        },
      ],
    });
  }

  async summary() {
    const scopeWhere = this.scope.documentCategoryWhere();

    const [total, active] = await Promise.all([
      this.prisma.employeeDocumentCategory.count({ where: scopeWhere }),
      this.prisma.employeeDocumentCategory.count({
        where: {
          ...scopeWhere,
          isActive: true,
        },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
    };
  }

  async update(id: string, dto: UpdateEmployeeDocumentCategoryDto) {
    const oldCategory = await this.findOne(id);

    if (dto.categoryCode) {
      const duplicate = await this.repository.findFirst({
        where: {
          companyId: oldCategory.companyId,
          categoryCode: dto.categoryCode.trim().toUpperCase(),
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new BadRequestException('Category code already exists');
      }
    }

    if (dto.categoryName) {
      const duplicate = await this.repository.findFirst({
        where: {
          companyId: oldCategory.companyId,
          categoryName: dto.categoryName.trim(),
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new BadRequestException('Category name already exists');
      }
    }

    const updatedCategory = await this.repository.update({
      where: {
        id,
      },
      data: {
        ...dto,
        categoryCode: dto.categoryCode?.trim().toUpperCase(),
        categoryName: dto.categoryName?.trim(),
        description: dto.description?.trim(),
      },
    });

    await this.auditService.log(
      'EmployeeDocumentCategory',
      id,
      'UPDATE',
      oldCategory,
      updatedCategory,
    );

    return updatedCategory;
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    const inUse = await this.isCategoryInUse(id);

    if (inUse) {
      const deactivated = await this.repository.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditService.log(
        'EmployeeDocumentCategory',
        id,
        'DEACTIVATE',
        category,
        deactivated,
      );

      return deactivated;
    }

    await this.auditService.log(
      'EmployeeDocumentCategory',
      id,
      'DELETE',
      category,
      null,
    );

    return this.repository.delete({
      where: {
        id,
      },
    });
  }

  private async isCategoryInUse(id: string) {
    const [documentTypeCount, documentCount] = await Promise.all([
      this.prisma.employeeDocumentType.count({
        where: {
          categoryId: id,
        },
      }),
      this.prisma.employeeDocument.count({
        where: {
          documentType: {
            categoryId: id,
          },
        },
      }),
    ]);

    return documentTypeCount > 0 || documentCount > 0;
  }
}
