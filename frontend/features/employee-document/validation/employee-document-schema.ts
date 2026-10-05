import { z } from "zod";

export const employeeDocumentSchema = z
  .object({
    employeeId: z
      .string()
      .min(1, "Employee is required"),

    documentTypeId: z
      .string()
      .min(1, "Document Type is required"),

    title: z
      .string()
      .trim()
      .min(1, "Title is required"),

    documentNumber: z.string().optional(),

    issueDate: z.string().optional(),

    expiryDate: z.string().optional(),

    lifetimeDocument: z.boolean(),

    verificationStatus: z
    .string()
    .min(1, "Verification Status is required"),

    verifiedBy: z.string().optional(),

    verifiedDate: z.string().optional(),

    originalFileName: z.string().optional(),

    uploadSessionId: z.string().optional(),

    mimeType: z.string().optional(),

    fileSize: z.number().optional(),

    remarks: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Expiry required unless lifetime document
    if (
      !data.lifetimeDocument &&
      !data.expiryDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message:
          "Expiry Date is required for non-lifetime documents",
      });
    }

    // Verified date required if verified
    if (
      data.verificationStatus === "VERIFIED" &&
      !data.verifiedDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifiedDate"],
        message:
          "Verified Date is required",
      });
    }

    // Expiry cannot be before issue date
    if (
      data.issueDate &&
      data.expiryDate &&
      new Date(data.expiryDate) <
        new Date(data.issueDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message:
          "Expiry Date cannot be before Issue Date",
      });
    }
  });

export type EmployeeDocumentFormValues =
  z.infer<typeof employeeDocumentSchema>;