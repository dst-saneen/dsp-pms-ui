import { describe, expect, it } from "vitest";

import {
  INTERVIEW_EVALUATION_STATUS,
  INTERVIEW_SESSION_STATUS,
  JOB_APPLICATION_STATUS,
} from "../../types/enums";
import type { InterviewSession } from "../../interviews/types/interview";
import {
  assessInterviewReadiness,
  availableSelectHeadcount,
  resolveHiringDecisionGate,
} from "./hiring-readiness";

function stubSession(
  overrides?: Partial<InterviewSession>,
): InterviewSession {
  return {
    id: "int-1",
    jobApplicationId: "app-1",
    jobOpeningId: "open-1",
    applicationNumber: "APP-1",
    candidateName: "Ada Lovelace",
    candidateEmail: "ada@example.com",
    openingCode: "OPEN-1",
    openingTitle: "Engineer",
    branchId: "branch-1",
    roundNumber: 1,
    roundName: "Technical",
    isRequired: true,
    scheduledStartAt: new Date().toISOString(),
    scheduledEndAt: new Date().toISOString(),
    timezone: "UTC",
    mode: "VIDEO",
    evaluationDeadline: new Date().toISOString(),
    status: INTERVIEW_SESSION_STATUS.COMPLETED,
    panelMembers: [
      {
        employeeId: "emp-1",
        employeeName: "Panel A",
        isLeadInterviewer: true,
      },
    ],
    evaluations: [
      {
        id: "eval-1",
        interviewSessionId: "int-1",
        panelMemberEmployeeId: "emp-1",
        panelMemberName: "Panel A",
        status: INTERVIEW_EVALUATION_STATUS.SUBMITTED,
        recommendation: "HIRE",
        weightedTotal: 8,
        strengths: "Strong",
        concerns: "None",
        scores: [],
        version: 1,
      },
    ],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("availableSelectHeadcount", () => {
  it("subtracts already-selected candidates from remaining slots", () => {
    expect(availableSelectHeadcount(2, 1)).toBe(1);
    expect(availableSelectHeadcount(1, 1)).toBe(0);
    expect(availableSelectHeadcount(0, 0)).toBe(0);
  });
});

describe("resolveHiringDecisionGate", () => {
  const ready = assessInterviewReadiness(
    JOB_APPLICATION_STATUS.MANAGER_REVIEW,
    [stubSession()],
  );

  it("allows select and reject for the assigned manager when ready with headcount", () => {
    expect(
      resolveHiringDecisionGate({
        isHiringManager: true,
        applicationStatus: JOB_APPLICATION_STATUS.MANAGER_REVIEW,
        readiness: ready,
        headcountRemaining: 1,
      }),
    ).toEqual({
      canSelect: true,
      canReject: true,
    });
  });

  it("blocks select when headcount is exhausted but still allows reject", () => {
    expect(
      resolveHiringDecisionGate({
        isHiringManager: true,
        applicationStatus: JOB_APPLICATION_STATUS.MANAGER_REVIEW,
        readiness: ready,
        headcountRemaining: 0,
      }),
    ).toMatchObject({
      canSelect: false,
      canReject: true,
    });
  });

  it("blocks both actions for non-managers", () => {
    expect(
      resolveHiringDecisionGate({
        isHiringManager: false,
        applicationStatus: JOB_APPLICATION_STATUS.MANAGER_REVIEW,
        readiness: ready,
        headcountRemaining: 1,
      }),
    ).toMatchObject({
      canSelect: false,
      canReject: false,
    });
  });

  it("blocks decisions until the application is in manager review", () => {
    const interviewReady = assessInterviewReadiness(
      JOB_APPLICATION_STATUS.INTERVIEW,
      [stubSession()],
    );

    expect(
      resolveHiringDecisionGate({
        isHiringManager: true,
        applicationStatus: JOB_APPLICATION_STATUS.INTERVIEW,
        readiness: interviewReady,
        headcountRemaining: 1,
      }),
    ).toMatchObject({
      canSelect: false,
      canReject: false,
    });
  });
});
