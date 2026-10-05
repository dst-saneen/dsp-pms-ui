import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from './onboarding-template-scope.service';

@Injectable()
export class OnboardingTemplateQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.onboardingTemplate.findMany({
      where: {
        isActive: true,
        ...this.templateScope.templateWhere(),
      },
      orderBy: {
        templateName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    await this.templateScope.requireTemplate(id);

    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id,
        ...this.templateScope.templateWhere(),
      },

      include: {
        versions: {
          where: {
            isCurrent: true,
          },

          include: {
            departments: {
              orderBy: {
                displayOrder: 'asc',
              },

              include: {
                department: true,
                approvalWorkflow: true,

                taskGroups: {
                  orderBy: {
                    displayOrder: 'asc',
                  },

                  include: {
                    tasks: {
                      orderBy: {
                        sequenceNo: 'asc',
                      },

                      include: {
                        taskGroup: true,
                        assignedDepartment: true,
                        assignedDesignation: true,
                        assignedEmployee: true,
                        approvalWorkflow: true,
                        dependsOnTask: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Onboarding template not found');
    }

    return {
      ...template,

      version: template.versions[0] ?? null,
    };
  }
}
