import { Injectable } from '@nestjs/common';

import {
  RuntimeContribution,
  RuntimeDepartment,
  RuntimeExecutionProfile,
  RuntimeExecutionRule,
  RuntimeRequirement,
  RuntimeWorkflow,
} from './index';

import {
  ContributionInstance,
  DepartmentInstance,
  ExecutionProfileInstance,
  ExecutionRuleInstance,
  RequirementInstance,
  WorkflowInstance,
  WorkflowRuntimeStatus,
} from './instance';

@Injectable()
export class WorkflowInstanceFactory {
  create(workflow: RuntimeWorkflow): WorkflowInstance {
    return {
      workflowInstanceId: workflow.workflowId,

      workflow,

      status: WorkflowRuntimeStatus.NOT_STARTED,

      startedAt: undefined,

      completedAt: undefined,

      departments: workflow.departments.map((department) =>
        this.createDepartment(department),
      ),
    };
  }

  private createDepartment(department: RuntimeDepartment): DepartmentInstance {
    return {
      runtimeDepartmentId: department.runtimeDepartmentId,

      definition: department,

      status: WorkflowRuntimeStatus.NOT_STARTED,

      contributions: department.contributions.map((contribution) =>
        this.createContribution(contribution),
      ),
    };
  }

  private createContribution(
    contribution: RuntimeContribution,
  ): ContributionInstance {
    return {
      runtimeContributionId: contribution.runtimeContributionId,

      definition: contribution,

      status: WorkflowRuntimeStatus.NOT_STARTED,

      requirements: contribution.requirements.map((requirement) =>
        this.createRequirement(requirement),
      ),

      executionProfiles: contribution.executionProfiles.map((profile) =>
        this.createExecutionProfile(profile),
      ),
    };
  }

  private createRequirement(
    requirement: RuntimeRequirement,
  ): RequirementInstance {
    return {
      runtimeRequirementId: requirement.runtimeRequirementId,

      definition: requirement,

      status: WorkflowRuntimeStatus.NOT_STARTED,

      value: undefined,
    };
  }

  private createExecutionProfile(
    profile: RuntimeExecutionProfile,
  ): ExecutionProfileInstance {
    return {
      runtimeExecutionProfileId: profile.runtimeExecutionProfileId,

      definition: profile,

      status: WorkflowRuntimeStatus.NOT_STARTED,

      rules: profile.rules.map((rule) => this.createExecutionRule(rule)),
    };
  }

  private createExecutionRule(
    rule: RuntimeExecutionRule,
  ): ExecutionRuleInstance {
    return {
      runtimeExecutionRuleId: rule.runtimeExecutionRuleId,

      definition: rule,

      status: WorkflowRuntimeStatus.NOT_STARTED,

      startedAt: undefined,

      completedAt: undefined,

      assignedTo: undefined,
    };
  }
}
