import { z } from "zod";

import {
  ASSET_KIND_LABELS,
  ASSET_KINDS,
  ASSET_TRACKING_LABELS,
  ASSET_TRACKING_MODES,
  trackingModesForKind,
} from "@/features/asset/lib/kind-tracking";

export const assetTypeSchema = z
  .object({
    companyId: z.string().uuid(),
    assetCategoryId: z.string().uuid({
      message: "Asset Category is required",
    }),
    assetTypeName: z.string().min(1, "Asset Type Name is required"),
    description: z.string().optional(),
    kind: z.enum(ASSET_KINDS),
    trackingMode: z.enum(ASSET_TRACKING_MODES),
  })
  .superRefine((values, ctx) => {
    const allowed = trackingModesForKind(values.kind);
    if (!allowed.includes(values.trackingMode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingMode"],
        message: `${ASSET_KIND_LABELS[values.kind]} must use ${allowed
          .map((mode) => ASSET_TRACKING_LABELS[mode])
          .join(" or ")} tracking`,
      });
    }
  });

export type AssetTypeFormValues = z.infer<typeof assetTypeSchema>;
