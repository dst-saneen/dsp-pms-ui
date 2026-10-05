import {
  INTERVIEW_EVALUATION_STATUS,
  INTERVIEW_SESSION_STATUS,
  JOB_APPLICATION_STATUS,
  type JobApplicationStatus,
} from "../../types/enums";
import type { InterviewSession } from "../../interviews/types/interview";
import type {
  CandidateInterviewReadiness,
  CandidateReadinessStatus,
  PermittedEvaluationSummary,
} from "../types/hiring-decision";

const TERMINAL_STATUSES = new Set<JobApplicationStatus>([
  JOB_APPLICATION_STATUS.REJECTED,
  JOB_APPLICATION_STATUS.WITHDRAWN,
  JOB_APPLICATION_STATUS.SELECTED,
  JOB_APPLICATION_STATUS.OFFER_SENT,
  JOB_APPLICATION_STATUS.OFFER_ACCEPTED,
  JOB_APPLICATION_STATUS.HIRED,
  JOB_APPLICATION_STATUS.OFFER_DECLINED,
]);

function activeRequiredSessions(sessions: InterviewSession[]) {
  return sessions.filter(
    (session) =>
      session.isRequired &&
      session.status !== INTERVIEW_SESSION_STATUS.CANCELLED,
  );
}

export function buildPermittedEvaluationSummaries(
  sessions: InterviewSession[],
): PermittedEvaluationSummary[] {
  const summaries: PermittedEvaluationSummary[] = [];

  for (const session of sessions) {
    if (session.status === INTERVIEW_SESSION_STATUS.CANCELLED) continue;

    for (const evaluation of session.evaluations) {
      if (evaluation.status !== INTERVIEW_EVALUATION_STATUS.SUBMITTED) continue;

      summaries.push({
        roundName: session.roundName,
        roundNumber: session.roundNumber,
        panelMemberName: evaluation.panelMemberName,
        recommendation: evaluation.recommendation,
        weightedTotal: evaluation.weightedTotal,
        strengths: evaluation.strengths,
        concerns: evaluation.concerns,
      });
    }
  }

  return summaries.sort((a, b) => a.roundNumber - b.roundNumber);
}

export function calculateAggregateScore(
  summaries: PermittedEvaluationSummary[],
): number | undefined {
  const totals = summaries
    .map((item) => item.weightedTotal)
    .filter((value): value is number => typeof value === "number");

  if (totals.length === 0) return undefined;

  const sum = totals.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / totals.length) * 10) / 10;
}

export function assessInterviewReadiness(
  applicationStatus: JobApplicationStatus,
  sessions: InterviewSession[],
): CandidateInterviewReadiness {
  if (TERMINAL_STATUSES.has(applicationStatus)) {
    return {
      status: "ALREADY_DECIDED",
      message: "Decision already recorded for this application.",
      requiredRoundsTotal: 0,
      requiredRoundsCompleted: 0,
      submittedEvaluationsCount: 0,
      expectedEvaluationsCount: 0,
    };
  }

  const requiredSessions = activeRequiredSessions(sessions);
  const requiredRoundsTotal = requiredSessions.length;
  const requiredRoundsCompleted = requiredSessions.filter(
    (session) => session.status === INTERVIEW_SESSION_STATUS.COMPLETED,
  ).length;

  const expectedEvaluationsCount = requiredSessions.reduce(
    (count, session) => count + session.panelMembers.length,
    0,
  );

  const submittedEvaluationsCount = requiredSessions.reduce((count, session) => {
    return (
      count +
      session.evaluations.filter(
        (evaluation) => evaluation.status === INTERVIEW_EVALUATION_STATUS.SUBMITTED,
      ).length
    );
  }, 0);

  let status: CandidateReadinessStatus;
  let message: string;

  if (applicationStatus === JOB_APPLICATION_STATUS.MANAGER_REVIEW) {
    status = "READY_FOR_DECISION";
    message = "Ready for hiring manager decision.";
  } else if (requiredRoundsTotal === 0) {
    status = "INTERVIEWS_INCOMPLETE";
    message = "No required interview rounds are scheduled yet.";
  } else if (requiredRoundsCompleted < requiredRoundsTotal) {
    status = "INTERVIEWS_INCOMPLETE";
    message = `${requiredRoundsCompleted} of ${requiredRoundsTotal} required rounds completed.`;
  } else if (submittedEvaluationsCount < expectedEvaluationsCount) {
    status = "EVALUATIONS_PENDING";
    message = `${submittedEvaluationsCount} of ${expectedEvaluationsCount} required evaluations submitted.`;
  } else {
    status = "NOT_ADVANCED";
    message = "Interviews complete — awaiting HR to advance to manager review.";
  }

  return {
    status,
    message,
    requiredRoundsTotal,
    requiredRoundsCompleted,
    submittedEvaluationsCount,
    expectedEvaluationsCount,
  };
}

export function canAdvanceToManagerReview(
  applicationStatus: JobApplicationStatus,
  sessions: InterviewSession[],
): boolean {
  if (applicationStatus !== JOB_APPLICATION_STATUS.INTERVIEW) return false;

  const readiness = assessInterviewReadiness(applicationStatus, sessions);
  return (
    readiness.requiredRoundsTotal > 0 &&
    readiness.requiredRoundsCompleted === readiness.requiredRoundsTotal &&
    readiness.submittedEvaluationsCount === readiness.expectedEvaluationsCount
  );
}

export function assertReadyForManagerReview(
  applicationStatus: JobApplicationStatus,
  sessions: InterviewSession[],
) {
  if (!canAdvanceToManagerReview(applicationStatus, sessions)) {
    throw new Error("INTERVIEWS_NOT_READY");
  }
}

export interface HiringDecisionGateInput {
  isHiringManager: boolean;
  applicationStatus: JobApplicationStatus;
  readiness: CandidateInterviewReadiness;
  headcountRemaining: number;
}

export interface HiringDecisionGateResult {
  canSelect: boolean;
  canReject: boolean;
  blockReason?: string;
}

/**
 * Soft slots still free for Select (remaining headcount minus already-SELECTED
 * candidates who have not yet reserved via offer send).
 */
export function availableSelectHeadcount(
  headcountRemaining: number,
  selectedPendingOfferCount: number,
): number {
  return Math.max(0, headcountRemaining - selectedPendingOfferCount);
}

/**
 * Manager select/reject gate — select also requires remaining headcount.
 */
export function resolveHiringDecisionGate(
  input: HiringDecisionGateInput,
): HiringDecisionGateResult {
  if (!input.isHiringManager) {
    return {
      canSelect: false,
      canReject: false,
      blockReason: "Only the assigned hiring manager can decide.",
    };
  }

  if (input.applicationStatus !== JOB_APPLICATION_STATUS.MANAGER_REVIEW) {
    return {
      canSelect: false,
      canReject: false,
      blockReason:
        input.readiness.message ||
        "Candidate must be in manager review before a decision.",
    };
  }

  if (input.readiness.status !== "READY_FOR_DECISION") {
    return {
      canSelect: false,
      canReject: false,
      blockReason: input.readiness.message,
    };
  }

  if (input.headcountRemaining <= 0) {
    return {
      canSelect: false,
      canReject: true,
      blockReason:
        "No headcount remaining on this opening. Reject is still available; select is blocked to avoid oversubscription.",
    };
  }

  return {
    canSelect: true,
    canReject: true,
  };
}
