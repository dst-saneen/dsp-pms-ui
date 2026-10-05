import { z } from "zod";

export const employeeDocumentTypeSchema = z.object({
  companyId: z
    .string()
    .min(1, "Company is required"),

  categoryId: z
    .string()
    .min(1, "Category is required"),

  documentCode: z
    .string()
    .trim()
    .min(1, "Document Code is required"),

  documentName: z
    .string()
    .trim()
    .min(1, "Document Name is required"),

  description: z.string().optional(),

  requiresExpiry: z.boolean(),

  requiresDocumentNumber: z.boolean(),

  requiresVerification: z.boolean(),

  lifetimeAllowed: z.boolean(),

  isMandatory: z.boolean(),

  sortOrder: z.number(),

  isActive: z.boolean(),
});

export type EmployeeDocumentTypeFormValues =
  z.infer<typeof employeeDocumentTypeSchema>;