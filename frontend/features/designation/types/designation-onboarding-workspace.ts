export interface DesignationOnboardingWorkspace {
  id: string;

  designationCode: string;

  designationName: string;

  isActive: boolean;

  onboardingTemplate?: {
    id: string;

    versions: {
      id: string;

      departments: {
        id: string;

        rowVersion: number;

        departmentId: string;

        department?: {
          id: string;
          departmentCode: string;
          departmentName: string;
        };

        taskGroups: {
          id: string;
          groupName: string;

          tasks: {
            id: string;
          }[];
        }[];
      }[];
    }[];
  };
}
