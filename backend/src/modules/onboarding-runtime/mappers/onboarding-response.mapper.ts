import { Injectable } from '@nestjs/common';
import { Prisma, WorkType } from '@prisma/client';

import { isValidIanaTimeZone } from '../../leave-policy/leave-calendar.util';
import type {
  EmployeeOnboardingTaskStatus,
  EmployeeOnboardingView,
  ImportedEmployeeOnboardingTaskView,
  ImportedEmployeeOnboardingView,
  OnboardingActorContext,
  OnboardingTaskActionEventResponse,
  EmployeeOnboardingTaskRuntimeView,
  EmployeeOnboardingRuntimeView,
} from '../contracts/onboarding-runtime.contracts';
import {
  calculateDueState,
  formatPersonName,
  isSupportedOwnerType,
  toIsoDate,
} from '../helpers/onboarding-view.helpers';
import { OnboardingCapabilityService } from '../services/onboarding-capability.service';
import { OnboardingProgressService } from '../services/onboarding-progress.service';

type OnboardingWithRelations = Prisma.EmployeeOnboardingGetPayload<{
  include: typeof onboardingDetailInclude;
}>;

type TaskWithRelations = OnboardingWithRelations['tasks'][number];

export const ONBOARDING_BRANCH_TIMEZONE_NOT_CONFIGURED = 'NOT_CONFIGURED';

export function onboardingBranchTimezoneForView(
  timezone: string | null | undefined,
): string {
  const value = timezone?.trim() ?? '';
  return value && isValidIanaTimeZone(value)
    ? value
    : ONBOARDING_BRANCH_TIMEZONE_NOT_CONFIGURED;
}

export const onboardingDetailInclude = {
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
    orderBy: { sequenceNo: 'asc' as const },
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
        select: { id: true, taskName: true, status: true, statusV2: true },
      },
    },
  },
} satisfies Prisma.EmployeeOnboardingInclude;

@Injectable()
export class OnboardingResponseMapper {
  constructor(
    private readonly capabilityService: OnboardingCapabilityService,
    private readonly progressService: OnboardingProgressService,
  ) {}

  mapOnboarding(
    record: OnboardingWithRelations,
    actor: OnboardingActorContext,
  ): EmployeeOnboardingView {
    if (record.contractVersion === 'LEGACY_V1') {
      return this.mapImportedOnboarding(record);
    }

    return this.mapRuntimeOnboarding(record, actor);
  }

