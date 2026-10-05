export interface WorkflowStage {
  id: string;

  sequence: number;

  name: string;

  description?: string;

  status:
    | "pending"
    | "active"
    | "completed"
    | "cancelled";

  completedBy?: string;

  completedOn?: Date;

  required: boolean;
}