export interface EmployeeDocumentSearch {
  page?: number;

  limit?: number;

  search?: string;

  employeeId?: string;

  documentTypeId?: string;

  verificationStatus?: string;

  sortBy?: string;

  sortOrder?: "asc" | "desc";
}