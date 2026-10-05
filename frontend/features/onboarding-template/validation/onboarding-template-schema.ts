import { z } from "zod";

export const onboardingTemplateSchema = z.object({
  companyId: z
    .string()
    .trim()
    .min(1, "Company is required"),

  departmentId: z
    .string()
    .trim()
    .min(1, "Department is required"),

  templateCode: z
    .string()
    .trim()
    .min(1, "Template code is required"),

  templateName: z
    .string()
    .trim()
    .min(1, "Template name is required"),

  description: z
    .string()
    .optional(),

  isActive: z.boolean(),
});

export type OnboardingTemplateFormValues =
  z.infer<typeof onboardingTemplateSchema>;