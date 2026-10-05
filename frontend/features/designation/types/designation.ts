export interface DesignationOnboardingDepartment {
  id: string;
  departmentId: string;
  rowVersion: number;
  department?: {
    id: string;
    departmentCode: string;
    departmentName: string;
    branchId?: string;
  };
}

export interface DesignationHomeDepartment {
  id: string;
  departmentCode: string;
  departmentName: string;
  branchId: string;
  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
  };
}

export interface Designation {
  id: string;

  companyId: string;

  departmentId?: string | null;

  designationCode: string;
  designationName: string;

  level?: number;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };

  department?: DesignationHomeDepartment | null;

  onboardingTemplateId?: string | null;

  onboardingTemplate?: {
    id: string;
    versions?: Array<{
      id: string;
      status?: string;
      departments: DesignationOnboardingDepartment[];
    }>;
  } | null;
}

export interface CreateDesignationDto {
  companyId: string;

  designationName: string;

  level?: number;

  isActive?: boolean;

  departmentId?: string | null;

  branchId?: string;

  onboardingDepartmentIds?: string[];

  operationId?: string;
}

export type UpdateDesignationDto = Partial<{
  designationName: string;
  level?: number;
  isActive?: boolean;
  departmentId?: string | null;
  branchId?: string;
  onboardingDepartmentIds?: string[];
  operationId?: string;
}>;

export interface DesignationQuery {
  companyId?: string;
  search?: string;
}

export function getDesignationOnboardingDepartments(
  designation: Designation | null | undefined,
): DesignationOnboardingDepartment[] {
  return designation?.onboardingTemplate?.versions?.[0]?.departments ?? [];
}

export function getDesignationOnboardingDepartmentIds(
  designation: Designation | null | undefined,
): string[] {
  return getDesignationOnboardingDepartments(designation).map(
    (entry) => entry.departmentId,
  );
}

export function getDesignationOnboardingBranchId(
  designation: Designation | null | undefined,
): string | undefined {
  const branchId = getDesignationOnboardingDepartments(designation).find(
    (entry) => entry.department?.branchId,
  )?.department?.branchId;
  return branchId || undefined;
}

export function formatDesignationHomeDepartment(
  designation: Designation | null | undefined,
): string {
  const department = designation?.department;
  if (!department) return "";
  const branchLabel = department.branch
    ? ` (${department.branch.branchCode})`
    : "";
  return `${department.departmentName}${branchLabel}`;
}
