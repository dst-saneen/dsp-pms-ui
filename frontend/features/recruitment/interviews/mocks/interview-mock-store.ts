import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import {
  INTERVIEW_EVALUATION_STATUS,
  INTERVIEW_SESSION_STATUS,
  JOB_APPLICATION_STATUS,
} from "../../types/enums";
import {
  buildEvaluationScores,
  calculateWeightedTotal,
} from "../utils/evaluation-score";
import type {
  CancelInterviewDto,
  CompleteInterviewDto,
  InterviewEvaluation,
  InterviewSearch,
  InterviewSession,
  RescheduleInterviewDto,
  SaveEvaluationDraftDto,
  ScheduleInterviewDto,
  SubmitEvaluationDto,
} from "../types/interview";

const STORAGE_KEY = "recruitment-interviews-mock-v1";

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function loadSessions(): InterviewSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InterviewSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: InterviewSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function buildDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function matchesSearch(session: InterviewSession, filters?: InterviewSearch) {
  if (filters?.status && session.status !== filters.status) return false;
  if (filters?.jobOpeningId && session.jobOpeningId !== filters.jobOpeningId) {
    return false;
  }
  if (filters?.branchId && session.branchId !== filters.branchId) return false;
  if (
    filters?.panelMemberEmployeeId &&
    !session.panelMembers.some(
      (member) => member.employeeId === filters.panelMemberEmployeeId,
    )
  ) {
    return false;
  }

  if (filters?.scheduledFrom) {
    const from = new Date(filters.scheduledFrom);
    if (new Date(session.scheduledStartAt) < from) return false;
  }

  if (filters?.scheduledTo) {
    const to = new Date(filters.scheduledTo);
    to.setHours(23, 59, 59, 999);
    if (new Date(session.scheduledStartAt) > to) return false;
  }

  const keyword = filters?.search?.trim().toLowerCase();
  if (!keyword) return true;

  return (
    session.applicationNumber.toLowerCase().includes(keyword) ||
    session.candidateName.toLowerCase().includes(keyword) ||
    session.openingTitle.toLowerCase().includes(keyword) ||
    session.roundName.toLowerCase().includes(keyword)
  );
}

function createDraftEvaluations(
  session: InterviewSession,
  criteria: Array<{ id: string; name: string; weightPercentage: number }>,
): InterviewEvaluation[] {
  return session.panelMembers.map((member) => ({
    id: createId(),
    interviewSessionId: session.id,
    panelMemberEmployeeId: member.employeeId,
    panelMemberName: member.employeeName,
    status: INTERVIEW_EVALUATION_STATUS.DRAFT,
    scores: criteria.map((criterion) => ({
      criterionId: criterion.id,
      criterionName: criterion.name,
      weightPercentage: criterion.weightPercentage,
      score: 0,
      weightedContribution: 0,
    })),
    version: 1,
  }));
}

function assertSessionVersion(session: InterviewSession, version: number) {
  if (session.version !== version) throw new Error("STALE_STATE");
}

