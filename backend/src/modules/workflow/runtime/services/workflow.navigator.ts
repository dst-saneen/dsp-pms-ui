import { Injectable } from '@nestjs/common';

import { WorkflowNavigator } from '../contracts';

import {
  ContributionInstance,
  DepartmentInstance,
  ExecutionProfileInstance,
  ExecutionRuleInstance,
  WorkflowInstance,
  WorkflowRuntimeStatus,
} from '../instance';

@Injectable()
export class DefaultWorkflowNavigator implements WorkflowNavigator {
  getExecutableDepartments(
    workflow: WorkflowInstance,
  ): readonly DepartmentInstance[] {
    return workflow.departments.filter((department) =>
      this.isExecutable(department.status),
    );
  }

  getExecutableContributions(
    department: DepartmentInstance,
  ): readonly ContributionInstance[] {
    return department.contributions.filter((contribution) =>
      this.isExecutable(contribution.status),
    );
  }

  getExecutableExecutionProfiles(
    contribution: ContributionInstance,
  ): readonly ExecutionProfileInstance[] {
    return contribution.executionProfiles.filter((profile) =>
      this.isExecutable(profile.status),
    );
  }

  getExecutableExecutionRules(
    profile: ExecutionProfileInstance,
  ): readonly ExecutionRuleInstance[] {
    return profile.rules.filter((rule) => this.isExecutable(rule.status));
  }

  private isExecutable(status: WorkflowRuntimeStatus): boolean {
    return (
      status === WorkflowRuntimeStatus.READY ||
      status === WorkflowRuntimeStatus.IN_PROGRESS ||
      status === WorkflowRuntimeStatus.WAITING
    );
  }
}
