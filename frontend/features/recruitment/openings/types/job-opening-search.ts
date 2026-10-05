import type { JobOpeningStatus } from "../../types/enums";

export interface JobOpeningSearch {
  search?: string;
  status?: JobOpeningStatus;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  designationId?: string;
  hiringManagerEmployeeId?: string;
}
