import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OnboardingTaskGroupValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDepartmentTemplateExists(id: string) {
    const departmentTemplate =
      await this.prisma.onboardingDepartmentTemplate.findUnique({
        where: {
          id,
        },
      });

    if (!departmentTemplate) {
      throw new NotFoundException('Onboarding department template not found.');
    }

    return departmentTemplate;
  }

  async ensureTaskGroupExists(id: string) {
    const taskGroup = await this.prisma.onboardingTaskGroup.findUnique({
      where: {
        id,
      },
    });

    if (!taskGroup) {
      throw new NotFoundException('Onboarding task group not found.');
    }

    return taskGroup;
  }

  async ensureUniqueGroupName(
    departmentTemplateId: string,
    groupName: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.onboardingTaskGroup.findFirst({
      where: {
        onboardingDepartmentTemplateId: departmentTemplateId,

        groupName,

        ...(excludeId
          ? {
              NOT: {
                id: excludeId,
              },
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Task group already exists.');
    }
  }

  async ensureUniqueDisplayOrder(
    departmentTemplateId: string,
    displayOrder: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.onboardingTaskGroup.findFirst({
      where: {
        onboardingDepartmentTemplateId: departmentTemplateId,

        displayOrder,

        ...(excludeId
          ? {
              NOT: {
                id: excludeId,
              },
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Display order already exists.');
    }
  }
}
