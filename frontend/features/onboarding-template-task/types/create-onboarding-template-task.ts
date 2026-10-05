export interface CreateOnboardingTemplateTask {
  taskGroupId: string;

  taskName: string;

  description?: string;

  sequenceNo: number;

  priority?: number;

  isMandatory: boolean;

  allowSkip: boolean;

  allowReopen: boolean;

  workType: "CHECKLIST" | "ASSET";

  ownerType: "DEPARTMENT" | "EMPLOYEE" | "MANAGER";

  referenceType?: "ASSET_TYPE";

  referenceId?: string;

  dependsOnTaskId?: string;

  dueDays?: number;
}
