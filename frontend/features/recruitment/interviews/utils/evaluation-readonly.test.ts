import { describe, expect, it } from "vitest";

import {
  INTERVIEW_EVALUATION_STATUS,
  INTERVIEW_SESSION_STATUS,
} from "../../types/enums";
import type { InterviewEvaluation, InterviewSession } from "../types/interview";
import {
  canEditEvaluation,
  isEvaluationReadOnly,
  isInterviewActionable,
} from "./evaluation-readonly";

function stubSession(
  overrides?: Partial<InterviewSession>,
): InterviewSession {
  return {
    id: "session-1",
    jobApplicationId: "app-1",
    jobOpeningId: "opening-1",
    applicationNumber: "APP-1",
    candidateName: "Ada Lovelace",
    candidateEmail: "ada@example.com",
    openingCode: "ENG-1",
    openingTitle: "Engineer",
    branchId: "branch-1",
    roundNumber: 1,
    roundName: "Technical",
    isRequired: true,
    scheduledStartAt: new Date().toISOString(),
    scheduledEndAt: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    mode: "VIDEO",
    evaluationDeadline: new Date().toISOString(),
    status: INTERVIEW_SESSION_STATUS.SCHEDULED,
    panelMembers: [
      {
        employeeId: "emp-1",
        employeeName: "Panel One",
        isLeadInterviewer: true,
      },
    ],
    evaluations: [],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function stubEvaluation(
  overrides?: Partial<InterviewEvaluation>,
): InterviewEvaluation {
  return {
    id: "eval-1",
    interviewSessionId: "session-1",
    panelMemberEmployeeId: "emp-1",
    panelMemberName: "Panel One",
    status: INTERVIEW_EVALUATION_STATUS.DRAFT,
    scores: [],
    version: 1,
    ...overrides,
  };
}

describe("evaluation ownership guards", () => {
  it("treats submitted evaluations as read-only", () => {
    expect(isEvaluationReadOnly(INTERVIEW_EVALUATION_STATUS.SUBMITTED)).toBe(
      true,
    );
    expect(isEvaluationReadOnly(INTERVIEW_EVALUATION_STATUS.DRAFT)).toBe(false);
  });

  it("allows only the assigned panel member to edit a draft", () => {
    const session = stubSession({
      evaluations: [stubEvaluation()],
    });
    const evaluation = stubEvaluation();

    expect(
      canEditEvaluation({
        session,
        evaluation,
        employeeId: "emp-1",
      }),
    ).toBe(true);

    expect(
      canEditEvaluation({
        session,
        evaluation,
        employeeId: "emp-other",
      }),
    ).toBe(false);
  });

  it("blocks edit after submit", () => {
    const evaluation = stubEvaluation({
      status: INTERVIEW_EVALUATION_STATUS.SUBMITTED,
    });
    const session = stubSession({ evaluations: [evaluation] });

    expect(
      canEditEvaluation({
        session,
        evaluation,
        employeeId: "emp-1",
      }),
    ).toBe(false);
  });

  it("marks scheduled and rescheduled interviews as actionable", () => {
    expect(isInterviewActionable(INTERVIEW_SESSION_STATUS.SCHEDULED)).toBe(true);
    expect(isInterviewActionable(INTERVIEW_SESSION_STATUS.RESCHEDULED)).toBe(
      true,
    );
    expect(isInterviewActionable(INTERVIEW_SESSION_STATUS.COMPLETED)).toBe(
      false,
    );
  });
});
