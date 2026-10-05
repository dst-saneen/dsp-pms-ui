export interface EmployeeDocument {
  id: string;

  employeeId: string;
  documentTypeId: string;

  title: string;
  documentNumber?: string;

  issueDate?: string;
  expiryDate?: string;

  lifetimeDocument: boolean;

  verificationStatus: string;

  verifiedBy?: string | null;
  verifiedByUserId?: string | null;
  verifiedDate?: string;

  originalFileName?: string;

  mimeType?: string;

  fileSize?: number;

  remarks?: string;

  fileStatus?: string | null;

  scanDetail?: string | null;

  allowedActions?: string[];

  uploadSessionId?: string;

  createdAt: string;
  updatedAt: string;

  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName?: string;
  };

  documentType?: {
    id: string;
    documentCode: string;
    documentName: string;

    category?: {
      id: string;
      categoryCode: string;
      categoryName: string;
    };
  };
}

export interface EmployeeDocumentHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  actorUserId?: string | null;
  actorName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}
