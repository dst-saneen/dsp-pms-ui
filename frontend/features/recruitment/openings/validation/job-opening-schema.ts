import { z } from "zod";

export const jobOpeningCriterionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Criterion name is required"),
  description: z.string().optional(),
  weightPercentage: z
    .number()
    .min(1, "Minimum weight is 1")
    .max(100, "Maximum weight is 100"),
  displayOrder: z.number().int().min(0),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

export const jobOpeningSchema = z.object({
  companyGroupId: z.string().uuid("Company group is required"),
  companyId: z.string().uuid("Company is required"),
  branchId: z.string().uuid("Branch is required"),
  departmentId: z.string().uuid("Department is required"),
  designationId: z.string().uuid("Designation is required"),
  hiringManagerEmployeeId: z.string().uuid("Hiring manager is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  employmentType: z.string().min(1, "Employment type is required"),
  location: z.string().optional(),
  headcount: z
    .number()
    .int("Headcount must be a whole number")
    .min(1, "Headcount must be at least 1"),
  targetJoiningDate: z.string().optional(),
  applicationDeadline: z.string().min(1, "Application deadline is required"),
  criteria: z.array(jobOpeningCriterionSchema).min(1, "Add at least one criterion"),
});

export type JobOpeningFormValues = z.infer<typeof jobOpeningSchema>;
export type JobOpeningCriterionFormValues = z.infer<
  typeof jobOpeningCriterionSchema
>;

export function getCriteriaWeightTotal(
  criteria: Pick<JobOpeningCriterionFormValues, "weightPercentage" | "isActive">[],
) {
  return criteria
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + item.weightPercentage, 0);
}
