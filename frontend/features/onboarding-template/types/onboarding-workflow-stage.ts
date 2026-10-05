export interface OnboardingWorkflowStage {
  id: string;

  workflowId: string;

  sequenceNo: number;

  displayOrder: number;

  stageName: string;

  description?: string;

  /**
   * Department owner
   */
  ownerType: string;

  /**
   * Approval required
   */
  approvalRequired: boolean;

  /**
   * Due days
   */
  dueDays: number;

  /**
   * Allow parallel execution
   */
  allowParallel: boolean;

  /**
   * Active
   */
  isActive: boolean;

  /**
   * Estimated duration
   */
  estimatedDuration?: number;

  /**
   * Display colour
   */
  color?: string;

  /**
   * Icon
   */
  icon?: string;

  createdAt?: string;

  updatedAt?: string;
}