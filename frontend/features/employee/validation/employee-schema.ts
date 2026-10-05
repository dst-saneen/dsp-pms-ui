import { z } from "zod";

export const employeeSchema = z.object({
  companyId: z
    .string()
    .min(1, "Company is required"),

  branchId: z
    .string()
    .min(1, "Branch is required"),

  departmentId: z
    .string()
    .min(1, "Department is required"),

  firstName: z
    .string()
    .trim()
    .min(1, "First Name is required"),

  lastName: z.string().optional(),

  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),

  mobile: z.string().optional(),

  designationId: z.string().optional(),

  managerId: z.string().optional(),

  employeeType: z.string().optional(),

  joiningDate: z.string().optional(),
});

export type EmployeeFormValues =
  z.infer<typeof employeeSchema>;