export interface DepartmentTaskRowModel {
  groupId: string;

  groupSequence: number;

  groupName: string;

  isFirstRow: boolean;

  rowSpan: number;

  hasTasks: boolean;

  taskId: string;

  taskSequence: number;

  taskName: string;

  ownerDepartmentId?: string;

  ownerDepartmentName?: string;

  assignedTo: string;

  dueOffset?: number;

  mandatory: boolean;

  approvalWorkflowId?: string;

  approvalWorkflowName?: string;

  task: unknown;
}