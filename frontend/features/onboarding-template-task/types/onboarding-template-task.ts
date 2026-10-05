export interface OnboardingTemplateTask {
  id: string;

  onboardingTemplateId: string;

  taskGroupId?: string | null;

  taskName: string;

  description?: string | null;

  sequenceNo: number;

  priority: number;

  isMandatory: boolean;

  allowSkip: boolean;

  allowResubmit: boolean;

  allowReopen: boolean;

  autoComplete: boolean;

  workType: string;

  ownerType?: string | null;

  referenceType?: string | null;

  referenceId?: string | null;

  approvalWorkflowId?: string | null;

  assignedDepartmentId?: string | null;

  assignedDesignationId?: string | null;

  assignedEmployeeId?: string | null;

  dependsOnTaskId?: string | null;

  dueDays?: number | null;

  reminderIntervalDays?: number | null;

  estimatedDurationMinutes?: number | null;

  rowVersion?: number;

  createdAt: string;

  updatedAt: string;
}
