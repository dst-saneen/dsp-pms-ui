import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OnboardingDepartmentTemplateValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDepartmentTemplateExists(id: string) {
    const departmentTemplate =
      await this.prisma.onboardingDepartmentTemplate.findUnique({
        where: {
          id,
        },
        include: {
          department: true,
          version: true,
        },
      });

    if (!departmentTemplate) {
      throw new NotFoundException('Department Template not found');
    }

    if (!departmentTemplate.isActive) {
      throw new BadRequestException('Department Template is inactive');
    }

    return departmentTemplate;
  }

  async ensureTemplateVersionExists(versionId: string) {
    const version = await this.prisma.onboardingTemplateVersion.findUnique({
      where: {
        id: versionId,
      },
    });

    if (!version) {
      throw new NotFoundException('Onboarding Template Version not found');
    }

    return version;
  }

  async ensureDepartmentExists(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: {
        id: departmentId,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async ensureUniqueDepartment(
    versionId: string,
    departmentId: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.onboardingDepartmentTemplate.findFirst({
      where: {
        onboardingTemplateVersionId: versionId,

        departmentId,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(
        'Department already exists in this template version.',
      );
    }
  }

  async ensureUniqueDisplayOrder(
    versionId: string,
    displayOrder: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.onboardingDepartmentTemplate.findFirst({
      where: {
        onboardingTemplateVersionId: versionId,

        displayOrder,

        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Display Order ${displayOrder} already exists.`,
      );
    }
  }
}
