export interface OnboardingTemplateWorkspaceItem {

  designationId: string;

  designationCode: string;

  designationName: string;

  departments: {

    id: string;

    departmentId: string;

    departmentName: string;

    totalTasks: number;

  }[];

  totalTasks: number;

}