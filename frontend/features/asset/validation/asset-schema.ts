import { z } from "zod";

import {
  ASSET_KINDS,
  ASSET_TRACKING_MODES,
  type AssetKind,
} from "../lib/kind-tracking";

const optionalText = z.string();

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}, z.number().optional());

export const assetSchema = z
  .object({
    isEdit: z.boolean().optional(),
    companyId: z.string().uuid("Company is required"),
    departmentId: z.string().uuid("Department is required"),
    assetCategoryId: z.string().optional().or(z.literal("")),
    assetTypeId: z.string().uuid("Asset Type is required"),
    assetName: z.string().min(1, "Asset Name is required"),
    kind: z.enum(ASSET_KINDS).optional(),
    trackingMode: z.enum(ASSET_TRACKING_MODES).optional(),
    serialNumber: optionalText,
    manufacturer: optionalText,
    modelNumber: optionalText,
    purchaseDate: optionalText,
    purchaseCost: optionalNumber,
    currency: optionalText,
    warrantyExpiry: optionalText,
    location: optionalText,
    remarks: optionalText,
    cardNumber: optionalText,
    cardIssuer: optionalText,
    cardAccessZone: optionalText,
    cardIssuedDate: optionalText,
    cardExpiryDate: optionalText,
    vendorName: optionalText,
    productName: optionalText,
    contractReference: optionalText,
    vaultReference: optionalText,
    licenseStartsOn: optionalText,
    licenseExpiresOn: optionalText,
    licenseRenewsOn: optionalText,
    seatCapacity: optionalNumber,
  })
  .superRefine((values, ctx) => {
    const kind = values.kind as AssetKind | undefined;
    const tracking = values.trackingMode;

    if (kind === "HARDWARE" && !values.isEdit && !values.serialNumber?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["serialNumber"],
        message: "Serial number is required for hardware",
      });
    }

    if (kind === "GENERAL" && tracking === "LOCATION" && !values.location?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["location"],
        message: "Location is required for location-tracked assets",
      });
    }

    if (kind === "CARD" && !values.isEdit) {
      if (!values.cardNumber?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["cardNumber"],
          message: "Card number is required",
        });
      }
      if (!values.cardIssuedDate?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["cardIssuedDate"],
          message: "Issue date is required",
        });
      }
    }

    if (kind === "SOFTWARE_LICENSE" && !values.isEdit) {
      if (!values.vendorName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["vendorName"],
          message: "Vendor is required",
        });
      }
      if (!values.productName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["productName"],
          message: "Product is required",
        });
      }
      if (!values.seatCapacity || values.seatCapacity < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["seatCapacity"],
          message: "Seat capacity must be at least 1",
        });
      }
    }
  });

export type AssetFormValues = z.infer<typeof assetSchema>;
