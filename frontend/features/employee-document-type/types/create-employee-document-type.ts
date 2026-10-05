import type { EmployeeDocumentType } from "./employee-document-type";

export type CreateEmployeeDocumentType = Omit<
  EmployeeDocumentType,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "company"
  | "category"
>;