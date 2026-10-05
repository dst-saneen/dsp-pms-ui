import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateOnboardingTemplateDto } from '../dto/create-onboarding-template.dto';
import { UpdateOnboardingTemplateDto } from '../dto/update-onboarding-template.dto';
import { TemplateVersionStatus } from '@prisma/client';
import { DomainNotFoundException } from '../../../common';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { OnboardingFeatureGateService } from '../../onboarding-runtime/services/onboarding-feature-gate.service';

@Injectable()
export class OnboardingTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly featureGate: OnboardingFeatureGateService,
  ) {}

  async create(dto: CreateOnboardingTemplateDto) {
    await this.scopeService.assertCompanyInScope(dto.companyId);
    await this.featureGate.assertEnabledForContext(dto.companyId);

    const existing = await this.prisma.onboardingTemplate.findFirst({
      where: {
        companyId: dto.companyId,
        templateName: dto.templateName,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Onboarding template already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.onboardingTemplate.create({
        data: {
          companyId: dto.companyId,
          templateCode: dto.templateCode,
          templateName: dto.templateName,
          description: dto.description,
        },
      });

      await tx.onboardingTemplateVersion.create({
        data: {
          onboardingTemplateId: template.id,
          companyId: dto.companyId,
          versionNo: 1,
          versionName: 'Version 1',
          status: TemplateVersionStatus.DRAFT,
          isCurrent: true,
          rowVersion: 1,
        },
      });

      return template;
    });
  }

  async findAll() {
    await this.featureGate.assertEnabledForContext();

    const templates = await this.prisma.onboardingTemplate.findMany({
      where: {
        isActive: true,
        ...this.scopeService.onboardingTemplateWhere(),
      },

      orderBy: {
        templateName: 'asc',
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

                taskGroups: {
                  include: {
                    tasks: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return templates.map((template) => ({
      ...template,

      version: template.versions[0] ?? null,
    }));
  }

  async findOne(id: string) {
    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id,
        ...this.scopeService.onboardingTemplateWhere(),
      },

      include: {
        versions: {
          orderBy: {
            versionNo: 'desc',
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
                  include: {
                    tasks: {
                      include: {
                        taskGroup: true,
                        assignedDepartment: true,
                        assignedDesignation: true,
                        assignedEmployee: true,
                        approvalWorkflow: true,
                        dependsOnTask: true,
                      },

                      orderBy: {
                        sequenceNo: 'asc',
                      },
                    },
                  },

                  orderBy: {
                    displayOrder: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new DomainNotFoundException(
        'ONBOARDING_TEMPLATE_NOT_FOUND',
        'Onboarding template not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(template.companyId);

    const currentVersion =
      template.versions.find((version) => version.isCurrent) ??
      template.versions[0] ??
      null;

    return {
      ...template,
      version: currentVersion,
    };
  }

  async update(id: string, dto: UpdateOnboardingTemplateDto) {
    const existing = await this.findOne(id);

    if (dto.templateName) {
      const duplicate = await this.prisma.onboardingTemplate.findFirst({
        where: {
          companyId: existing.companyId,
          templateName: dto.templateName,
          NOT: { id },
          isActive: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Onboarding template already exists');
      }
    }

    return this.prisma.onboardingTemplate.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.onboardingTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
