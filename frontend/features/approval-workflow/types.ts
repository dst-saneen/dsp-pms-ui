export interface ApprovalWorkflowStep {
  id: string;
  workflowId: string;
  stepNo: number;
  approverType: string;
  approverRole?: string | null;
}

export interface ApprovalWorkflow {
  id: string;
  companyId: string;
  workflowCode: string;
  workflowName: string;
  isActive: boolean;
  steps: ApprovalWorkflowStep[];
}

export interface CreateApprovalWorkflowInput {
  companyId: string;
  workflowCode: string;
  workflowName: string;
}

export interface CreateApprovalWorkflowStepInput {
  workflowId: string;
  stepNo: number;
  approverType: string;
  approverRole?: string;
}
