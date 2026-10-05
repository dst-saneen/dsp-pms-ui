import { WorkflowContribution } from './workflow-contribution.contract';

export interface WorkflowDepartment {
  readonly id: string;

  readonly departmentId: string;

  readonly departmentCode?: string;

  readonly departmentName: string;

  readonly displayOrder: number;

  readonly isRequired: boolean;

  readonly approvalWorkflowId?: string;

  readonly contributions: readonly WorkflowContribution[];
}
