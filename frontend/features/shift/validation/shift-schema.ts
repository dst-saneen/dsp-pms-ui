import { z } from "zod";


export const shiftSchema = z.object({
  companyId: z
    .string()
    .min(1, "Company is required"),

  shiftName: z
    .string()
    .trim()
    .min(1, "Shift Name is required")
    .max(100),

  startTime: z
    .string()
    .min(1, "Start Time is required"),

  endTime: z
    .string()
    .min(1, "End Time is required"),

  breakMinutes: z
    .number()
    .min(0, "Break Minutes must be 0 or greater"),

    graceInMinutes: z
    .number()
    .min(0, "Grace In Minutes must be 0 or greater"),

    graceOutMinutes: z
    .number()
    .min(0, "Grace Out Minutes must be 0 or greater"),

  isNightShift: z.boolean(),

  isDefault: z.boolean(),

  isActive: z.boolean(),

  remarks: z
    .string()
    .max(500)
    .optional()
    .or(z.literal("")),
});

export type ShiftFormValues = z.infer<typeof shiftSchema>;
