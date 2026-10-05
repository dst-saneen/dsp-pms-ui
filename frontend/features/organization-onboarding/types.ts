export type OrganizationOnboardingStep =
  | "ORGANIZATION"
  | "COMPANY"
  | "BRANCH"
  | "STRUCTURE"
  | "TEAM"
  | "REVIEW"
  | "COMPLETED";

export interface OwnerEmployeeSelectionInput {
  companyId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
}

export interface OrganizationOnboardingStatus {
  id: string;
  companyGroupId: string;
  ownerUserId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  currentStep: OrganizationOnboardingStep;
  completedAt?: string;
  isOwner: boolean;
  ownerEmployee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName?: string | null;
    creationSource?: string;
  } | null;
  ownerEmployeeLink?: {
    state: "LINKED" | "AWAITING_SETUP" | "NEEDS_REPAIR";
    supportCode?: string | null;
  };
  companyGroup: {
    id: string;
    groupCode: string;
    groupName: string;
    description?: string;
  };
  company?: {
    id: string;
    companyCode: string;
    companyName: string;
    legalCountryCode?: string | null;
    registrationNo?: string;
    taxNumber?: string;
  };
  counts: {
    branches: number;
    departments: number;
    designations: number;
    shifts: number;
  };
  requirements: {
    company: boolean;
    branch: boolean;
    department: boolean;
    designation: boolean;
  };
}
