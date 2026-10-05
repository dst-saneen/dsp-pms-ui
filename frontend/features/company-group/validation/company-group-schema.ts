import { z } from "zod";

export const companyGroupSchema = z.object({
  groupName: z
    .string()
    .min(1, "Group Name is required"),

  isActive: z.boolean(),
});

export type CompanyGroupFormValues = z.infer<
  typeof companyGroupSchema
>;
