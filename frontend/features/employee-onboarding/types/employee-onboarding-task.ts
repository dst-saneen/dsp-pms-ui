import type {
  EmployeeOnboardingTaskAllowedAction,
  RuntimeActionCapability,
} from "@/features/onboarding/types/onboarding.types";

export interface EmployeeOnboardingTask {
  id: string;

  onboardingId: string;

  taskName: string;

  description?: string;

  sequenceNo: number;

  priority: number;

  attemptNo: number;

  isMandatory: boolean;

  status: string;

  ownerType?: string;

  assignedToUserId?: string;

  assignedDepartmentId?: string;

  assignedDepartment?: {
    id: string;
    departmentCode?: string;
    departmentName: string;
  };

  allowSkip?: boolean;

  allowReopen?: boolean;

  startedDate?: string;

  dueDate?: string;

  completedDate?: string;

  completedByUserId?: string;

  approvalTransactionId?: string;

  workType: string;

  referenceType?: string;

  referenceId?: string;

  remarks?: string;

  lastReminderDate?: string;

  nextReminderDate?: string;

  contractVersion?: "LEGACY_V1" | "V2";

  allowedActions?: EmployeeOnboardingTaskAllowedAction[];

  actionCapabilities?: Array<
    RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>
  >;

  requirement?: { workType?: string };

  assignee?: { displayName: string } | null;

  resolvedAt?: string | null;

  createdAt: string;

  updatedAt: string;
}
