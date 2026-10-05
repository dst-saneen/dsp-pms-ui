import {
  ContributionInstance,
  DepartmentInstance,
  ExecutionProfileInstance,
  ExecutionRuleInstance,
  WorkflowInstance,
} from '../instance';

export interface WorkflowNavigator {
  getExecutableDepartments(
    workflow: WorkflowInstance,
  ): readonly DepartmentInstance[];

  getExecutableContributions(
    department: DepartmentInstance,
  ): readonly ContributionInstance[];

  getExecutableExecutionProfiles(
    contribution: ContributionInstance,
  ): readonly ExecutionProfileInstance[];

  getExecutableExecutionRules(
    profile: ExecutionProfileInstance,
  ): readonly ExecutionRuleInstance[];
}
