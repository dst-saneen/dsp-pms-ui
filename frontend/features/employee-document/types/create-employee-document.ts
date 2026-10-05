import type { EmployeeDocument } from "./employee-document";

export type CreateEmployeeDocument = Omit<
  EmployeeDocument,
  "id" | "createdAt" | "updatedAt"
>;