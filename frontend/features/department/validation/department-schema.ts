import { z } from "zod";

export const departmentSchema = z.object({
  companyId: z
    .string()
    .min(1, "Company is required"),

  branchId: z
    .string()
    .min(1, "Branch is required"),

  departmentName: z
    .string()
    .trim()
    .min(1, "Department Name is required")
    .max(100, "Maximum 100 characters"),

  isActive: z.boolean(),
});

export type DepartmentFormValues =
  z.infer<typeof departmentSchema>;
