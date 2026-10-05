import { z } from "zod";

export const assetCategorySchema = z.object({
  companyId: z.string().uuid(),
  assetCategoryName: z.string().min(1, "Category Name is required"),
  description: z.string().optional(),
});

export type AssetCategoryFormValues = z.infer<typeof assetCategorySchema>;
