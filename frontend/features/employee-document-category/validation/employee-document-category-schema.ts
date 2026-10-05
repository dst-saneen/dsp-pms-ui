import { z } from "zod";

export const employeeDocumentCategorySchema =
  z.object({
    companyId: z
      .string()
      .min(1, "Company is required"),

    categoryCode: z
      .string()
      .trim()
      .min(1, "Category Code is required"),

    categoryName: z
      .string()
      .trim()
      .min(1, "Category Name is required"),

    description: z.string().optional(),

    sortOrder: z.number(),

    isActive: z.boolean(),
  });

export type EmployeeDocumentCategoryFormValues =
  z.infer<
    typeof employeeDocumentCategorySchema
  >;