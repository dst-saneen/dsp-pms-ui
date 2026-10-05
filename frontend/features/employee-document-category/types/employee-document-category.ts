export interface EmployeeDocumentCategory {
  id: string;

  companyId: string;

  categoryCode: string;
  categoryName: string;

  description?: string;

  sortOrder: number;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  company?: {
    id: string;
    companyName: string;
  };
}