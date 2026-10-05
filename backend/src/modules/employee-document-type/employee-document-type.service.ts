import { BadRequestException, Injectable } from '@nestjs/common';

import { DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { CreateEmployeeDocumentTypeDto } from './dto/create-employee-document-type.dto';
import { UpdateEmployeeDocumentTypeDto } from './dto/update-employee-document-type.dto';

@Injectable()
export class EmployeeDocumentTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateEmployeeDocumentTypeDto) {
    await this.scope.assertCompanyInScope(dto.companyId);

    const category = await this.prisma.employeeDocumentCategory.findFirst({
      where: {
        id: dto.categoryId,
        ...this.scope.documentCategoryWhere(),
      },
    });

    if (!category) {
      throw new DomainNotFoundException(
        'DOCUMENT_CATEGORY_NOT_FOUND',
        'Document category not found',
      );
    }

    if (category.companyId !== dto.companyId) {
      throw new BadRequestException(
        'Document category must belong to the same company',
      );
    }

    const exists = await this.prisma.employeeDocumentType.findFirst({
      where: {
        companyId: dto.companyId,
        documentCode: dto.documentCode.trim().toUpperCase(),
      },
    });

    if (exists) {
      throw new BadRequestException('Document type already exists');
    }

    return this.prisma.employeeDocumentType.create({
      data: {
        companyId: dto.companyId,
        categoryId: dto.categoryId,
        documentCode: dto.documentCode.trim().toUpperCase(),
        documentName: dto.documentName.trim(),
        description: dto.description?.trim(),
        requiresExpiry: dto.requiresExpiry,
        requiresDocumentNumber: dto.requiresDocumentNumber,
        requiresVerification: dto.requiresVerification,
        lifetimeAllowed: dto.lifetimeAllowed,
        isMandatory: dto.isMandatory,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async findAll() {
    return this.prisma.employeeDocumentType.findMany({
      where: this.scope.documentTypeWhere(),
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        category: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
          },
        },
      },
      orderBy: {
        documentName: 'asc',
      },
    });
  }

  async summary() {
    const scopeWhere = this.scope.documentTypeWhere();

    const [total, active, inactive] = await Promise.all([
      this.prisma.employeeDocumentType.count({ where: scopeWhere }),
      this.prisma.employeeDocumentType.count({
        where: {
          ...scopeWhere,
          isActive: true,
        },
      }),
      this.prisma.employeeDocumentType.count({
        where: {
          ...scopeWhere,
          isActive: false,
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
    };
  }

  async findOne(id: string) {
    const documentType = await this.prisma.employeeDocumentType.findFirst({
      where: {
        id,
        ...this.scope.documentTypeWhere(),
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        category: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
          },
        },
      },
    });

    if (!documentType) {
      throw new DomainNotFoundException(
        'DOCUMENT_TYPE_NOT_FOUND',
        'Document type not found',
      );
    }

    return documentType;
  }

  async update(id: string, dto: UpdateEmployeeDocumentTypeDto) {
    const current = await this.findOne(id);

    if (dto.categoryId) {
      const category = await this.prisma.employeeDocumentCategory.findFirst({
        where: {
          id: dto.categoryId,
          ...this.scope.documentCategoryWhere(),
        },
      });

      if (!category) {
        throw new DomainNotFoundException(
          'DOCUMENT_CATEGORY_NOT_FOUND',
          'Document category not found',
        );
      }

      if (category.companyId !== current.companyId) {
        throw new BadRequestException(
          'Document category must belong to the same company',
        );
      }
    }

    if (dto.documentCode) {
      const duplicate = await this.prisma.employeeDocumentType.findFirst({
        where: {
          companyId: current.companyId,
          documentCode: dto.documentCode.trim().toUpperCase(),
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new BadRequestException('Document type already exists');
      }
    }

    return this.prisma.employeeDocumentType.update({
      where: { id },
      data: {
        ...dto,
        documentCode: dto.documentCode?.trim().toUpperCase(),
        documentName: dto.documentName?.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const documentCount = await this.prisma.employeeDocument.count({
      where: {
        documentTypeId: id,
      },
    });

    if (documentCount > 0) {
      return this.prisma.employeeDocumentType.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.employeeDocumentType.delete({
      where: {
        id,
      },
    });
  }
}
