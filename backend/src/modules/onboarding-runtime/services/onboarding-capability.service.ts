import { Injectable } from '@nestjs/common';

import type {
  EmployeeOnboardingAllowedAction,
  EmployeeOnboardingTaskAllowedAction,
  OnboardingActorContext,
  OnboardingCapabilityResult,
  RuntimeActionCapability,
} from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';
import {
  ONBOARDING_PERMISSIONS,
  hasOnboardingPermission,
} from '../constants/onboarding-permissions';

import { OnboardingAssetFulfillmentService } from './onboarding-asset-fulfillment.service';
import { OnboardingProgressService } from './onboarding-progress.service';

interface CapabilityOnboardingRecord {
  id: string;
  contractVersion?: string | null;
  status: string;
  companyId: string;
  branchId?: string | null;
}

interface CapabilityTaskRecord {
  id: string;
  contractVersion?: string | null;
  status: string;
  ownerType?: string | null;
  assignedToUserId?: string | null;
  isMandatory?: boolean;
  allowSkip?: boolean;
  allowReopen?: boolean;
  workType?: string | null;
  executorDepartmentId?: string | null;
}

@Injectable()
export class OnboardingCapabilityService {
  constructor(
    private readonly progressService: OnboardingProgressService,
    private readonly assetFulfillment: OnboardingAssetFulfillmentService,
  ) {}

  calculateOnboardingActions(
    actor: OnboardingActorContext,
    onboarding: CapabilityOnboardingRecord,
    tasks: CapabilityTaskRecord[],
  ): OnboardingCapabilityResult<EmployeeOnboardingAllowedAction> {
    if (onboarding.contractVersion === 'LEGACY_V1') {
      return {
        allowedActions: [],
        actionCapabilities: [],
        blockedReasons: [
          {
            code: ONBOARDING_ERROR_CODES.ONBOARDING_LEGACY_RECONCILIATION_REQUIRED,
            message:
              'This onboarding record is read-only until reconciliation to the current onboarding format completes.',
          },
        ],
      };
    }

    if (onboarding.status !== 'IN_PROGRESS') {
      return {
        allowedActions: [],
        actionCapabilities: [],
        blockedReasons: [],
      };
    }

    const allowedActions: EmployeeOnboardingAllowedAction[] = [];
    const actionCapabilities: RuntimeActionCapability<EmployeeOnboardingAllowedAction>[] =
      [];

    const progress = this.progressService.calculateFromTasks(
      tasks.map((task) => ({
        status: task.status,
        isMandatory: task.isMandatory ?? false,
        assignedToUserId: task.assignedToUserId,
      })),
      onboarding.status,
    );

    if (hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.MANAGE)) {
      allowedActions.push('CANCEL');
      actionCapabilities.push({
        action: 'CANCEL',
        authorityMode: 'NORMAL',
        reasonRequired: true,
        reasonField: 'reason',
        remarksRequired: false,
        confirmationTone: 'WARNING',
        preflight: 'NONE',
      });

      if (progress.canComplete) {
        allowedActions.push('COMPLETE');
        actionCapabilities.push({
          action: 'COMPLETE',
          authorityMode: 'NORMAL',
          reasonRequired: false,
          reasonField: null,
          remarksRequired: false,
          confirmationTone: 'NORMAL',
          preflight: 'ONBOARDING_COMPLETE',
        });
      }
    }

