import type { Employee } from "@/features/employee/types/employee";
import type { EmployeeOnboardingTask } from "./employee-onboarding-task";

export interface EmployeeOnboarding {
  id: string;

  companyId: string;

  employeeId: string;

  templateId: string;

  status: string;

  /** Present for current-runtime records; used by optimistic complete commands. */
  version?: number;

  startDate: string;

  completedDate?: string | null;

  remarks?: string | null;

  createdAt: string;

  updatedAt: string;

  employee: Employee;

  template: {
    id: string;
    templateName: string;
  };

  tasks: EmployeeOnboardingTask[];
}