export const InterviewMockStore = {
  list(filters?: InterviewSearch): InterviewSession[] {
    return loadSessions()
      .filter((session) => matchesSearch(session, filters))
      .sort(
        (a, b) =>
          new Date(a.scheduledStartAt).getTime() -
          new Date(b.scheduledStartAt).getTime(),
      );
  },

  getById(id: string): InterviewSession | null {
    return loadSessions().find((session) => session.id === id) ?? null;
  },

  listByApplication(applicationId: string): InterviewSession[] {
    return this.list().filter(
      (session) => session.jobApplicationId === applicationId,
    );
  },

  schedule(dto: ScheduleInterviewDto): InterviewSession {
    const application = RecruitmentPipelineMockStore.getApplication(
      dto.jobApplicationId,
    );
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    if (application.status !== JOB_APPLICATION_STATUS.INTERVIEW) {
      throw new Error("APPLICATION_NOT_IN_INTERVIEW");
    }

    const opening = JobOpeningMockStore.getById(application.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");

    const start = buildDateTime(dto.scheduledDate, dto.scheduledTime);
    if (Number.isNaN(start.getTime())) throw new Error("INVALID_SCHEDULE");

    const end = new Date(start.getTime() + dto.durationMinutes * 60_000);
    const timestamp = nowIso();
    const criteria = opening.criteria.filter((item) => item.isActive);

    const session: InterviewSession = {
      id: createId(),
      jobApplicationId: application.id,
      jobOpeningId: opening.id,
      applicationNumber: application.applicationNumber,
      candidateName: `${application.candidateFirstName} ${application.candidateLastName}`.trim(),
      candidateEmail: application.candidateEmail,
      openingCode: application.openingCode,
      openingTitle: application.openingTitle,
      branchId: application.branchId,
      branchName: application.branchName,
      roundNumber: dto.roundNumber,
      roundName: dto.roundName.trim(),
      isRequired: dto.isRequired,
      scheduledStartAt: start.toISOString(),
      scheduledEndAt: end.toISOString(),
      timezone: dto.timezone,
      mode: dto.mode,
      locationOrLink: dto.locationOrLink?.trim() || undefined,
      evaluationDeadline: dto.evaluationDeadline,
      status: INTERVIEW_SESSION_STATUS.SCHEDULED,
      panelMembers: dto.panelMembers.map((member) => ({
        employeeId: member.employeeId,
        employeeName: member.employeeName,
        userId: member.userId,
        isLeadInterviewer: member.employeeId === dto.leadInterviewerEmployeeId,
      })),
      evaluations: [],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    session.evaluations = createDraftEvaluations(session, criteria);

    const sessions = loadSessions();
    sessions.unshift(session);
    saveSessions(sessions);

    RecruitmentPipelineMockStore.appendTimelineEvent(application.id, {
      summary: `Interview scheduled: ${session.roundName}`,
      comment: `Round ${session.roundNumber} on ${start.toLocaleString()} (${session.timezone})`,
    });

    return session;
  },

  reschedule(id: string, dto: RescheduleInterviewDto): InterviewSession {
    const sessions = loadSessions();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = sessions[index];
    assertSessionVersion(current, dto.version);
    if (current.status !== INTERVIEW_SESSION_STATUS.SCHEDULED) {
      throw new Error("INVALID_TRANSITION");
    }
    if (!dto.reason.trim()) throw new Error("REASON_REQUIRED");

    const start = buildDateTime(dto.scheduledDate, dto.scheduledTime);
    const end = new Date(start.getTime() + dto.durationMinutes * 60_000);

    const updated: InterviewSession = {
      ...current,
      scheduledStartAt: start.toISOString(),
      scheduledEndAt: end.toISOString(),
      timezone: dto.timezone,
      status: INTERVIEW_SESSION_STATUS.RESCHEDULED,
      rescheduleReason: dto.reason.trim(),
      version: current.version + 1,
      updatedAt: nowIso(),
    };

    sessions[index] = updated;
    saveSessions(sessions);

    RecruitmentPipelineMockStore.appendTimelineEvent(current.jobApplicationId, {
      summary: `Interview rescheduled: ${current.roundName}`,
      comment: dto.reason.trim(),
    });

    return updated;
  },

  cancel(id: string, dto: CancelInterviewDto): InterviewSession {
    const sessions = loadSessions();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = sessions[index];
    assertSessionVersion(current, dto.version);
    if (
      current.status !== INTERVIEW_SESSION_STATUS.SCHEDULED &&
      current.status !== INTERVIEW_SESSION_STATUS.RESCHEDULED
    ) {
      throw new Error("INVALID_TRANSITION");
    }
    if (!dto.reason.trim()) throw new Error("REASON_REQUIRED");

    const updated: InterviewSession = {
      ...current,
      status: INTERVIEW_SESSION_STATUS.CANCELLED,
      cancellationReason: dto.reason.trim(),
      version: current.version + 1,
      updatedAt: nowIso(),
    };

    sessions[index] = updated;
    saveSessions(sessions);

    RecruitmentPipelineMockStore.appendTimelineEvent(current.jobApplicationId, {
      summary: `Interview cancelled: ${current.roundName}`,
      comment: dto.reason.trim(),
    });

    return updated;
  },

  complete(id: string, dto: CompleteInterviewDto): InterviewSession {
    const sessions = loadSessions();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = sessions[index];
    assertSessionVersion(current, dto.version);
    if (
      current.status !== INTERVIEW_SESSION_STATUS.SCHEDULED &&
      current.status !== INTERVIEW_SESSION_STATUS.RESCHEDULED
    ) {
      throw new Error("INVALID_TRANSITION");
    }

    const updated: InterviewSession = {
      ...current,
      status: INTERVIEW_SESSION_STATUS.COMPLETED,
      version: current.version + 1,
      updatedAt: nowIso(),
    };

    sessions[index] = updated;
    saveSessions(sessions);

    RecruitmentPipelineMockStore.appendTimelineEvent(current.jobApplicationId, {
      summary: `Interview completed: ${current.roundName}`,
    });

    return updated;
  },

  saveEvaluationDraft(
    sessionId: string,
    panelMemberEmployeeId: string,
    dto: SaveEvaluationDraftDto,
  ): InterviewEvaluation {
    const sessions = loadSessions();
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index < 0) throw new Error("NOT_FOUND");

    const session = sessions[index];
    const evaluationIndex = session.evaluations.findIndex(
      (item) => item.panelMemberEmployeeId === panelMemberEmployeeId,
    );
    if (evaluationIndex < 0) throw new Error("NOT_ASSIGNED");

    const evaluation = session.evaluations[evaluationIndex];
    assertSessionVersion(session, dto.version);
    if (evaluation.status === INTERVIEW_EVALUATION_STATUS.SUBMITTED) {
      throw new Error("EVALUATION_IMMUTABLE");
    }

    const opening = JobOpeningMockStore.getById(session.jobOpeningId);
    const criteria = (opening?.criteria ?? []).filter((item) => item.isActive);
    const scoreMap = Object.fromEntries(
      dto.scores.map((item) => [item.criterionId, item.score]),
    );
    const scores = buildEvaluationScores(criteria, scoreMap);
    const weightedTotal = calculateWeightedTotal(
      scores.map((item) => ({
        weightPercentage: item.weightPercentage,
        score: item.score,
      })),
    );

    const updatedEvaluation: InterviewEvaluation = {
      ...evaluation,
      status: INTERVIEW_EVALUATION_STATUS.DRAFT,
      recommendation: dto.recommendation,
      strengths: dto.strengths?.trim() || undefined,
      concerns: dto.concerns?.trim() || undefined,
      confidentialNotes: dto.confidentialNotes?.trim() || undefined,
      scores,
      weightedTotal,
      version: evaluation.version + 1,
    };

    session.evaluations[evaluationIndex] = updatedEvaluation;
    session.version = dto.version + 1;
    session.updatedAt = nowIso();
    sessions[index] = session;
    saveSessions(sessions);
    return updatedEvaluation;
  },

  submitEvaluation(
    sessionId: string,
    panelMemberEmployeeId: string,
    dto: SubmitEvaluationDto,
  ): InterviewEvaluation {
    const sessions = loadSessions();
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index < 0) throw new Error("NOT_FOUND");

    const session = sessions[index];
    const evaluationIndex = session.evaluations.findIndex(
      (item) => item.panelMemberEmployeeId === panelMemberEmployeeId,
    );
    if (evaluationIndex < 0) throw new Error("NOT_ASSIGNED");

    const evaluation = session.evaluations[evaluationIndex];
    assertSessionVersion(session, dto.version);
    if (evaluation.status === INTERVIEW_EVALUATION_STATUS.SUBMITTED) {
      throw new Error("EVALUATION_IMMUTABLE");
    }
    if (!dto.recommendation.trim()) throw new Error("RECOMMENDATION_REQUIRED");

    const opening = JobOpeningMockStore.getById(session.jobOpeningId);
    const criteria = (opening?.criteria ?? []).filter((item) => item.isActive);
    const scoreMap = Object.fromEntries(
      dto.scores.map((item) => [item.criterionId, item.score]),
    );
    const scores = buildEvaluationScores(criteria, scoreMap);
    const weightedTotal = calculateWeightedTotal(
      scores.map((item) => ({
        weightPercentage: item.weightPercentage,
        score: item.score,
      })),
    );

    if (scores.some((item) => item.score < 1 || item.score > 5)) {
      throw new Error("INVALID_SCORES");
    }

    const updatedEvaluation: InterviewEvaluation = {
      ...evaluation,
      status: INTERVIEW_EVALUATION_STATUS.SUBMITTED,
      recommendation: dto.recommendation,
      strengths: dto.strengths?.trim() || undefined,
      concerns: dto.concerns?.trim() || undefined,
      confidentialNotes: dto.confidentialNotes?.trim() || undefined,
      scores,
      weightedTotal,
      submittedAt: nowIso(),
      version: evaluation.version + 1,
    };

    session.evaluations[evaluationIndex] = updatedEvaluation;
    session.version = dto.version + 1;
    session.updatedAt = nowIso();
    sessions[index] = session;
    saveSessions(sessions);

    RecruitmentPipelineMockStore.appendTimelineEvent(session.jobApplicationId, {
      summary: `Evaluation submitted for ${session.roundName}`,
      comment: `${evaluation.panelMemberName} · ${dto.recommendation.replaceAll("_", " ")}`,
      actorName: evaluation.panelMemberName,
    });

    return updatedEvaluation;
  },
};
