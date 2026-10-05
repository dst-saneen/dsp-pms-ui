import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DepartmentTemplateReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByTemplateVersion(templateVersionId: string) {
    return this.prisma.onboardingDepartmentTemplate.findMany({
      where: {
        onboardingTemplateVersionId: templateVersionId,

        isActive: true,
      },

      include: {
        department: true,
        approvalWorkflow: true,
      },

      orderBy: {
        displayOrder: 'asc',
      },
    });
  }
}