  mapTask(
    task: TaskWithRelations,
    onboarding: OnboardingWithRelations,
    actor: OnboardingActorContext,
  ): EmployeeOnboardingTaskRuntimeView {
    const status = this.taskStatus(task);
    const dueState = calculateDueState(task.dueDate, status);
    const capabilities = this.capabilityService.calculateTaskActions(
      actor,
      this.toCapabilityTask(task),
      this.toCapabilityOnboarding(onboarding),
    );

    const branch = onboarding.employee.branch;
    const company = branch.company;

    return {
      id: task.id,
      onboardingId: onboarding.id,
      contractVersion: 'V2',
      version: task.version,
      attemptNo: task.attemptNo,
      taskName: task.taskName,
      description: task.description,
      sequenceNo: task.sequenceNo,
      priority: task.priority,
      isMandatory: task.isMandatory,
      allowSkip: task.allowSkip,
      allowReopen: task.allowReopen,
      status,
      dueState,
      dueDate: toIsoDate(task.dueDate),
      startedAt: toIsoDate(task.startedAt ?? task.startedDate),
      resolvedAt: toIsoDate(task.resolvedAt ?? task.completedDate),
      ownerType: isSupportedOwnerType(task.ownerType)
        ? task.ownerType
        : 'DEPARTMENT',
      employee: {
        id: onboarding.employee.id,
        employeeCode: onboarding.employee.employeeCode,
        displayName: formatPersonName(
          onboarding.employee.firstName,
          onboarding.employee.lastName,
          onboarding.employee.employeeCode,
        ),
      },
      organization: {
        company: {
          id: company.id,
          code: company.companyCode,
          name: company.companyName,
        },
        branch: {
          id: branch.id,
          code: branch.branchCode,
          name: branch.branchName,
          timeZone: onboardingBranchTimezoneForView(branch.timezone),
        },
      },
      workstreamDepartment: {
        id:
          task.workstreamDepartmentId ??
          task.executorDepartmentId ??
          task.assignedDepartmentId ??
          '',
        name:
          task.executorDepartment?.departmentName ??
          task.assignedDepartment?.departmentName ??
          'Department',
      },
      executorDepartment: task.executorDepartment
        ? {
            id: task.executorDepartment.id,
            name: task.executorDepartment.departmentName,
          }
        : null,
      assignee: task.assignedToUser
        ? {
            userId: task.assignedToUser.id,
            employeeId:
              task.assignedToUser.employee?.id ?? task.assignedToUser.id,
            displayName:
              task.assignedToUser.displayName ??
              task.assignedToUser.employee?.employeeCode ??
              'Assignee',
          }
        : null,
      assignment:
        task.assignedAt && task.assignedByUser
          ? {
              assignedAt: toIsoDate(task.assignedAt)!,
              assignedBy: {
                userId: task.assignedByUser.id,
                displayName: task.assignedByUser.displayName ?? 'User',
              },
            }
          : null,
      dependency: task.dependsOnTask
        ? {
            taskId: task.dependsOnTask.id,
            taskName: task.dependsOnTask.taskName,
            status: this.taskStatusFromRow(task.dependsOnTask),
            satisfied: this.isTerminal(
              this.taskStatusFromRow(task.dependsOnTask),
            ),
          }
        : null,
      requirement: {
        workType: task.workType === WorkType.ASSET ? 'ASSET' : 'CHECKLIST',
        referenceType:
          task.referenceType === 'ASSET_TYPE' ? 'ASSET_TYPE' : null,
        referenceId: task.referenceId,
        referenceCode: null,
        referenceName: null,
        assetKind: null,
        assetTrackingMode: null,
        assetEligibilityScope: null,
      },
      result: null,
      blockedReasons: capabilities.blockedReasons,
      allowedActions: capabilities.allowedActions,
      actionCapabilities: capabilities.actionCapabilities,
    };
  }

