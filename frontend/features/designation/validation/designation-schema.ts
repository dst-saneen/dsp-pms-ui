import { z } from "zod";

export const designationSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),

    designationName: z
      .string()
      .trim()
      .min(1, "Designation Name is required")
      .max(100, "Maximum 100 characters"),

    level: z.number().optional(),

    isActive: z.boolean(),

    /** Optional home Department (Belongs to Department). Empty string = none. */
    departmentId: z.string().optional(),

    /** Required when linking onboarding departments (W0-06). */
    branchId: z.string().optional(),

    /** Onboarding involvement departments (optional multi-select). */
    onboardingInvolvementDepartmentIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    const departmentIds = values.onboardingInvolvementDepartmentIds.filter(
      Boolean,
    );
    if (departmentIds.length === 0) {
      return;
    }
    if (!values.branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchId"],
        message: "Select a Branch before linking onboarding departments.",
      });
    }
  });

export type DesignationFormValues = z.infer<typeof designationSchema>;
