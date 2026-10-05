import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import { InterviewMockStore } from "../../interviews/mocks/interview-mock-store";
import { JOB_APPLICATION_STATUS, type JobApplicationStatus } from "../../types/enums";
import type { ApplicationTransitionDto } from "../../applications/types/job-application";
import type {
  HiringComparisonCandidate,
  HiringComparisonView,
  HiringDecisionDto,
  HiringDecisionQueueItem,
} from "../types/hiring-decision";
import {
  assessInterviewReadiness,
  availableSelectHeadcount,
  buildPermittedEvaluationSummaries,
  calculateAggregateScore,
  resolveHiringDecisionGate,
} from "../utils/hiring-readiness";

const PIPELINE_STATUSES: JobApplicationStatus[] = [
  JOB_APPLICATION_STATUS.INTERVIEW,
  JOB_APPLICATION_STATUS.MANAGER_REVIEW,
];

function createOperationId() {
  return crypto.randomUUID();
}

function isInPipeline(status: JobApplicationStatus) {
  return PIPELINE_STATUSES.includes(status);
}

function assertHiringManager(openingId: string, hiringManagerEmployeeId: string) {
  const opening = JobOpeningMockStore.getById(openingId);
  if (!opening) throw new Error("OPENING_NOT_FOUND");
  if (opening.hiringManagerEmployeeId !== hiringManagerEmployeeId) {
    throw new Error("UNAUTHORIZED_ACTION");
  }
  return opening;
}

function countSelectedPendingOffer(openingId: string) {
  return RecruitmentPipelineMockStore.listApplications({
    jobOpeningId: openingId,
  }).filter((application) => application.status === JOB_APPLICATION_STATUS.SELECTED)
    .length;
}

function buildComparisonCandidate(
  application: NonNullable<ReturnType<typeof RecruitmentPipelineMockStore.getApplication>>,
  hiringManagerEmployeeId: string,
  selectSlotsRemaining: number,
): HiringComparisonCandidate {
  const sessions = InterviewMockStore.listByApplication(application.id);
  const readiness = assessInterviewReadiness(application.status, sessions);
  const evaluationSummaries = buildPermittedEvaluationSummaries(sessions);
  const aggregateScore = calculateAggregateScore(evaluationSummaries);
  const opening = JobOpeningMockStore.getById(application.jobOpeningId);
  const isManager = opening?.hiringManagerEmployeeId === hiringManagerEmployeeId;
  const gate = resolveHiringDecisionGate({
    isHiringManager: Boolean(isManager),
    applicationStatus: application.status,
    readiness,
    headcountRemaining: selectSlotsRemaining,
  });

  return {
    applicationId: application.id,
    applicationNumber: application.applicationNumber,
    candidateId: application.candidateId,
    candidateName: `${application.candidateFirstName} ${application.candidateLastName}`.trim(),
    candidateEmail: application.candidateEmail,
    applicationStatus: application.status,
    submittedAt: application.submittedAt,
    readiness,
    aggregateScore,
    evaluationSummaries,
    allowedActions: {
      canSelect: gate.canSelect,
      canReject: gate.canReject,
    },
    decisionBlockReason: gate.blockReason,
    version: application.version,
  };
}

export const HiringDecisionMockStore = {
  getQueue(hiringManagerEmployeeId: string): HiringDecisionQueueItem[] {
    const openings = JobOpeningMockStore.list({
      hiringManagerEmployeeId,
    });

    return openings
      .map((opening) => {
        const applications = RecruitmentPipelineMockStore.listApplications({
          jobOpeningId: opening.id,
        }).filter((application) => isInPipeline(application.status));

        const pendingDecisionCount = applications.filter(
          (application) => application.status === JOB_APPLICATION_STATUS.MANAGER_REVIEW
        ).length;

        if (pendingDecisionCount === 0 && applications.length === 0) {
          return null;
        }

        const item: HiringDecisionQueueItem = {
          jobOpeningId: opening.id,
          openingCode: opening.openingCode,
          openingTitle: opening.title,
          branchName: opening.branchName,
          headcountRemaining: opening.headcount.remaining,
          pendingDecisionCount,
          inPipelineCount: applications.length,
          decisionOwnerName: opening.hiringManagerName,
        };
        return item;
      })
      .filter((item): item is HiringDecisionQueueItem => item !== null)
      .sort((a, b) => b.pendingDecisionCount - a.pendingDecisionCount);
  },

  getComparison(openingId: string, hiringManagerEmployeeId: string): HiringComparisonView {
    const opening = assertHiringManager(openingId, hiringManagerEmployeeId);
    const selectSlotsRemaining = availableSelectHeadcount(
      opening.headcount.remaining,
      countSelectedPendingOffer(openingId),
    );

    const candidates = RecruitmentPipelineMockStore.listApplications({
      jobOpeningId: openingId,
    })
      .filter((application) => isInPipeline(application.status))
      .map((application) =>
        buildComparisonCandidate(
          application,
          hiringManagerEmployeeId,
          selectSlotsRemaining,
        ),
      )
      .sort((a, b) => {
        const scoreA = a.aggregateScore ?? -1;
        const scoreB = b.aggregateScore ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });

    return {
      jobOpeningId: opening.id,
      openingCode: opening.openingCode,
      openingTitle: opening.title,
      branchName: opening.branchName,
      headcountRemaining: opening.headcount.remaining,
      decisionOwnerName: opening.hiringManagerName,
      decisionOwnerEmployeeId: opening.hiringManagerEmployeeId,
      candidates,
    };
  },

  selectCandidate(applicationId: string, hiringManagerEmployeeId: string, dto: HiringDecisionDto) {
    const application = RecruitmentPipelineMockStore.getApplication(applicationId);
    if (!application) throw new Error("NOT_FOUND");
    const opening = assertHiringManager(application.jobOpeningId, hiringManagerEmployeeId);

    const sessions = InterviewMockStore.listByApplication(applicationId);
    const readiness = assessInterviewReadiness(application.status, sessions);
    const selectSlotsRemaining = availableSelectHeadcount(
      opening.headcount.remaining,
      countSelectedPendingOffer(application.jobOpeningId),
    );
    const gate = resolveHiringDecisionGate({
      isHiringManager: true,
      applicationStatus: application.status,
      readiness,
      headcountRemaining: selectSlotsRemaining,
    });
    if (!gate.canSelect) {
      throw new Error(
        selectSlotsRemaining <= 0 ? "HEADCOUNT_UNAVAILABLE" : "UNAUTHORIZED_ACTION",
      );
    }

    const payload: ApplicationTransitionDto = {
      expectedVersion: dto.version,
      operationId: createOperationId(),
      comment: dto.comment,
      reasonCode: dto.reasonCode,
    };

    return RecruitmentPipelineMockStore.selectByManager(
      applicationId,
      payload,
      hiringManagerEmployeeId
    );
  },

  rejectCandidate(applicationId: string, hiringManagerEmployeeId: string, dto: HiringDecisionDto) {
    const application = RecruitmentPipelineMockStore.getApplication(applicationId);
    if (!application) throw new Error("NOT_FOUND");
    assertHiringManager(application.jobOpeningId, hiringManagerEmployeeId);

    const payload: ApplicationTransitionDto = {
      expectedVersion: dto.version,
      operationId: createOperationId(),
      comment: dto.comment,
      reasonCode: dto.reasonCode,
    };

    return RecruitmentPipelineMockStore.rejectByManager(
      applicationId,
      payload,
      hiringManagerEmployeeId
    );
  },
};
