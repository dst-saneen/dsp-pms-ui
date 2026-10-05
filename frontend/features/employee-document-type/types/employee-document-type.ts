export interface EmployeeDocumentType {
  id: string;

  companyId: string;
  categoryId: string;

  documentCode: string;
  documentName: string;

  description?: string;

  requiresExpiry: boolean;
  requiresDocumentNumber: boolean;
  requiresVerification: boolean;
  lifetimeAllowed: boolean;

  isMandatory: boolean;

  sortOrder: number;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  company?: {
    id: string;
    companyName: string;
  };

  category?: {
    id: string;
    categoryCode: string;
    categoryName: string;
  };
}