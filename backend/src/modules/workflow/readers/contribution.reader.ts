import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ContributionReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByDepartmentTemplateIds(departmentTemplateIds: string[]) {
    if (!departmentTemplateIds.length) {
      return [];
    }

    return this.prisma.contribution.findMany({
      where: {
        onboardingDepartmentTemplateId: {
          in: departmentTemplateIds,
        },
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }
}
