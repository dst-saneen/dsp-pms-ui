import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma, TemplateVersionStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingTemplateScopeService } from './onboarding-template-scope.service';

import {
  CloneTaskResultContract,
  DependencyMappingContract,
} from '../contracts';

const versionInclude = {
  scopes: true,
  departments: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      taskGroups: {
        orderBy: { displayOrder: 'asc' as const },
        include: {
          tasks: {
            orderBy: { sequenceNo: 'asc' as const },
          },
        },
      },
    },
  },
} satisfies Prisma.OnboardingTemplateVersionInclude;

type SourceVersion = Prisma.OnboardingTemplateVersionGetPayload<{
  include: typeof versionInclude;
}>;

@Injectable()
export class OnboardingTemplateCloneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async createDraft(versionId: string) {
    await this.templateScope.requireVersion(versionId);

    return this.prisma.$transaction(async (tx) => {
      const sourceVersion = await tx.onboardingTemplateVersion.findUnique({
        where: { id: versionId },
        include: versionInclude,
      });

      if (!sourceVersion) {
        throw new NotFoundException('Template version not found.');
      }

      const targetVersion = await this.cloneVersion(tx, sourceVersion);

      await this.cloneScopes(tx, sourceVersion, targetVersion.id);

      const departmentMap = await this.cloneDepartments(
        tx,
        sourceVersion,
        targetVersion.id,
      );

      const taskGroupMap = await this.cloneTaskGroups(
        tx,
        sourceVersion,
        departmentMap,
        targetVersion,
      );

      const { taskMap, dependencyMappings } = await this.cloneTasks(
        tx,
        sourceVersion,
        taskGroupMap,
        targetVersion,
      );

      await this.remapDependencies(tx, taskMap, dependencyMappings);

      return targetVersion;
    });
  }

  private async cloneVersion(
    tx: Prisma.TransactionClient,
    sourceVersion: SourceVersion,
  ) {
    const latestVersion = await tx.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId: sourceVersion.onboardingTemplateId,
      },
      orderBy: { versionNo: 'desc' },
    });

    const nextVersionNo = latestVersion ? latestVersion.versionNo + 1 : 1;

    const root = await tx.onboardingTemplate.findUnique({
      where: { id: sourceVersion.onboardingTemplateId },
      select: { companyId: true },
    });

    // Draft becomes the editable current version; published stays PUBLISHED
    // with isCurrent=false so runtime resolution can still find it.
    await tx.onboardingTemplateVersion.updateMany({
      where: {
        onboardingTemplateId: sourceVersion.onboardingTemplateId,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    return tx.onboardingTemplateVersion.create({
      data: {
        onboardingTemplateId: sourceVersion.onboardingTemplateId,
        companyId: sourceVersion.companyId ?? root?.companyId ?? null,
        versionNo: nextVersionNo,
        versionName: `Version ${nextVersionNo}`,
        status: TemplateVersionStatus.DRAFT,
        isCurrent: true,
        effectiveFrom: null,
        publishedAt: null,
        publishedByUserId: null,
        changeSummary: sourceVersion.changeSummary,
        rowVersion: 1,
      },
    });
  }

  private async cloneScopes(
    tx: Prisma.TransactionClient,
    sourceVersion: SourceVersion,
    targetVersionId: string,
  ) {
    for (const scope of sourceVersion.scopes) {
      await tx.onboardingTemplateScope.create({
        data: {
          onboardingTemplateVersionId: targetVersionId,
          companyId: scope.companyId,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          designationId: scope.designationId,
          employeeType: scope.employeeType,
          priority: scope.priority,
          isActive: scope.isActive,
          description: scope.description,
        },
      });
    }
  }

  private async cloneDepartments(
    tx: Prisma.TransactionClient,
    sourceVersion: SourceVersion,
    targetVersionId: string,
  ) {
    const departmentMap = new Map<string, string>();

    for (const department of sourceVersion.departments) {
      const clonedDepartment = await tx.onboardingDepartmentTemplate.create({
        data: {
          onboardingTemplateVersionId: targetVersionId,
          departmentId: department.departmentId,
          companyId: department.companyId ?? sourceVersion.companyId,
          branchId: department.branchId,
          displayOrder: department.displayOrder,
          isRequired: department.isRequired,
          isActive: department.isActive,
          approvalWorkflowId: null,
          rowVersion: 1,
        },
      });

      departmentMap.set(department.id, clonedDepartment.id);
    }

    return departmentMap;
  }

  private async cloneTaskGroups(
    tx: Prisma.TransactionClient,
    sourceVersion: SourceVersion,
    departmentMap: Map<string, string>,
    targetVersion: { id: string; companyId: string | null },
  ) {
    const taskGroupMap = new Map<string, string>();

    for (const department of sourceVersion.departments) {
      const targetDepartmentId = departmentMap.get(department.id);

      if (!targetDepartmentId) {
        continue;
      }

      for (const group of department.taskGroups) {
        const clonedGroup = await tx.onboardingTaskGroup.create({
          data: {
            onboardingDepartmentTemplateId: targetDepartmentId,
            companyId: targetVersion.companyId ?? group.companyId,
            onboardingTemplateVersionId: targetVersion.id,
            groupCode: group.groupCode,
            groupName: group.groupName,
            description: group.description,
            displayOrder: group.displayOrder,
            isMandatory: group.isMandatory,
            isActive: group.isActive,
            rowVersion: 1,
          },
        });

        taskGroupMap.set(group.id, clonedGroup.id);
      }
    }

    return taskGroupMap;
  }

  private async cloneTasks(
    tx: Prisma.TransactionClient,
    sourceVersion: SourceVersion,
    taskGroupMap: Map<string, string>,
    targetVersion: {
      id: string;
      companyId: string | null;
      onboardingTemplateId: string;
    },
  ): Promise<CloneTaskResultContract> {
    const taskMap = new Map<string, string>();
    const dependencyMappings: DependencyMappingContract[] = [];

    for (const department of sourceVersion.departments) {
      for (const group of department.taskGroups) {
        const targetGroupId = taskGroupMap.get(group.id);

        if (!targetGroupId) {
          continue;
        }

        for (const task of group.tasks) {
          const clonedTask = await tx.onboardingTemplateTask.create({
            data: {
              onboardingTemplateId: targetVersion.onboardingTemplateId,
              onboardingTemplateVersionId: targetVersion.id,
              companyId: targetVersion.companyId ?? task.companyId,
              taskGroupId: targetGroupId,
              taskName: task.taskName,
              description: task.description,
              sequenceNo: task.sequenceNo,
              priority: task.priority,
              isMandatory: task.isMandatory,
              allowSkip: task.allowSkip,
              allowResubmit: task.allowResubmit,
              allowReopen: task.allowReopen,
              autoComplete: false,
              workType: task.workType,
              ownerType: task.ownerType,
              referenceType: task.referenceType,
              referenceId: task.referenceId,
              approvalWorkflowId: null,
              assignedDepartmentId:
                task.ownerType === 'DEPARTMENT'
                  ? department.departmentId
                  : null,
              assignedDesignationId: null,
              assignedEmployeeId: null,
              dueDays: task.dueDays,
              reminderIntervalDays: task.reminderIntervalDays,
              estimatedDurationMinutes: task.estimatedDurationMinutes,
              dependsOnTaskId: null,
              rowVersion: 1,
            },
          });

          taskMap.set(task.id, clonedTask.id);

          dependencyMappings.push({
            oldTaskId: task.id,
            newTaskId: clonedTask.id,
            oldDependsOnTaskId: task.dependsOnTaskId,
          });
        }
      }
    }

    return { taskMap, dependencyMappings };
  }

  private async remapDependencies(
    tx: Prisma.TransactionClient,
    taskMap: Map<string, string>,
    dependencyMappings: DependencyMappingContract[],
  ) {
    for (const mapping of dependencyMappings) {
      if (!mapping.oldDependsOnTaskId) {
        continue;
      }

      const newDependsOnTaskId = taskMap.get(mapping.oldDependsOnTaskId);

      if (!newDependsOnTaskId) {
        continue;
      }

      await tx.onboardingTemplateTask.update({
        where: { id: mapping.newTaskId },
        data: { dependsOnTaskId: newDependsOnTaskId },
      });
    }
  }
}
