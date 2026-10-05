import type {
  InterviewEvaluationStatus,
  InterviewMode,
  InterviewSessionStatus,
} from "../../types/enums";

export interface InterviewPanelMember {
  employeeId: string;
  employeeName: string;
  userId?: string;
  isLeadInterviewer: boolean;
}

export interface InterviewEvaluationScore {
  criterionId: string;
  criterionName: string;
  weightPercentage: number;
  score: number;
  weightedContribution: number;
}

export interface InterviewEvaluation {
  id: string;
  interviewSessionId: string;
  panelMemberEmployeeId: string;
  panelMemberName: string;
  status: InterviewEvaluationStatus;
  recommendation?: string;
  strengths?: string;
  concerns?: string;
  confidentialNotes?: string;
  weightedTotal?: number;
  scores: InterviewEvaluationScore[];
  submittedAt?: string;
  version: number;
}

export interface InterviewSession {
  id: string;
  jobApplicationId: string;
  jobOpeningId: string;
  applicationNumber: string;
  candidateName: string;
  candidateEmail: string;
  openingCode: string;
  openingTitle: string;
  branchId: string;
  branchName?: string;
  roundNumber: number;
  roundName: string;
  isRequired: boolean;
  scheduledStartAt: string;
  scheduledEndAt: string;
  timezone: string;
  mode: InterviewMode;
  locationOrLink?: string;
  evaluationDeadline: string;
  status: InterviewSessionStatus;
  cancellationReason?: string;
  rescheduleReason?: string;
  panelMembers: InterviewPanelMember[];
  evaluations: InterviewEvaluation[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSearch {
  search?: string;
  status?: InterviewSessionStatus;
  jobOpeningId?: string;
  branchId?: string;
  panelMemberEmployeeId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
}

export interface ScheduleInterviewDto {
  jobApplicationId: string;
  applicationVersion?: number;
  roundNumber: number;
  roundName: string;
  isRequired: boolean;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  timezone: string;
  mode: InterviewMode;
  locationOrLink?: string;
  evaluationDeadline: string;
  panelMembers: Array<{
    employeeId: string;
    employeeName: string;
    userId?: string;
  }>;
  leadInterviewerEmployeeId: string;
}

export interface RescheduleInterviewDto {
  version: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  timezone: string;
  reason: string;
}

export interface CancelInterviewDto {
  version: number;
  reason: string;
}

export interface CompleteInterviewDto {
  version: number;
}

export interface SaveEvaluationDraftDto {
  version: number;
  recommendation?: string;
  strengths?: string;
  concerns?: string;
  confidentialNotes?: string;
  scores: Array<{
    criterionId: string;
    score: number;
  }>;
}

export interface SubmitEvaluationDto extends SaveEvaluationDraftDto {
  recommendation: string;
}
