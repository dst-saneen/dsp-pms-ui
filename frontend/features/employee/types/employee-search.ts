export interface EmployeeSearchParams {
  search?: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  designationId?: string;
  employmentStatus?: string;
  isActive?: boolean | string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface EmployeePagedResult<T = unknown> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
