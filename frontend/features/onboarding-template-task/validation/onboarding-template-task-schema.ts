import { z } from "zod";

export const onboardingTemplateTaskSchema = z.object({
  taskGroupId: z.string().trim().min(1, "Task group is required"),
  taskName: z.string().trim().min(1, "Task name is required"),
  description: z.string().optional(),
  sequenceNo: z.number().min(1, "Sequence must be greater than zero"),
  priority: z.number().optional(),
  isMandatory: z.boolean(),
  allowSkip: z.boolean(),
  allowReopen: z.boolean(),
  workType: z.enum(["CHECKLIST", "ASSET"]),
  ownerType: z.enum(["DEPARTMENT", "EMPLOYEE", "MANAGER"]),
  referenceType: z.enum(["ASSET_TYPE"]).optional(),
  referenceId: z.string().optional(),
  dependsOnTaskId: z.string().optional(),
  dueDays: z.number().optional(),
});

export type OnboardingTemplateTaskFormValues = z.infer<
  typeof onboardingTemplateTaskSchema
>;
