import { z } from "zod";

export const leaveTypeCategories = ["STANDARD", "COMP_OFF", "UNPAID", "OPTIONAL_HOLIDAY"] as const;

export const leaveTypeSchema = z.object({
  companyId: z.string().uuid("Company is required"),
  leaveCode: z.string().optional(),
  leaveName: z.string().min(1, "Leave name is required"),
  description: z.string().optional(),
  category: z.enum(leaveTypeCategories),
  isPaid: z.boolean(),
  requiresApproval: z.boolean(),
  allowHalfDay: z.boolean(),
  carryForwardAllowed: z.boolean(),
});

export type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>;

export function leaveTypeCategoryLabel(category?: string | null) {
  switch (category) {
    case "COMP_OFF":
      return "Comp-off";
    case "UNPAID":
      return "Unpaid";
    case "OPTIONAL_HOLIDAY":
      return "Optional holiday";
    case "STANDARD":
    default:
      return "Standard";
  }
}
