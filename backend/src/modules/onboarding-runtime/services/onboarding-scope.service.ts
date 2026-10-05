import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainNotFoundException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';
import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';

@Injectable()
export class OnboardingScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeScope: EmployeeDomainScopeService,
    private readonly featureGate: OnboardingFeatureGateService,
  ) {}

  async assertVersionInScope(versionId: string) {
    const version = await this.prisma.onboardingTemplateVersion.findFirst({
      where: {
        id: versionId,
        ...this.employeeScope.onboardingTemplateVersionWhere(),
      },
      include: {
        onboardingTemplate: true,
      },
    });

    if (!version) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_FOUND,
        'Onboarding template version not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(
      version.companyId ?? version.onboardingTemplate.companyId,
    );

    return version;
  }

  async assertDepartmentTemplateInScope(departmentTemplateId: string) {
    const row = await this.prisma.onboardingDepartmentTemplate.findFirst({
      where: {
        id: departmentTemplateId,
        version: this.employeeScope.onboardingTemplateVersionWhere(),
      },
    });

    if (!row) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_FOUND,
        'Onboarding department template not found.',
      );
    }

    await this.assertVersionInScope(row.onboardingTemplateVersionId);

    return row;
  }

  async assertTaskGroupInScope(taskGroupId: string) {
    const row = await this.prisma.onboardingTaskGroup.findFirst({
      where: {
        id: taskGroupId,
        departmentTemplate: {
          version: this.employeeScope.onboardingTemplateVersionWhere(),
        },
      },
    });

    if (!row) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_FOUND,
        'Onboarding task group not found.',
      );
    }

    await this.assertDepartmentTemplateInScope(
      row.onboardingDepartmentTemplateId,
    );

    return row;
  }

  async assertTaskInScope(taskId: string) {
    const row = await this.prisma.onboardingTemplateTask.findFirst({
      where: {
        id: taskId,
        taskGroup: {
          departmentTemplate: {
            version: this.employeeScope.onboardingTemplateVersionWhere(),
          },
        },
      },
    });

    if (!row) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_FOUND,
        'Onboarding template task not found.',
      );
    }

    await this.assertTaskGroupInScope(row.taskGroupId);

    return row;
  }

  async assertOnboardingInScope(onboardingId: string) {
    const row = await this.prisma.employeeOnboarding.findFirst({
      where: {
        id: onboardingId,
        ...this.employeeScope.onboardingWhere(),
      },
    });

    if (!row) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_NOT_FOUND,
        'Employee onboarding not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(row.companyId);

    return row;
  }

  async loadVersion(versionId: string) {
    return this.assertVersionInScope(versionId);
  }

  async loadDepartmentTemplates(versionId: string) {
    await this.assertVersionInScope(versionId);

    return this.prisma.onboardingDepartmentTemplate.findMany({
      where: {
        onboardingTemplateVersionId: versionId,
        version: this.employeeScope.onboardingTemplateVersionWhere(),
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

  async loadTaskGroups(departmentTemplateIds: string[]) {
    if (departmentTemplateIds.length === 0) {
      return [];
    }

    await Promise.all(
      departmentTemplateIds.map((id) =>
        this.assertDepartmentTemplateInScope(id),
      ),
    );

    return this.prisma.onboardingTaskGroup.findMany({
      where: {
        onboardingDepartmentTemplateId: {
          in: departmentTemplateIds,
        },
        departmentTemplate: {
          version: this.employeeScope.onboardingTemplateVersionWhere(),
        },
      },
      orderBy: [
        { onboardingDepartmentTemplateId: 'asc' },
        { displayOrder: 'asc' },
      ],
    });
  }

  async loadTemplateTasks(taskGroupIds: string[]) {
    if (taskGroupIds.length === 0) {
      return [];
    }

    await Promise.all(
      taskGroupIds.map((id) => this.assertTaskGroupInScope(id)),
    );

    return this.prisma.onboardingTemplateTask.findMany({
      where: {
        taskGroupId: {
          in: taskGroupIds,
        },
        taskGroup: {
          departmentTemplate: {
            version: this.employeeScope.onboardingTemplateVersionWhere(),
          },
        },
      },
      include: {
        assignedDepartment: true,
        assignedDesignation: true,
        assignedEmployee: true,
        approvalWorkflow: true,
        dependsOnTask: {
          select: {
            id: true,
            taskName: true,
          },
        },
      },
      orderBy: [{ taskGroupId: 'asc' }, { sequenceNo: 'asc' }],
    });
  }

  async loadOnboarding(onboardingId: string) {
    const row = await this.prisma.employeeOnboarding.findFirst({
      where: {
        id: onboardingId,
        ...this.employeeScope.onboardingWhere(),
      },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            branch: { include: { company: true } },
            user: { select: { id: true, displayName: true } },
          },
        },
        template: true,
        templateVersion: true,
        tasks: {
          orderBy: { sequenceNo: 'asc' },
          include: {
            assignedToUser: {
              select: {
                id: true,
                displayName: true,
                employee: { select: { id: true, employeeCode: true } },
              },
            },
            assignedByUser: { select: { id: true, displayName: true } },
            assignedDepartment: true,
            executorDepartment: true,
            dependsOnTask: {
              select: {
                id: true,
                taskName: true,
                status: true,
                statusV2: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_NOT_FOUND,
        'Employee onboarding not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(row.companyId);

    return row;
  }

  onboardingTemplateTaskWhere(): Prisma.OnboardingTemplateTaskWhereInput {
    return this.employeeScope.onboardingTemplateTaskWhere();
  }
}
