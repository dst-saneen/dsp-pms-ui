import {
  INTERVIEW_EVALUATION_STATUS,
  INTERVIEW_SESSION_STATUS,
} from "../../types/enums";
import type { InterviewEvaluation, InterviewSession } from "../types/interview";

export function isEvaluationReadOnly(status: string) {
  return status === INTERVIEW_EVALUATION_STATUS.SUBMITTED;
}

export function isInterviewActionable(status: string) {
  return (
    status === INTERVIEW_SESSION_STATUS.SCHEDULED ||
    status === INTERVIEW_SESSION_STATUS.RESCHEDULED
  );
}

export function findPanelMember(
  session: InterviewSession,
  employeeId?: string | null,
) {
  if (!employeeId) return undefined;
  return session.panelMembers.find((member) => member.employeeId === employeeId);
}

export function findMyEvaluation(
  session: InterviewSession,
  employeeId?: string | null,
): InterviewEvaluation | undefined {
  if (!employeeId) return undefined;
  return session.evaluations.find(
    (evaluation) => evaluation.panelMemberEmployeeId === employeeId,
  );
}

/**
 * Only the assigned panel member can edit their own draft evaluation.
 * Submitted evaluations are always read-only.
 */
export function canEditEvaluation(input: {
  session: InterviewSession;
  evaluation: InterviewEvaluation;
  employeeId?: string | null;
}) {
  const { session, evaluation, employeeId } = input;
  if (!employeeId) return false;
  if (isEvaluationReadOnly(evaluation.status)) return false;
  if (evaluation.panelMemberEmployeeId !== employeeId) return false;
  return Boolean(findPanelMember(session, employeeId));
}

export function getLeadInterviewerName(session: InterviewSession) {
  return (
    session.panelMembers.find((member) => member.isLeadInterviewer)
      ?.employeeName ?? "—"
  );
}
