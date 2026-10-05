import { Injectable } from '@nestjs/common';

type DocumentMapSource = {
  id: string;
  title: string;
  documentNumber: string | null;
  verificationStatus: string;
  expiryDate: Date | null;
  lifetimeDocument: boolean;
  createdAt: Date;
  updatedAt: Date;
  fileStatus?: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
  } | null;
  documentType?: {
    id: string;
    documentCode: string;
    documentName: string;
  } | null;
};

@Injectable()
export class EmployeeDocumentMapper {
  toResponse(document: DocumentMapSource) {
    return {
      id: document.id,
      title: document.title,
      documentNumber: document.documentNumber,
      verificationStatus: document.verificationStatus,
      expiryDate: document.expiryDate,
      lifetimeDocument: document.lifetimeDocument,
      fileStatus: document.fileStatus ?? null,
      allowedActions: document.fileStatus === 'CLEAN' ? ['DOWNLOAD'] : [],
      employee: document.employee
        ? {
            id: document.employee.id,
            employeeCode: document.employee.employeeCode,
            firstName: document.employee.firstName,
            lastName: document.employee.lastName,
          }
        : null,
      documentType: document.documentType
        ? {
            id: document.documentType.id,
            documentCode: document.documentType.documentCode,
            documentName: document.documentType.documentName,
          }
        : null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
