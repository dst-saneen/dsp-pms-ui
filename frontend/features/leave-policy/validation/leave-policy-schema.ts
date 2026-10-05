import { z } from "zod";

import { MAX_ANNUAL_ENTITLEMENT } from "../lib/leave-entitlement";

export const leavePolicySchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    branchId: z.string().optional(),
    departmentId: z.string().optional(),
    designationId: z.string().optional(),
    leaveTypeId: z.string().min(1, "Leave type is required"),
    annualEntitlement: z
      .string()
      .min(1, "Yearly entitlement is required")
      .refine((value) => {
        const annual = Number(value);
        return Number.isFinite(annual) && annual > 0;
      }, "Days per year must be greater than zero")
      .refine((value) => {
        const annual = Number(value);
        return Number.isFinite(annual) && annual <= MAX_ANNUAL_ENTITLEMENT;
      }, `Yearly entitlement cannot exceed ${MAX_ANNUAL_ENTITLEMENT} days`),
    carryForwardLimit: z.string().optional(),
    maxConsecutiveDays: z.string().optional(),
    allowNegativeBalance: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.branchId && (values.departmentId || values.designationId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchId"],
        message:
          "Choose a branch before setting department or designation, or clear those fields for a company default",
      });
    }
  });

export type LeavePolicyFormValues = z.infer<typeof leavePolicySchema>;
