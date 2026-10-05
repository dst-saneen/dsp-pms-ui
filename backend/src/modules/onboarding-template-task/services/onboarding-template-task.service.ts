import { ConflictException, Injectable } from '@nestjs/common';
import {
  AssetTrackingMode,
  ReferenceType,
  WorkOwnerType,
  WorkType,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  CreateOnboardingTemplateTaskDto,
  UpdateOnboardingTemplateTaskDto,
} from '../dto';

import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';
import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../../onboarding-template/constants';

const TASK_INCLUDE = {
  taskGroup: true,
  assignedDepartment: true,
  dependsOnTask: true,
} as const;

@Injectable()
export class OnboardingTemplateTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async findOne(id: string) {
    return this.templateScope.requireTask(id);
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.onboardingTemplateTask.findMany({
      where: this.templateScope.taskWhere(),
      include: {
        taskGroup: true,
        assignedDepartment: true,
      },
      orderBy: [
        {
          sequenceNo: 'asc',
        },
      ],
    });
  }

  async findByTaskGroup(taskGroupId: string) {
    await this.templateScope.requireTaskGroup(taskGroupId);

    return this.prisma.onboardingTemplateTask.findMany({
      where: {
        taskGroupId,
        ...this.templateScope.taskWhere(),
      },
      include: {
        assignedDepartment: true,
      },
      orderBy: {
        sequenceNo: 'asc',
      },
    });
  }

  async create(dto: CreateOnboardingTemplateTaskDto) {
    const group = await this.templateScope.requireTaskGroup(dto.taskGroupId);
    const version = await this.templateScope.requireMutableVersion(
      group.departmentTemplate.onboardingTemplateVersionId,
    );
    const companyId = this.templateScope.resolveVersionCompanyId(version);
    const enclosingDepartmentId = group.departmentTemplate.departmentId;
    const assignedDepartmentId =
      dto.ownerType === WorkOwnerType.DEPARTMENT ? enclosingDepartmentId : null;

    await this.assertUniqueName(group.id, dto.taskName);
    await this.assertUniqueSequence(group.id, dto.sequenceNo);
    await this.assertDependencyInVersion(version.id, dto.dependsOnTaskId);
    await this.assertAssetReference(
      companyId,
      dto.workType,
      dto.referenceType,
      dto.referenceId,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, version.id);
      return tx.onboardingTemplateTask.create({
        data: {
          onboardingTemplateId: version.onboardingTemplateId,
          onboardingTemplateVersionId: version.id,
          companyId,
          taskGroupId: group.id,
          taskName: dto.taskName,
          description: dto.description,
          sequenceNo: dto.sequenceNo,
          priority: dto.priority ?? 0,
          isMandatory: dto.isMandatory,
          allowSkip: dto.allowSkip,
          allowResubmit: dto.allowReopen ?? true,
          allowReopen: dto.allowReopen,
          workType: dto.workType,
          ownerType: dto.ownerType,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          assignedDepartmentId,
          assignedDesignationId: null,
          assignedEmployeeId: null,
          approvalWorkflowId: null,
          dependsOnTaskId: dto.dependsOnTaskId,
          dueDays: dto.dueDays,
          rowVersion: 1,
        },
        include: TASK_INCLUDE,
      });
    });
  }

  async update(id: string, dto: UpdateOnboardingTemplateTaskDto) {
    const existing = await this.templateScope.requireTask(id);
    const taskGroup = existing.taskGroup;
    if (!taskGroup) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TASK_GROUP_NOT_FOUND,
        'Task group not found.',
      );
    }
    const versionId = taskGroup.departmentTemplate.onboardingTemplateVersionId;
    const version = await this.templateScope.requireMutableVersion(versionId);
    this.templateScope.assertRowVersion(
      dto.expectedVersion,
      dto.expectedVersion,
    );

    const companyId = this.templateScope.resolveVersionCompanyId(version);
    const enclosingDepartmentId = taskGroup.departmentTemplate.departmentId;
    const nextOwnerType = dto.ownerType ?? existing.ownerType;
    const nextWorkType = dto.workType ?? existing.workType;
    const nextReferenceType =
      dto.referenceType === undefined
        ? existing.referenceType
        : dto.referenceType;
    const nextReferenceId =
      dto.referenceId === undefined ? existing.referenceId : dto.referenceId;
    const normalizedReferenceType =
      nextWorkType === WorkType.ASSET ? nextReferenceType : null;
    const normalizedReferenceId =
      nextWorkType === WorkType.ASSET ? nextReferenceId : null;

    if (dto.taskName && dto.taskName !== existing.taskName) {
      await this.assertUniqueName(existing.taskGroupId, dto.taskName, id);
    }

    if (
      dto.sequenceNo !== undefined &&
      dto.sequenceNo !== existing.sequenceNo
    ) {
      await this.assertUniqueSequence(existing.taskGroupId, dto.sequenceNo, id);
    }

    const nextDependsOnTaskId =
      dto.dependsOnTaskId === undefined
        ? existing.dependsOnTaskId
        : dto.dependsOnTaskId;

    await this.assertDependencyInVersion(version.id, nextDependsOnTaskId);
    await this.assertAssetReference(
      companyId,
      nextWorkType,
      normalizedReferenceType,
      normalizedReferenceId,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, version.id);
      const result = await tx.onboardingTemplateTask.updateMany({
        where: { id },
        data: {
          taskName: dto.taskName,
          description: dto.description,
          sequenceNo: dto.sequenceNo,
          priority: dto.priority,
          isMandatory: dto.isMandatory,
          allowSkip: dto.allowSkip,
          allowReopen: dto.allowReopen,
          workType: dto.workType,
          ownerType: dto.ownerType,
          referenceType: normalizedReferenceType,
          referenceId: normalizedReferenceId,
          assignedDepartmentId:
            nextOwnerType === WorkOwnerType.DEPARTMENT
              ? enclosingDepartmentId
              : null,
          assignedDesignationId: null,
          assignedEmployeeId: null,
          approvalWorkflowId: null,
          dependsOnTaskId: nextDependsOnTaskId,
          dueDays: dto.dueDays,
        },
      });
      this.templateScope.assertMutationApplied(result.count);
    });

    return this.templateScope.requireTask(id);
  }

  async remove(id: string, expectedVersion: number) {
    void expectedVersion;
    const existing = await this.templateScope.requireTask(id);
    if (!existing.taskGroup) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TASK_GROUP_NOT_FOUND,
        'Task group not found.',
      );
    }
    const versionId =
      existing.taskGroup.departmentTemplate.onboardingTemplateVersionId;
    await this.templateScope.requireMutableVersion(versionId);

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, versionId);
      const result = await tx.onboardingTemplateTask.deleteMany({
        where: { id },
      });
      this.templateScope.assertMutationApplied(result.count);
      return existing;
    });
  }

  private async assertUniqueName(
    taskGroupId: string,
    taskName: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.onboardingTemplateTask.findFirst({
      where: {
        taskGroupId,
        taskName,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        ...this.templateScope.taskWhere(),
      },
    });

    if (duplicate) {
      throw new ConflictException('Task already exists.');
    }
  }

  private async assertUniqueSequence(
    taskGroupId: string,
    sequenceNo: number,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.onboardingTemplateTask.findFirst({
      where: {
        taskGroupId,
        sequenceNo,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        ...this.templateScope.taskWhere(),
      },
    });

    if (duplicate) {
      throw new ConflictException('Sequence number already exists.');
    }
  }

  private async assertDependencyInVersion(
    versionId: string,
    dependsOnTaskId?: string | null,
  ) {
    if (!dependsOnTaskId) {
      return;
    }

    const dependency = await this.prisma.onboardingTemplateTask.findFirst({
      where: {
        id: dependsOnTaskId,
        ...this.templateScope.taskWhere(),
        taskGroup: {
          departmentTemplate: {
            onboardingTemplateVersionId: versionId,
          },
        },
      },
      select: { id: true },
    });

    if (!dependency) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_DEPENDENCY_FOREIGN_VERSION,
        'Dependency must belong to the same template version.',
      );
    }
  }

  private async assertAssetReference(
    companyId: string,
    workType: string | null | undefined,
    referenceType: string | null | undefined,
    referenceId: string | null | undefined,
  ) {
    if (workType !== WorkType.ASSET) {
      return;
    }

    if (referenceType !== ReferenceType.ASSET_TYPE || !referenceId) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'Asset tasks must reference an Asset Type.',
      );
    }

    const assetType = await this.prisma.assetType.findFirst({
      where: {
        id: referenceId,
        companyId,
        isActive: true,
        archivedAt: null,
      },
      select: {
        id: true,
        trackingMode: true,
      },
    });

    if (!assetType) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'Asset Type is missing, inactive, or outside this company.',
      );
    }

    if (assetType.trackingMode === AssetTrackingMode.LOCATION) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_LOCATION_NOT_SUPPORTED,
        'LOCATION Asset Types cannot be used on onboarding tasks.',
      );
    }

    if (
      assetType.trackingMode !== AssetTrackingMode.INDIVIDUAL &&
      assetType.trackingMode !== AssetTrackingMode.POOL
    ) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
        'Asset Type must use INDIVIDUAL or POOL tracking.',
      );
    }
  }
}
