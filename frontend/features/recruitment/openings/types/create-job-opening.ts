import type { JobOpeningCriterionInput } from "./job-opening-criterion";

export interface CreateJobOpeningDto {
  companyGroupId: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  hiringManagerEmployeeId: string;
  companyCode?: string;
  companyGroupName?: string;
  companyName?: string;
  branchName?: string;
  departmentName?: string;
  designationName?: string;
  hiringManagerName?: string;
  title: string;
  description?: string;
  employmentType: string;
  location?: string;
  headcount: number;
  targetJoiningDate?: string;
  applicationDeadline: string;
  criteria: JobOpeningCriterionInput[];
}
