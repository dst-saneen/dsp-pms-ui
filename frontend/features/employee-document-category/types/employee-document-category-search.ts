export interface EmployeeDocumentCategorySearch {
  search?: string;

  companyId?: string;

  isActive?: boolean;

  page?: number;

  limit?: number;

  sortBy?: string;

  sortOrder?: "asc" | "desc";
}