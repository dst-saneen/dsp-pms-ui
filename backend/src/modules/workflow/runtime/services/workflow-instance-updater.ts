import { Injectable } from '@nestjs/common';

import {
  ContributionInstance,
  DepartmentInstance,
  ExecutionProfileInstance,
  ExecutionRuleInstance,
  WorkflowInstance,
  WorkflowRuntimeStatus,
} from '../instance';

@Injectable()
export class WorkflowInstanceUpdater {
  withWorkflowStatus(
    workflow: WorkflowInstance,
    status: WorkflowRuntimeStatus,
  ): WorkflowInstance {
    return {
      ...workflow,
      status,
      startedAt:
        status === WorkflowRuntimeStatus.IN_PROGRESS
          ? (workflow.startedAt ?? new Date())
          : workflow.startedAt,
      completedAt: this.isTerminal(status)
        ? (workflow.completedAt ?? new Date())
        : workflow.completedAt,
    };
  }

  withDepartmentStatus(
    department: DepartmentInstance,
    status: WorkflowRuntimeStatus,
  ): DepartmentInstance {
    return {
      ...department,
      status,
    };
  }

  withContributionStatus(
    contribution: ContributionInstance,
    status: WorkflowRuntimeStatus,
  ): ContributionInstance {
    return {
      ...contribution,
      status,
    };
  }

  withExecutionProfileStatus(
    profile: ExecutionProfileInstance,
    status: WorkflowRuntimeStatus,
  ): ExecutionProfileInstance {
    return {
      ...profile,
      status,
    };
  }

  withExecutionRuleStatus(
    rule: ExecutionRuleInstance,
    status: WorkflowRuntimeStatus,
  ): ExecutionRuleInstance {
    return {
      ...rule,
      status,
    };
  }
  replaceDepartment(
    workflow: WorkflowInstance,
    department: DepartmentInstance,
  ): WorkflowInstance {
    return {
      ...workflow,
      departments: workflow.departments.map((existing) =>
        existing.runtimeDepartmentId === department.runtimeDepartmentId
          ? department
          : existing,
      ),
    };
  }

  replaceContribution(
    department: DepartmentInstance,
    contribution: ContributionInstance,
  ): DepartmentInstance {
    return {
      ...department,
      contributions: department.contributions.map((existing) =>
        existing.runtimeContributionId === contribution.runtimeContributionId
          ? contribution
          : existing,
      ),
    };
  }

  replaceExecutionProfile(
    contribution: ContributionInstance,
    profile: ExecutionProfileInstance,
  ): ContributionInstance {
    return {
      ...contribution,
      executionProfiles: contribution.executionProfiles.map((existing) =>
        existing.runtimeExecutionProfileId === profile.runtimeExecutionProfileId
          ? profile
          : existing,
      ),
    };
  }

  replaceExecutionRule(
    profile: ExecutionProfileInstance,
    rule: ExecutionRuleInstance,
  ): ExecutionProfileInstance {
    return {
      ...profile,
      rules: profile.rules.map((existing) =>
        existing.runtimeExecutionRuleId === rule.runtimeExecutionRuleId
          ? rule
          : existing,
      ),
    };
  }

  private isTerminal(status: WorkflowRuntimeStatus): boolean {
    return (
      status === WorkflowRuntimeStatus.COMPLETED ||
      status === WorkflowRuntimeStatus.FAILED ||
      status === WorkflowRuntimeStatus.CANCELLED ||
      status === WorkflowRuntimeStatus.SKIPPED
    );
  }
}
