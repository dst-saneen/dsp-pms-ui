import type { JobApplicationStatus } from "../../types/enums";

export type CandidateReadinessStatus =
  | "READY_FOR_DECISION"
  | "INTERVIEWS_INCOMPLETE"
  | "EVALUATIONS_PENDING"
  | "NOT_ADVANCED"
  | "ALREADY_DECIDED";

export interface CandidateInterviewReadiness {
  status: CandidateReadinessStatus;
  message: string;
  requiredRoundsTotal: number;
  requiredRoundsCompleted: number;
  submittedEvaluationsCount: number;
  expectedEvaluationsCount: number;
}

export interface PermittedEvaluationSummary {
  roundName: string;
  roundNumber: number;
  panelMemberName: string;
  recommendation?: string;
  weightedTotal?: number;
  strengths?: string;
  concerns?: string;
}

export interface HiringComparisonCandidate {
  applicationId: string;
  applicationNumber: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  applicationStatus: JobApplicationStatus;
  submittedAt: string;
  readiness: CandidateInterviewReadiness;
  aggregateScore?: number;
  evaluationSummaries: PermittedEvaluationSummary[];
  allowedActions: {
    canSelect: boolean;
    canReject: boolean;
  };
  /** Why Select/Reject is unavailable when gated. */
  decisionBlockReason?: string;
  version: number;
}

export interface HiringDecisionQueueItem {
  jobOpeningId: string;
  openingCode: string;
  openingTitle: string;
  branchName?: string;
  headcountRemaining: number;
  pendingDecisionCount: number;
  inPipelineCount: number;
  decisionOwnerName?: string;
}

export interface HiringComparisonView {
  jobOpeningId: string;
  openingCode: string;
  openingTitle: string;
  branchName?: string;
  headcountRemaining: number;
  decisionOwnerName?: string;
  decisionOwnerEmployeeId?: string;
  candidates: HiringComparisonCandidate[];
}

export interface HiringDecisionDto {
  version: number;
  comment: string;
  reasonCode?: string;
}
