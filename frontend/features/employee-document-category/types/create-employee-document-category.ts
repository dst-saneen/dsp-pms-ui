import type { EmployeeDocumentCategory } from "./employee-document-category";

export type CreateEmployeeDocumentCategory = Omit<
  EmployeeDocumentCategory,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "company"
>;