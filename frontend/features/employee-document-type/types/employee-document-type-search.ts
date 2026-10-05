export interface EmployeeDocumentTypeSearch {
  search?: string;

  companyId?: string;

  categoryId?: string;

  isActive?: boolean;

  page?: number;

  limit?: number;

  sortBy?: string;

  sortOrder?: "asc" | "desc";
}