  mapHistoryItem(
    event: {
      id: string;
      action: string;
      authorityMode: string;
      fromStatus: string | null;
      toStatus: string;
      fromAssigneeUserId: string | null;
      toAssigneeUserId: string | null;
      actorUserId: string;
      reason: string | null;
      taskVersionAfter: number;
      createdAt: Date;
      assetAttemptNo: number | null;
      resultType: string | null;
      employeeAssetId: string | null;
      softwareLicenseAllocationId: string | null;
    },
    actorNames: Map<string, string>,
    canSeeReason: boolean,
  ): OnboardingTaskActionEventResponse {
    return {
      id: event.id,
      action: event.action as OnboardingTaskActionEventResponse['action'],
      authorityMode:
        event.authorityMode as OnboardingTaskActionEventResponse['authorityMode'],
      fromStatus: event.fromStatus as EmployeeOnboardingTaskStatus | null,
      toStatus: event.toStatus as EmployeeOnboardingTaskStatus,
      fromAssignee: event.fromAssigneeUserId
        ? {
            userId: event.fromAssigneeUserId,
            displayName: actorNames.get(event.fromAssigneeUserId) ?? 'User',
          }
        : null,
      toAssignee: event.toAssigneeUserId
        ? {
            userId: event.toAssigneeUserId,
            displayName: actorNames.get(event.toAssigneeUserId) ?? 'User',
          }
        : null,
      actor: {
        userId: event.actorUserId,
        displayName: actorNames.get(event.actorUserId) ?? 'User',
      },
      reason: canSeeReason ? event.reason : null,
      assetResult:
        event.resultType &&
        (event.employeeAssetId || event.softwareLicenseAllocationId)
          ? {
              attemptNo: event.assetAttemptNo ?? 1,
              resultType: event.resultType as
                'EMPLOYEE_ASSET' | 'SOFTWARE_LICENSE_ALLOCATION',
              resultId:
                event.employeeAssetId ??
                event.softwareLicenseAllocationId ??
                '',
            }
          : null,
      taskVersionAfter: event.taskVersionAfter,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private mapRuntimeOnboarding(
    record: OnboardingWithRelations,
    actor: OnboardingActorContext,
  ): EmployeeOnboardingRuntimeView {
    const taskInputs = record.tasks.map((task) => ({
      status: this.taskStatus(task),
      isMandatory: task.isMandatory,
      assignedToUserId: task.assignedToUserId,
      dueState: calculateDueState(task.dueDate, this.taskStatus(task)),
    }));

    const progress = this.progressService.calculateFromTasks(
      taskInputs,
      this.onboardingStatus(record),
    );

    const capabilities = this.capabilityService.calculateOnboardingActions(
      actor,
      this.toCapabilityOnboarding(record),
      record.tasks.map((task) => this.toCapabilityTask(task)),
    );

    const branch = record.employee.branch;
    const company = branch.company;

    return {
      id: record.id,
      contractVersion: 'V2',
      version: record.version,
      status: this.onboardingStatus(record),
      employee: {
        id: record.employee.id,
        employeeCode: record.employee.employeeCode,
        displayName: formatPersonName(
          record.employee.firstName,
          record.employee.lastName,
          record.employee.employeeCode,
        ),
      },
      organizationSnapshot: {
        company: {
          id: company.id,
          code: company.companyCode,
          name: company.companyName,
        },
        branch: {
          id: branch.id,
          code: branch.branchCode,
          name: branch.branchName,
          timeZone: onboardingBranchTimezoneForView(branch.timezone),
        },
        department: record.employee.department
          ? {
              id: record.employee.department.id,
              code: record.employee.department.departmentCode,
              name: record.employee.department.departmentName,
            }
          : { id: '', code: '', name: '' },
        designation: record.employee.designation
          ? {
              id: record.employee.designation.id,
              code: record.employee.designation.designationCode,
              name: record.employee.designation.designationName,
            }
          : { id: '', code: '', name: '' },
      },
      templateSnapshot: {
        templateId: record.templateId,
        templateCode: record.template.templateCode ?? record.templateId,
        templateName: record.template.templateName,
        templateVersionId: record.templateVersionId,
        versionNo: record.templateVersion.versionNo,
        resolutionSource:
          record.templateResolutionSource ?? 'DESIGNATION_DEFAULT',
      },
      startDate: toIsoDate(record.startDate)!,
      startedBy: record.startedByUserId
        ? { userId: record.startedByUserId, displayName: 'HR' }
        : { userId: actor.userId, displayName: 'System' },
      completedAt: toIsoDate(record.completedAt ?? record.completedDate),
      cancelledAt: toIsoDate(record.cancelledAt),
      progress,
      departmentProgress: [],
      tasks: record.tasks.map((task) => this.mapTask(task, record, actor)),
      blockedReasons: capabilities.blockedReasons,
      allowedActions: capabilities.allowedActions,
      actionCapabilities: capabilities.actionCapabilities,
    };
  }

  private mapImportedOnboarding(
    record: OnboardingWithRelations,
  ): ImportedEmployeeOnboardingView {
    return {
      id: record.id,
      contractVersion: 'LEGACY_V1',
      version: record.version ?? null,
      legacyStatus: record.status,
      employee: {
        id: record.employee.id,
        employeeCode: record.employee.employeeCode,
        displayName: formatPersonName(
          record.employee.firstName,
          record.employee.lastName,
        ),
      },
      organizationSnapshot: {
        company: null,
        branch: null,
        department: null,
        designation: null,
      },
      templateSnapshot: {
        templateId: record.templateId,
        templateCode: record.template.templateCode,
        templateName: record.template.templateName,
        templateVersionId: record.templateVersionId,
        versionNo: record.templateVersion.versionNo,
        resolutionSource: null,
      },
      startDate: toIsoDate(record.startDate),
      startedBy: null,
      completedAt: toIsoDate(record.completedAt ?? record.completedDate),
      cancelledAt: toIsoDate(record.cancelledAt),
      progress: {
        total: record.totalTasks,
        terminal: record.completedTasks,
        percent: record.progress,
      },
      tasks: record.tasks.map((task) => this.mapLegacyTask(task, record)),
      blockedReasons: [],
      allowedActions: [],
      actionCapabilities: [],
    };
  }

  private mapLegacyTask(
    task: TaskWithRelations,
    onboarding: OnboardingWithRelations,
  ): ImportedEmployeeOnboardingTaskView {
    return {
      id: task.id,
      onboardingId: onboarding.id,
      contractVersion: 'LEGACY_V1',
      version: task.version ?? null,
      taskName: task.taskName,
      description: task.description,
      legacyStatus: task.status,
      legacyOwnerType: task.ownerType,
      legacyWorkType: task.workType,
      employee: {
        id: onboarding.employee.id,
        employeeCode: onboarding.employee.employeeCode,
        displayName: formatPersonName(
          onboarding.employee.firstName,
          onboarding.employee.lastName,
          onboarding.employee.employeeCode,
        ),
      },
      workstreamDepartment: task.assignedDepartment
        ? {
            id: task.assignedDepartment.id,
            name: task.assignedDepartment.departmentName,
          }
        : task.executorDepartment
          ? {
              id: task.executorDepartment.id,
              name: task.executorDepartment.departmentName,
            }
          : null,
      executorDepartment: task.executorDepartment
        ? {
            id: task.executorDepartment.id,
            name: task.executorDepartment.departmentName,
          }
        : null,
      assignee: task.assignedToUser
        ? {
            userId: task.assignedToUser.id,
            employeeId: task.assignedToUser.employee?.id ?? null,
            displayName:
              task.assignedToUser.displayName ??
              task.assignedToUser.employee?.employeeCode ??
              'Assignee',
          }
        : null,
      dueDate: toIsoDate(task.dueDate),
      resolvedAt: toIsoDate(task.resolvedAt ?? task.completedDate),
      blockedReasons: [],
      allowedActions: [],
      actionCapabilities: [],
    };
  }

  private taskStatus(task: {
    status: string;
    statusV2?: string | null;
  }): EmployeeOnboardingTaskStatus {
    const currentRuntimeStatus = task.statusV2;
    if (currentRuntimeStatus) {
      return currentRuntimeStatus as EmployeeOnboardingTaskStatus;
    }

    switch (task.status) {
      case 'IN_PROGRESS':
        return 'IN_PROGRESS';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'SKIPPED':
        return 'SKIPPED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  private taskStatusFromRow(task: {
    status: string;
    statusV2?: string | null;
  }): string {
    return task.statusV2 ?? task.status;
  }

  private onboardingStatus(
    record: OnboardingWithRelations,
  ): EmployeeOnboardingRuntimeView['status'] {
    if (record.statusV2) {
      return record.statusV2;
    }

    if (record.status === 'COMPLETED') {
      return 'COMPLETED';
    }

    if (record.status === 'CANCELLED') {
      return 'CANCELLED';
    }

    return 'IN_PROGRESS';
  }

  private isTerminal(status: string): boolean {
    return ['COMPLETED', 'SKIPPED', 'WAIVED'].includes(status);
  }

  private toCapabilityOnboarding(record: OnboardingWithRelations) {
    return {
      id: record.id,
      contractVersion: record.contractVersion,
      status: this.onboardingStatus(record),
      companyId: record.companyId,
      branchId: record.branchId ?? record.employee.branchId,
    };
  }

  private toCapabilityTask(task: TaskWithRelations) {
    return {
      id: task.id,
      contractVersion: task.contractVersion,
      status: this.taskStatus(task),
      ownerType: task.ownerType,
      assignedToUserId: task.assignedToUserId,
      isMandatory: task.isMandatory,
      allowSkip: task.allowSkip,
      allowReopen: task.allowReopen,
      workType: task.workType === WorkType.ASSET ? 'ASSET' : 'CHECKLIST',
      executorDepartmentId:
        task.executorDepartmentId ?? task.assignedDepartmentId,
    };
  }
}
