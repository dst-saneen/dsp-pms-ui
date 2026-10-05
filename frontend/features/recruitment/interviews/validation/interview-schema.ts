import { z } from "zod";

export const scheduleInterviewSchema = z.object({
  jobApplicationId: z.string().uuid("Select an application"),
  roundNumber: z.number().int().min(1),
  roundName: z.string().min(1, "Round name is required"),
  isRequired: z.boolean(),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTime: z.string().min(1, "Time is required"),
  durationMinutes: z.number().int().min(15).max(480),
  timezone: z.string().min(1, "Timezone is required"),
  mode: z.enum(["PHONE", "VIDEO", "IN_PERSON"]),
  locationOrLink: z.string().optional(),
  evaluationDeadline: z.string().min(1, "Evaluation deadline is required"),
  panelMemberEmployeeIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one panel member"),
  leadInterviewerEmployeeId: z.string().uuid("Select a lead interviewer"),
});

export type ScheduleInterviewFormValues = z.infer<typeof scheduleInterviewSchema>;

export const evaluationSchema = z.object({
  recommendation: z.string().optional(),
  strengths: z.string().optional(),
  concerns: z.string().optional(),
  confidentialNotes: z.string().optional(),
  scores: z.array(
    z.object({
      criterionId: z.string().uuid(),
      score: z.number().min(1).max(5),
    }),
  ),
});

export type EvaluationFormValues = z.infer<typeof evaluationSchema>;

export const submitEvaluationSchema = evaluationSchema.extend({
  recommendation: z.string().min(1, "Recommendation is required"),
});

export type SubmitEvaluationFormValues = z.infer<typeof submitEvaluationSchema>;