    return {
      allowedActions,
      actionCapabilities,
      blockedReasons: [],
    };
  }

  calculateTaskActions(
    actor: OnboardingActorContext,
    task: CapabilityTaskRecord,
    onboarding: CapabilityOnboardingRecord,
  ): OnboardingCapabilityResult<EmployeeOnboardingTaskAllowedAction> {
    if (
      task.contractVersion === 'LEGACY_V1' ||
      onboarding.contractVersion === 'LEGACY_V1'
    ) {
      return {
        allowedActions: [],
        actionCapabilities: [],
        blockedReasons: [
          {
            code: ONBOARDING_ERROR_CODES.ONBOARDING_LEGACY_RECONCILIATION_REQUIRED,
            message:
              'This onboarding task is read-only until reconciliation to the current onboarding format completes.',
          },
        ],
      };
    }

    if (onboarding.status !== 'IN_PROGRESS') {
      return {
        allowedActions: [],
        actionCapabilities: [],
        blockedReasons: [],
      };
    }

    const allowedActions: EmployeeOnboardingTaskAllowedAction[] = [];
    const actionCapabilities: RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>[] =
      [];

    const isAssignee = task.assignedToUserId === actor.userId;
    const isDepartmentAssigner =
      task.ownerType === 'DEPARTMENT' &&
      actor.employeeContext?.departmentId === task.executorDepartmentId &&
      hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN);
    const canOverride = hasOnboardingPermission(
      actor,
      ONBOARDING_PERMISSIONS.OVERRIDE,
    );
    const canManage = hasOnboardingPermission(
      actor,
      ONBOARDING_PERMISSIONS.MANAGE,
    );
    const canAssignUnassigned =
      isDepartmentAssigner || canManage || canOverride;

    if (
      task.status === 'PENDING' &&
      !task.assignedToUserId &&
      task.ownerType === 'DEPARTMENT' &&
      canAssignUnassigned
    ) {
      const privilegedAssign = !isDepartmentAssigner;
      allowedActions.push('ASSIGN');
      actionCapabilities.push({
        action: 'ASSIGN',
        authorityMode: privilegedAssign ? 'HR_OVERRIDE' : 'NORMAL',
        reasonRequired: false,
        reasonField: null,
        remarksRequired: false,
        confirmationTone: privilegedAssign ? 'WARNING' : 'NORMAL',
        candidateScope: 'EXECUTOR_DEPARTMENT',
        preflight: 'NONE',
      });
    }

    if (
      task.assignedToUserId &&
      task.ownerType === 'DEPARTMENT' &&
      (isDepartmentAssigner || canOverride)
    ) {
      allowedActions.push('REASSIGN');
      actionCapabilities.push({
        action: 'REASSIGN',
        authorityMode:
          canOverride && !isDepartmentAssigner ? 'HR_OVERRIDE' : 'NORMAL',
        reasonRequired: true,
        reasonField:
          canOverride && !isDepartmentAssigner ? 'overrideReason' : 'reason',
        remarksRequired: false,
        confirmationTone:
          canOverride && !isDepartmentAssigner ? 'BREAK_GLASS' : 'WARNING',
        candidateScope: 'EXECUTOR_DEPARTMENT',
        preflight: 'NONE',
      });
    }

    if (
      task.status === 'PENDING' &&
      task.assignedToUserId &&
      task.ownerType === 'DEPARTMENT' &&
      isDepartmentAssigner
    ) {
      allowedActions.push('UNASSIGN');
      actionCapabilities.push({
        action: 'UNASSIGN',
        authorityMode: 'NORMAL',
        reasonRequired: true,
        reasonField: 'reason',
        remarksRequired: false,
        confirmationTone: 'WARNING',
        preflight: 'NONE',
      });
    }

    if (
      isAssignee &&
      actor.permissions.includes(ONBOARDING_PERMISSIONS.SELF_READ) &&
      (task.status === 'PENDING' || task.status === 'IN_PROGRESS')
    ) {
      if (task.status === 'PENDING') {
        allowedActions.push('START');
        actionCapabilities.push({
          action: 'START',
          authorityMode: 'NORMAL',
          reasonRequired: false,
          reasonField: null,
          remarksRequired: false,
          confirmationTone: 'NORMAL',
          preflight: 'NONE',
        });
      }

      if (task.workType !== 'ASSET') {
        allowedActions.push('COMPLETE');
        actionCapabilities.push({
          action: 'COMPLETE',
          authorityMode: 'NORMAL',
          reasonRequired: false,
          reasonField: null,
          remarksRequired: false,
          confirmationTone: 'NORMAL',
          preflight: 'NONE',
        });
      }

      if (task.allowSkip && !task.isMandatory) {
        allowedActions.push('SKIP');
        actionCapabilities.push({
          action: 'SKIP',
          authorityMode: 'NORMAL',
          reasonRequired: true,
          reasonField: 'reason',
          remarksRequired: false,
          confirmationTone: 'NORMAL',
          preflight: 'NONE',
        });
      }

      if (
        task.workType === 'ASSET' &&
        this.assetFulfillment.isAvailable(actor, {
          companyId: onboarding.companyId,
          branchId: onboarding.branchId,
          departmentId: task.executorDepartmentId,
        })
      ) {
        allowedActions.push('FULFILL_ASSET');
        actionCapabilities.push({
          action: 'FULFILL_ASSET',
          authorityMode: 'NORMAL',
          reasonRequired: false,
          reasonField: null,
          remarksRequired: false,
          confirmationTone: 'NORMAL',
          preflight: 'NONE',
        });
      }
    }

    if (
      (task.status === 'COMPLETED' || task.status === 'SKIPPED') &&
      task.allowReopen &&
      (isDepartmentAssigner || canOverride)
    ) {
      allowedActions.push('REOPEN');
      actionCapabilities.push({
        action: 'REOPEN',
        authorityMode:
          isDepartmentAssigner || !canOverride ? 'NORMAL' : 'HR_OVERRIDE',
        reasonRequired: true,
        reasonField:
          isDepartmentAssigner || !canOverride ? 'reason' : 'overrideReason',
        remarksRequired: false,
        confirmationTone:
          isDepartmentAssigner || !canOverride ? 'WARNING' : 'BREAK_GLASS',
        preflight: 'REOPEN',
      });
    }

    if (
      canOverride &&
      !isAssignee &&
      task.workType !== 'ASSET' &&
      (task.status === 'PENDING' || task.status === 'IN_PROGRESS')
    ) {
      allowedActions.push('COMPLETE');
      actionCapabilities.push({
        action: 'COMPLETE',
        authorityMode: 'HR_OVERRIDE',
        reasonRequired: true,
        reasonField: 'overrideReason',
        remarksRequired: false,
        confirmationTone: 'BREAK_GLASS',
        preflight: 'NONE',
      });
    }

    if (
      canOverride &&
      (task.status === 'PENDING' || task.status === 'IN_PROGRESS')
    ) {
      allowedActions.push('WAIVE');
      actionCapabilities.push({
        action: 'WAIVE',
        authorityMode: 'HR_OVERRIDE',
        reasonRequired: true,
        reasonField: 'overrideReason',
        remarksRequired: false,
        confirmationTone: 'BREAK_GLASS',
        preflight: 'NONE',
      });
    }

    return {
      allowedActions,
      actionCapabilities,
      blockedReasons: [],
    };
  }
}
