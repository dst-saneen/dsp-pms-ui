import { InterviewMockStore } from "../../interviews/mocks/interview-mock-store";
import {
  assertReadyForManagerReview,
  canAdvanceToManagerReview,
} from "../../hiring-decisions/utils/hiring-readiness";
import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import {
  JOB_APPLICATION_SOURCE,
  JOB_APPLICATION_STATUS,
  JOB_OPENING_STATUS,
  RECRUITMENT_DOCUMENT_KIND,
  type JobApplicationStatus,
} from "../../types/enums";
import type { Candidate, CandidateSearch } from "../../candidates/types/candidate";
import type {
  ApplicationTransitionDto,
  CreateInternalApplicationDto,
  CreatePublicApplicationDto,
  JobApplication,
  JobApplicationSearch,
} from "../types/job-application";
import {
  buildApplicationAllowedActions,
  buildApplicationCurrentOwner,
  buildApplicationNextAction,
} from "../utils/application-actions";

const STORAGE_KEY = "recruitment-pipeline-mock-v1";

interface PipelineStore {
  candidates: Candidate[];
  applications: JobApplication[];
}

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function generateApplicationNumber() {
  return `APP-${Date.now().toString().slice(-6)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function loadStore(): PipelineStore {
  if (typeof window === "undefined") {
    return { candidates: [], applications: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { candidates: [], applications: [] };
    const parsed = JSON.parse(raw) as PipelineStore;
    return {
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      applications: Array.isArray(parsed.applications)
        ? parsed.applications.map(decorateApplication)
        : [],
    };
  } catch {
    return { candidates: [], applications: [] };
  }
}

function saveStore(store: PipelineStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function decorateApplication(application: JobApplication): JobApplication {
  const sessions = InterviewMockStore.listByApplication(application.id);
  const allowedActions = buildApplicationAllowedActions(application.status);
  allowedActions.canAdvanceToManagerReview = canAdvanceToManagerReview(
    application.status,
    sessions,
  );

  return {
    ...application,
    allowedActions,
    nextAction: buildApplicationNextAction(application.status),
    currentOwner: buildApplicationCurrentOwner(application.status),
  };
}

function appendTimeline(
  application: JobApplication,
  input: {
    fromStatus?: JobApplicationStatus;
    toStatus: JobApplicationStatus;
    summary: string;
    reasonCode?: string;
    comment?: string;
    actorName?: string;
  },
): JobApplication {
  const entry = {
    id: createId(),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    summary: input.summary,
    reasonCode: input.reasonCode,
    comment: input.comment,
    actorName: input.actorName ?? "HR User",
    occurredAt: nowIso(),
  };

  return decorateApplication({
    ...application,
    status: input.toStatus,
    version: application.version + 1,
    updatedAt: nowIso(),
    timeline: [entry, ...application.timeline],
  });
}

function syncCandidateCounts(store: PipelineStore) {
  store.candidates = store.candidates.map((candidate) => ({
    ...candidate,
    applicationCount: store.applications.filter(
      (application) => application.candidateId === candidate.id,
    ).length,
    updatedAt: nowIso(),
  }));
}

function matchesCandidate(candidate: Candidate, filters?: CandidateSearch) {
  const keyword = filters?.search?.trim().toLowerCase();
  if (!keyword) return true;

  return (
    candidate.firstName.toLowerCase().includes(keyword) ||
    candidate.lastName.toLowerCase().includes(keyword) ||
    candidate.email.toLowerCase().includes(keyword) ||
    candidate.mobile?.toLowerCase().includes(keyword)
  );
}

function matchesApplication(application: JobApplication, filters?: JobApplicationSearch) {
  if (filters?.status && application.status !== filters.status) return false;
  if (filters?.jobOpeningId && application.jobOpeningId !== filters.jobOpeningId) {
    return false;
  }
  if (filters?.branchId && application.branchId !== filters.branchId) return false;

  if (filters?.submittedFrom) {
    const from = new Date(filters.submittedFrom);
    const submitted = new Date(application.submittedAt);
    if (submitted < from) return false;
  }

  if (filters?.submittedTo) {
    const to = new Date(filters.submittedTo);
    to.setHours(23, 59, 59, 999);
    const submitted = new Date(application.submittedAt);
    if (submitted > to) return false;
  }

  const keyword = filters?.search?.trim().toLowerCase();
  if (!keyword) return true;

  return (
    application.applicationNumber.toLowerCase().includes(keyword) ||
    application.candidateFirstName.toLowerCase().includes(keyword) ||
    application.candidateLastName.toLowerCase().includes(keyword) ||
    application.candidateEmail.toLowerCase().includes(keyword) ||
    application.openingTitle.toLowerCase().includes(keyword) ||
    application.openingCode.toLowerCase().includes(keyword)
  );
}

function assertVersion(application: JobApplication, version: number) {
  if (application.version !== version) {
    throw new Error("STALE_STATE");
  }
}

export const RecruitmentPipelineMockStore = {
  listCandidates(filters?: CandidateSearch): Candidate[] {
    return loadStore()
      .candidates.filter((candidate) => matchesCandidate(candidate, filters))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  },

  getCandidate(id: string): Candidate | null {
    return loadStore().candidates.find((candidate) => candidate.id === id) ?? null;
  },

  listApplications(filters?: JobApplicationSearch): JobApplication[] {
    return loadStore()
      .applications.filter((application) => matchesApplication(application, filters))
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
  },

  listApplicationsPaged(filters?: JobApplicationSearch): {
    items: JobApplication[];
    total: number;
    page: number;
    limit: number;
  } {
    const all = this.listApplications(filters);
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const start = (page - 1) * limit;
    return {
      items: all.slice(start, start + limit),
      total: all.length,
      page,
      limit,
    };
  },

  getApplication(id: string): JobApplication | null {
    return (
      loadStore().applications.find((application) => application.id === id) ??
      null
    );
  },

  listCandidateApplications(candidateId: string): JobApplication[] {
    return this.listApplications().filter(
      (application) => application.candidateId === candidateId,
    );
  },

  createInternalApplication(
    dto: CreateInternalApplicationDto & { cvFileName?: string },
  ): JobApplication {
    const opening = JobOpeningMockStore.getById(dto.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");
    if (opening.status !== JOB_OPENING_STATUS.OPEN) {
      throw new Error("OPENING_NOT_OPEN");
    }

    const store = loadStore();
    const email = normalizeEmail(dto.email);
    const timestamp = nowIso();

    let candidate =
      store.candidates.find((item) => item.email === email) ?? null;

    if (!candidate) {
      candidate = {
        id: createId(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        mobile: dto.mobile?.trim() || undefined,
        primarySource: JOB_APPLICATION_SOURCE.INTERNAL_HR,
        applicationCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.candidates.unshift(candidate);
    } else {
      candidate = {
        ...candidate,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        mobile: dto.mobile?.trim() || candidate.mobile,
        updatedAt: timestamp,
      };
      store.candidates = store.candidates.map((item) =>
        item.id === candidate!.id ? candidate! : item,
      );
    }

    const duplicate = store.applications.find(
      (application) =>
        application.candidateId === candidate!.id &&
        application.jobOpeningId === dto.jobOpeningId &&
        application.status !== JOB_APPLICATION_STATUS.WITHDRAWN &&
        application.status !== JOB_APPLICATION_STATUS.REJECTED,
    );
    if (duplicate) throw new Error("DUPLICATE_APPLICATION");

    const cvFileName = dto.cvFileName ?? dto.cvFile?.name;
    const documents = cvFileName
      ? [
          {
            id: createId(),
            kind: RECRUITMENT_DOCUMENT_KIND.CV,
            fileName: cvFileName,
            fileSize: dto.cvFile?.size ?? 0,
            uploadedAt: timestamp,
          },
        ]
      : [];

    const application = decorateApplication({
      id: createId(),
      applicationNumber: generateApplicationNumber(),
      candidateId: candidate.id,
      candidateFirstName: candidate.firstName,
      candidateLastName: candidate.lastName,
      candidateEmail: candidate.email,
      candidateMobile: candidate.mobile,
      jobOpeningId: opening.id,
      openingCode: opening.openingCode,
      openingTitle: opening.title,
      branchId: opening.branchId,
      branchName: opening.branchName,
      companyId: opening.companyId,
      companyName: opening.companyName,
      status: JOB_APPLICATION_STATUS.APPLIED,
      source: JOB_APPLICATION_SOURCE.INTERNAL_HR,
      version: 1,
      coverNote: dto.coverNote?.trim() || undefined,
      submittedAt: timestamp,
      relevantDeadline: opening.applicationDeadline,
      allowedActions: buildApplicationAllowedActions(JOB_APPLICATION_STATUS.APPLIED),
      documents,
      timeline: [
        {
          id: createId(),
          toStatus: JOB_APPLICATION_STATUS.APPLIED,
          summary: "Application submitted through internal HR entry",
          actorName: "HR User",
          occurredAt: timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    store.applications.unshift(application);
    syncCandidateCounts(store);
    saveStore(store);
    return application;
  },

  createPublicApplication(dto: CreatePublicApplicationDto): JobApplication {
    const opening = JobOpeningMockStore.getById(dto.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");
    if (opening.status !== JOB_OPENING_STATUS.OPEN) {
      throw new Error("OPENING_NOT_OPEN");
    }

    const deadline = new Date(opening.applicationDeadline);
    deadline.setHours(23, 59, 59, 999);
    if (Date.now() > deadline.getTime()) {
      throw new Error("OPENING_NOT_OPEN");
    }

    const store = loadStore();
    const email = normalizeEmail(dto.email);
    const timestamp = nowIso();

    let candidate =
      store.candidates.find((item) => item.email === email) ?? null;

    if (!candidate) {
      candidate = {
        id: createId(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        mobile: dto.mobile?.trim() || undefined,
        primarySource: JOB_APPLICATION_SOURCE.PUBLIC_CAREERS,
        applicationCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.candidates.unshift(candidate);
    } else {
      candidate = {
        ...candidate,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        mobile: dto.mobile?.trim() || candidate.mobile,
        updatedAt: timestamp,
      };
      store.candidates = store.candidates.map((item) =>
        item.id === candidate!.id ? candidate! : item,
      );
    }

    const duplicate = store.applications.find(
      (application) =>
        application.candidateId === candidate!.id &&
        application.jobOpeningId === dto.jobOpeningId &&
        application.status !== JOB_APPLICATION_STATUS.WITHDRAWN &&
        application.status !== JOB_APPLICATION_STATUS.REJECTED,
    );
    if (duplicate) throw new Error("DUPLICATE_APPLICATION");

    const documents = [
      {
        id: createId(),
        kind: RECRUITMENT_DOCUMENT_KIND.CV,
        fileName: dto.cvFileName,
        fileSize: dto.cvFileSize,
        uploadedAt: timestamp,
      },
      ...(dto.supportingDocuments ?? []).map((document) => ({
        id: createId(),
        kind: RECRUITMENT_DOCUMENT_KIND.SUPPORTING_DOCUMENT,
        fileName: document.fileName,
        fileSize: document.fileSize,
        uploadedAt: timestamp,
      })),
    ];

    const application = decorateApplication({
      id: createId(),
      applicationNumber: generateApplicationNumber(),
      candidateId: candidate.id,
      candidateFirstName: candidate.firstName,
      candidateLastName: candidate.lastName,
      candidateEmail: candidate.email,
      candidateMobile: candidate.mobile,
      jobOpeningId: opening.id,
      openingCode: opening.openingCode,
      openingTitle: opening.title,
      branchId: opening.branchId,
      branchName: opening.branchName,
      companyId: opening.companyId,
      companyName: opening.companyName,
      status: JOB_APPLICATION_STATUS.APPLIED,
      source: JOB_APPLICATION_SOURCE.PUBLIC_CAREERS,
      version: 1,
      coverNote: dto.coverNote?.trim() || undefined,
      submittedAt: timestamp,
      relevantDeadline: opening.applicationDeadline,
      allowedActions: buildApplicationAllowedActions(JOB_APPLICATION_STATUS.APPLIED),
      documents,
      timeline: [
        {
          id: createId(),
          toStatus: JOB_APPLICATION_STATUS.APPLIED,
          summary: "Application submitted through public careers",
          actorName: "Candidate",
          occurredAt: timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    store.applications.unshift(application);
    syncCandidateCounts(store);
    saveStore(store);
    return application;
  },

  startScreening(id: string, dto: ApplicationTransitionDto): JobApplication {
    return this.transition(id, dto, {
      from: JOB_APPLICATION_STATUS.APPLIED,
      to: JOB_APPLICATION_STATUS.SCREENING,
      summary: "Screening started",
    });
  },

  advanceToInterview(id: string, dto: ApplicationTransitionDto): JobApplication {
    return this.transition(id, dto, {
      from: JOB_APPLICATION_STATUS.SCREENING,
      to: JOB_APPLICATION_STATUS.INTERVIEW,
      summary: "Application advanced to interview",
    });
  },

  advanceToManagerReview(id: string, dto: ApplicationTransitionDto): JobApplication {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = store.applications[index];
    assertVersion(current, dto.expectedVersion);
    if (current.status !== JOB_APPLICATION_STATUS.INTERVIEW) {
      throw new Error("INVALID_TRANSITION");
    }

    const sessions = InterviewMockStore.listByApplication(id);
    assertReadyForManagerReview(current.status, sessions);

    const updated = appendTimeline(current, {
      fromStatus: JOB_APPLICATION_STATUS.INTERVIEW,
      toStatus: JOB_APPLICATION_STATUS.MANAGER_REVIEW,
      summary: "Application advanced to hiring manager review",
      comment: dto.comment?.trim() || undefined,
    });

    store.applications[index] = updated;
    syncCandidateCounts(store);
    saveStore(store);
    return updated;
  },

  selectByManager(
    id: string,
    dto: ApplicationTransitionDto,
    hiringManagerEmployeeId: string,
  ): JobApplication {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = store.applications[index];
    assertVersion(current, dto.expectedVersion);
    if (current.status !== JOB_APPLICATION_STATUS.MANAGER_REVIEW) {
      throw new Error("INVALID_TRANSITION");
    }
    if (!dto.comment?.trim()) throw new Error("REASON_REQUIRED");

    const opening = JobOpeningMockStore.getById(current.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");
    if (opening.hiringManagerEmployeeId !== hiringManagerEmployeeId) {
      throw new Error("UNAUTHORIZED_ACTION");
    }

    const selectedPendingOffer = store.applications.filter(
      (item) =>
        item.jobOpeningId === current.jobOpeningId &&
        item.status === JOB_APPLICATION_STATUS.SELECTED,
    ).length;
    if (opening.headcount.remaining - selectedPendingOffer <= 0) {
      throw new Error("HEADCOUNT_UNAVAILABLE");
    }

    const updated = appendTimeline(current, {
      fromStatus: JOB_APPLICATION_STATUS.MANAGER_REVIEW,
      toStatus: JOB_APPLICATION_STATUS.SELECTED,
      summary: "Candidate selected by hiring manager",
      reasonCode: dto.reasonCode,
      comment: dto.comment.trim(),
      actorName: opening.hiringManagerName ?? "Hiring manager",
    });

    store.applications[index] = updated;
    syncCandidateCounts(store);
    saveStore(store);
    return updated;
  },

  rejectByManager(
    id: string,
    dto: ApplicationTransitionDto,
    hiringManagerEmployeeId: string,
  ): JobApplication {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = store.applications[index];
    assertVersion(current, dto.expectedVersion);
    if (current.status !== JOB_APPLICATION_STATUS.MANAGER_REVIEW) {
      throw new Error("INVALID_TRANSITION");
    }
    if (!dto.comment?.trim()) throw new Error("REASON_REQUIRED");

    const opening = JobOpeningMockStore.getById(current.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");
    if (opening.hiringManagerEmployeeId !== hiringManagerEmployeeId) {
      throw new Error("UNAUTHORIZED_ACTION");
    }

    const updated = appendTimeline(current, {
      fromStatus: JOB_APPLICATION_STATUS.MANAGER_REVIEW,
      toStatus: JOB_APPLICATION_STATUS.REJECTED,
      summary: "Candidate rejected by hiring manager",
      reasonCode: dto.reasonCode,
      comment: dto.comment.trim(),
      actorName: opening.hiringManagerName ?? "Hiring manager",
    });

    store.applications[index] = updated;
    syncCandidateCounts(store);
    saveStore(store);
    return updated;
  },

  reject(id: string, dto: ApplicationTransitionDto): JobApplication {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = store.applications[index];
    assertVersion(current, dto.expectedVersion);
    if (!current.allowedActions.canReject) throw new Error("INVALID_TRANSITION");
    if (!dto.comment?.trim()) throw new Error("REASON_REQUIRED");

    const updated = appendTimeline(current, {
      fromStatus: current.status,
      toStatus: JOB_APPLICATION_STATUS.REJECTED,
      summary: "Application rejected",
      reasonCode: dto.reasonCode,
      comment: dto.comment.trim(),
    });

    store.applications[index] = updated;
    syncCandidateCounts(store);
    saveStore(store);
    return updated;
  },

  withdraw(id: string, dto: ApplicationTransitionDto): JobApplication {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = store.applications[index];
    assertVersion(current, dto.expectedVersion);
    if (!current.allowedActions.canWithdraw) throw new Error("INVALID_TRANSITION");
    if (!dto.comment?.trim()) throw new Error("REASON_REQUIRED");

    const updated = appendTimeline(current, {
      fromStatus: current.status,
      toStatus: JOB_APPLICATION_STATUS.WITHDRAWN,
      summary: "Application withdrawn",
      reasonCode: dto.reasonCode,
      comment: dto.comment.trim(),
    });

    store.applications[index] = updated;
    syncCandidateCounts(store);
    saveStore(store);
    return updated;
  },

  convertToHired(id: string, dto: ApplicationTransitionDto): JobApplication {
    return this.transition(id, dto, {
      from: JOB_APPLICATION_STATUS.OFFER_ACCEPTED,
      to: JOB_APPLICATION_STATUS.HIRED,
      summary: "Candidate converted to employee",
    });
  },

  linkCandidateToEmployee(candidateId: string, employeeId: string) {
    const store = loadStore();
    const index = store.candidates.findIndex((item) => item.id === candidateId);
    if (index < 0) return;

    store.candidates[index] = {
      ...store.candidates[index],
      employeeId,
      updatedAt: nowIso(),
    };
    saveStore(store);
  },

  appendTimelineEvent(
    applicationId: string,
    input: {
      summary: string;
      comment?: string;
      actorName?: string;
    },
  ) {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === applicationId);
    if (index < 0) return;

    const current = store.applications[index];
    const updated = appendTimeline(current, {
      fromStatus: current.status,
      toStatus: current.status,
      summary: input.summary,
      comment: input.comment,
      actorName: input.actorName,
    });

    store.applications[index] = updated;
    saveStore(store);
  },

  transition(
    id: string,
    dto: ApplicationTransitionDto,
    rule: {
      from: JobApplicationStatus;
      to: JobApplicationStatus;
      summary: string;
    },
  ): JobApplication {
    const store = loadStore();
    const index = store.applications.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = store.applications[index];
    assertVersion(current, dto.expectedVersion);
    if (current.status !== rule.from) throw new Error("INVALID_TRANSITION");

    const updated = appendTimeline(current, {
      fromStatus: rule.from,
      toStatus: rule.to,
      summary: rule.summary,
      comment: dto.comment?.trim() || undefined,
    });

    store.applications[index] = updated;
    syncCandidateCounts(store);
    saveStore(store);
    return updated;
  },
};
