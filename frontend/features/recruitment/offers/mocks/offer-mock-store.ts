import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import { OfferResponseMockStore } from "../../offer-response/mocks/offer-response-mock-store";
import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import {
  JOB_APPLICATION_STATUS,
  JOB_OFFER_STATUS,
  type JobApplicationStatus,
  type JobOfferStatus,
} from "../../types/enums";
import type {
  CreateOfferDraftDto,
  JobOffer,
  JobOfferAllowedActions,
  JobOfferSearch,
  RetryOfferDeliveryDto,
  RevokeOfferDto,
  SendOfferDto,
  UpdateOfferDraftDto,
} from "../types/job-offer";

const STORAGE_KEY = "recruitment-offers-mock-v1";

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadOffers(): JobOffer[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JobOffer[];
    return Array.isArray(parsed) ? parsed.map(decorateOffer) : [];
  } catch {
    return [];
  }
}

function saveOffers(offers: JobOffer[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
}

function getApplicationStatus(applicationId: string): JobApplicationStatus | null {
  return RecruitmentPipelineMockStore.getApplication(applicationId)?.status ?? null;
}

function buildOfferAllowedActions(
  offer: JobOffer,
  applicationStatus: JobApplicationStatus | null
): JobOfferAllowedActions {
  const isDraft = offer.status === JOB_OFFER_STATUS.DRAFT;
  const isSent = offer.status === JOB_OFFER_STATUS.SENT;
  const canReviseFrom = (
    [
      JOB_OFFER_STATUS.SENT,
      JOB_OFFER_STATUS.REVOKED,
      JOB_OFFER_STATUS.EXPIRED,
      JOB_OFFER_STATUS.DECLINED,
    ] as JobOfferStatus[]
  ).includes(offer.status);

  return {
    canEdit: isDraft,
    canPreview: isDraft || isSent,
    canSend: isDraft && applicationStatus === JOB_APPLICATION_STATUS.SELECTED,
    canRetryDelivery: isSent && offer.delivery.status === "FAILED",
    canRevoke: isSent,
    canRevise: canReviseFrom,
  };
}

function decorateOffer(offer: JobOffer): JobOffer {
  const applicationStatus = getApplicationStatus(offer.jobApplicationId);
  return {
    ...offer,
    allowedActions: buildOfferAllowedActions(offer, applicationStatus),
  };
}

function assertOfferVersion(offer: JobOffer, version: number) {
  if (offer.version !== version) throw new Error("STALE_STATE");
}

function getNextVersionNumber(applicationId: string) {
  const offers = loadOffers().filter((offer) => offer.jobApplicationId === applicationId);
  if (offers.length === 0) return 1;
  return Math.max(...offers.map((offer) => offer.versionNumber)) + 1;
}

function hasActiveDraft(applicationId: string) {
  return loadOffers().some(
    (offer) => offer.jobApplicationId === applicationId && offer.status === JOB_OFFER_STATUS.DRAFT
  );
}

function hasActionableSentOffer(applicationId: string) {
  return loadOffers().some(
    (offer) => offer.jobApplicationId === applicationId && offer.status === JOB_OFFER_STATUS.SENT
  );
}

function syncApplicationToOfferSent(applicationId: string) {
  const application = RecruitmentPipelineMockStore.getApplication(applicationId);
  if (!application || application.status === JOB_APPLICATION_STATUS.OFFER_SENT) {
    return;
  }

  RecruitmentPipelineMockStore.transition(
    applicationId,
    { expectedVersion: application.version, operationId: createId() },
    {
      from: JOB_APPLICATION_STATUS.SELECTED,
      to: JOB_APPLICATION_STATUS.OFFER_SENT,
      summary: "Offer sent to candidate",
    }
  );
}

function syncApplicationToSelected(applicationId: string, summary: string, comment?: string) {
  const application = RecruitmentPipelineMockStore.getApplication(applicationId);
  if (!application) return;

  if (application.status === JOB_APPLICATION_STATUS.OFFER_SENT) {
    RecruitmentPipelineMockStore.transition(
      applicationId,
      {
        expectedVersion: application.version,
        operationId: createId(),
        comment,
      },
      {
        from: JOB_APPLICATION_STATUS.OFFER_SENT,
        to: JOB_APPLICATION_STATUS.SELECTED,
        summary,
      }
    );
    return;
  }

  RecruitmentPipelineMockStore.appendTimelineEvent(applicationId, {
    summary,
    comment,
    actorName: "HR User",
  });
}

function buildDraftFromApplication(
  application: NonNullable<ReturnType<typeof RecruitmentPipelineMockStore.getApplication>>,
  opening: NonNullable<ReturnType<typeof JobOpeningMockStore.getById>>,
  dto?: CreateOfferDraftDto
): JobOffer {
  const timestamp = nowIso();
  const versionNumber = getNextVersionNumber(application.id);

  return decorateOffer({
    id: createId(),
    jobApplicationId: application.id,
    applicationNumber: application.applicationNumber,
    candidateName: `${application.candidateFirstName} ${application.candidateLastName}`.trim(),
    candidateEmail: application.candidateEmail,
    jobOpeningId: opening.id,
    openingCode: opening.openingCode,
    openingTitle: opening.title,
    versionNumber,
    status: JOB_OFFER_STATUS.DRAFT,
    version: 1,
    roleTitle: dto?.roleTitle ?? opening.title,
    organization: {
      companyId: opening.companyId,
      companyName: opening.companyName,
      branchId: opening.branchId,
      branchName: opening.branchName,
      departmentId: opening.departmentId,
      departmentName: opening.departmentName,
      designationId: opening.designationId,
      designationName: opening.designationName,
    },
    reportingManagerEmployeeId: dto?.reportingManagerEmployeeId ?? opening.hiringManagerEmployeeId,
    reportingManagerName: dto?.reportingManagerName ?? opening.hiringManagerName,
    employmentType: dto?.employmentType ?? opening.employmentType,
    joiningDate: dto?.joiningDate ?? opening.targetJoiningDate ?? addDaysIso(30),
    compensation: {
      amount: dto?.compensationAmount ?? 0,
      currency: dto?.compensationCurrency ?? "",
      period: dto?.compensationPeriod ?? "ANNUAL",
    },
    probationDays: dto?.probationDays ?? 90,
    expiryDate: dto?.expiryDate ?? addDaysIso(14),
    terms: dto?.terms?.trim() || undefined,
    delivery: { status: "NOT_SENT" },
    createdAt: timestamp,
    updatedAt: timestamp,
    allowedActions: {
      canEdit: true,
      canPreview: true,
      canSend: false,
      canRetryDelivery: false,
      canRevoke: false,
      canRevise: false,
    },
  });
}

function applyDraftUpdate(offer: JobOffer, dto: UpdateOfferDraftDto): JobOffer {
  return decorateOffer({
    ...offer,
    roleTitle: dto.roleTitle.trim(),
    reportingManagerEmployeeId: dto.reportingManagerEmployeeId,
    reportingManagerName: dto.reportingManagerName,
    employmentType: dto.employmentType,
    joiningDate: dto.joiningDate,
    compensation: {
      amount: dto.compensationAmount,
      currency: dto.compensationCurrency,
      period: dto.compensationPeriod,
    },
    probationDays: dto.probationDays,
    expiryDate: dto.expiryDate,
    terms: dto.terms?.trim() || undefined,
    version: offer.version + 1,
    updatedAt: nowIso(),
  });
}

function matchesSearch(offer: JobOffer, filters?: JobOfferSearch) {
  if (filters?.status && offer.status !== filters.status) return false;
  if (filters?.jobOpeningId && offer.jobOpeningId !== filters.jobOpeningId) {
    return false;
  }
  if (filters?.branchId && offer.organization.branchId !== filters.branchId) {
    return false;
  }

  const keyword = filters?.search?.trim().toLowerCase();
  if (!keyword) return true;

  return (
    offer.applicationNumber.toLowerCase().includes(keyword) ||
    offer.candidateName.toLowerCase().includes(keyword) ||
    offer.candidateEmail.toLowerCase().includes(keyword) ||
    offer.openingCode.toLowerCase().includes(keyword) ||
    offer.openingTitle.toLowerCase().includes(keyword) ||
    offer.roleTitle.toLowerCase().includes(keyword)
  );
}

function shouldSimulateDeliveryFailure(terms?: string) {
  return terms?.includes("[mock-delivery-fail]") ?? false;
}

export const OfferMockStore = {
  list(filters?: JobOfferSearch): JobOffer[] {
    return loadOffers()
      .filter((offer) => matchesSearch(offer, filters))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  listByApplication(applicationId: string): JobOffer[] {
    return loadOffers()
      .filter((offer) => offer.jobApplicationId === applicationId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map(decorateOffer);
  },

  getById(id: string): JobOffer | null {
    return loadOffers().find((offer) => offer.id === id) ?? null;
  },

  createDraft(applicationId: string, dto?: CreateOfferDraftDto): JobOffer {
    const application = RecruitmentPipelineMockStore.getApplication(applicationId);
    if (!application) throw new Error("NOT_FOUND");
    if (application.status !== JOB_APPLICATION_STATUS.SELECTED) {
      throw new Error("INVALID_TRANSITION");
    }
    if (hasActiveDraft(applicationId)) {
      throw new Error("DRAFT_ALREADY_EXISTS");
    }
    if (hasActionableSentOffer(applicationId)) {
      throw new Error("ACTIONABLE_OFFER_EXISTS");
    }

    const opening = JobOpeningMockStore.getById(application.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");

    const offer = buildDraftFromApplication(application, opening, dto);
    const offers = loadOffers();
    offers.unshift(offer);
    saveOffers(offers);

    RecruitmentPipelineMockStore.appendTimelineEvent(applicationId, {
      summary: `Offer draft v${offer.versionNumber} created`,
    });

    return offer;
  },

  updateDraft(id: string, dto: UpdateOfferDraftDto): JobOffer {
    const offers = loadOffers();
    const index = offers.findIndex((offer) => offer.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = offers[index];
    assertOfferVersion(current, dto.version);
    if (current.status !== JOB_OFFER_STATUS.DRAFT) {
      throw new Error("OFFER_IMMUTABLE");
    }

    const updated = applyDraftUpdate(current, dto);
    offers[index] = updated;
    saveOffers(offers);
    return updated;
  },

  send(id: string, dto: SendOfferDto): JobOffer {
    const offers = loadOffers();
    const index = offers.findIndex((offer) => offer.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = offers[index];
    assertOfferVersion(current, dto.version);
    if (current.status !== JOB_OFFER_STATUS.DRAFT) {
      throw new Error("INVALID_TRANSITION");
    }
    if (current.compensation.amount <= 0) {
      throw new Error("INVALID_COMPENSATION");
    }

    const application = RecruitmentPipelineMockStore.getApplication(current.jobApplicationId);
    if (!application || application.status !== JOB_APPLICATION_STATUS.SELECTED) {
      throw new Error("INVALID_TRANSITION");
    }
    if (hasActionableSentOffer(current.jobApplicationId)) {
      throw new Error("ACTIONABLE_OFFER_EXISTS");
    }

    const { impact } = JobOpeningMockStore.reserveHeadcount(current.jobOpeningId);
    const timestamp = nowIso();
    const simulateFailure = shouldSimulateDeliveryFailure(current.terms);

    const updated = decorateOffer({
      ...current,
      status: JOB_OFFER_STATUS.SENT,
      version: current.version + 1,
      delivery: {
        status: simulateFailure ? "FAILED" : "SENT",
        lastAttemptAt: timestamp,
        failureReason: simulateFailure
          ? "Mock delivery failure — use Retry delivery or remove [mock-delivery-fail] from terms."
          : undefined,
      },
      headcountImpact: impact,
      sentAt: timestamp,
      sentByName: "HR User",
      updatedAt: timestamp,
      allowedActions: {
        canEdit: false,
        canPreview: true,
        canSend: false,
        canRetryDelivery: simulateFailure,
        canRevoke: true,
        canRevise: true,
      },
    });

    offers[index] = updated;
    saveOffers(offers);
    syncApplicationToOfferSent(current.jobApplicationId);

    RecruitmentPipelineMockStore.appendTimelineEvent(current.jobApplicationId, {
      summary: `Offer v${updated.versionNumber} sent`,
      comment: simulateFailure
        ? "Email delivery failed — retry available."
        : "Offer email delivered to candidate.",
    });

    if (!simulateFailure) {
      OfferResponseMockStore.issueToken(updated.id, updated.expiryDate);
    }

    return updated;
  },

  retryDelivery(id: string, dto: RetryOfferDeliveryDto): JobOffer {
    const offers = loadOffers();
    const index = offers.findIndex((offer) => offer.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = offers[index];
    assertOfferVersion(current, dto.version);
    if (current.status !== JOB_OFFER_STATUS.SENT) {
      throw new Error("INVALID_TRANSITION");
    }
    if (current.delivery.status !== "FAILED") {
      throw new Error("DELIVERY_NOT_FAILED");
    }
    if (!dto.reason?.trim()) throw new Error("REASON_REQUIRED");

    const timestamp = nowIso();
    const updated = decorateOffer({
      ...current,
      version: current.version + 1,
      delivery: {
        status: "SENT",
        lastAttemptAt: timestamp,
        failureReason: undefined,
        retryAvailable: false,
      },
      updatedAt: timestamp,
    });

    offers[index] = updated;
    saveOffers(offers);

    RecruitmentPipelineMockStore.appendTimelineEvent(current.jobApplicationId, {
      summary: `Offer v${updated.versionNumber} delivery retried`,
      comment: dto.reason.trim(),
    });

    OfferResponseMockStore.issueToken(updated.id, updated.expiryDate);

    return updated;
  },

  revoke(id: string, dto: RevokeOfferDto): JobOffer {
    const offers = loadOffers();
    const index = offers.findIndex((offer) => offer.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = offers[index];
    assertOfferVersion(current, dto.version);
    if (current.status !== JOB_OFFER_STATUS.SENT) {
      throw new Error("INVALID_TRANSITION");
    }
    if (!dto.reason.trim()) throw new Error("REASON_REQUIRED");

    JobOpeningMockStore.releaseHeadcount(current.jobOpeningId);

    const timestamp = nowIso();
    const updated = decorateOffer({
      ...current,
      status: JOB_OFFER_STATUS.REVOKED,
      version: current.version + 1,
      revokedAt: timestamp,
      revokedByName: "HR User",
      updatedAt: timestamp,
    });

    offers[index] = updated;
    saveOffers(offers);
    syncApplicationToSelected(
      current.jobApplicationId,
      `Offer v${updated.versionNumber} revoked`,
      dto.reason.trim()
    );

    OfferResponseMockStore.invalidateTokensForOffer(current.id);

    return updated;
  },

  revise(sourceOfferId: string): JobOffer {
    const source = this.getById(sourceOfferId);
    if (!source) throw new Error("NOT_FOUND");
    if (!source.allowedActions.canRevise) throw new Error("INVALID_TRANSITION");
    if (hasActiveDraft(source.jobApplicationId)) {
      throw new Error("DRAFT_ALREADY_EXISTS");
    }

    const application = RecruitmentPipelineMockStore.getApplication(source.jobApplicationId);
    if (!application) throw new Error("NOT_FOUND");

    if (source.status === JOB_OFFER_STATUS.SENT) {
      JobOpeningMockStore.releaseHeadcount(source.jobOpeningId);
      syncApplicationToSelected(
        source.jobApplicationId,
        `Offer v${source.versionNumber} superseded for revision`
      );
    }

    const offers = loadOffers();
    const sourceIndex = offers.findIndex((offer) => offer.id === sourceOfferId);
    if (sourceIndex >= 0 && offers[sourceIndex].status === JOB_OFFER_STATUS.SENT) {
      const versionNumber = getNextVersionNumber(source.jobApplicationId);
      OfferResponseMockStore.invalidateTokensForOffer(sourceOfferId);
      offers[sourceIndex] = decorateOffer({
        ...offers[sourceIndex],
        status: JOB_OFFER_STATUS.SUPERSEDED,
        supersededByVersion: versionNumber,
        version: offers[sourceIndex].version + 1,
        updatedAt: nowIso(),
      });
    }

    const opening = JobOpeningMockStore.getById(source.jobOpeningId);
    if (!opening) throw new Error("OPENING_NOT_FOUND");

    const draft = buildDraftFromApplication(application, opening, {
      roleTitle: source.roleTitle,
      reportingManagerEmployeeId: source.reportingManagerEmployeeId,
      reportingManagerName: source.reportingManagerName,
      employmentType: source.employmentType,
      joiningDate: source.joiningDate,
      compensationAmount: source.compensation.amount,
      compensationCurrency: source.compensation.currency,
      compensationPeriod: source.compensation.period,
      probationDays: source.probationDays,
      expiryDate: source.expiryDate,
      terms: source.terms,
    });

    offers.unshift(draft);
    saveOffers(offers);

    RecruitmentPipelineMockStore.appendTimelineEvent(source.jobApplicationId, {
      summary: `Revised offer draft v${draft.versionNumber} created`,
    });

    return draft;
  },

  getAcceptedOffer(applicationId: string): JobOffer | null {
    const offers = loadOffers().filter((offer) => offer.jobApplicationId === applicationId);
    return offers.find((offer) => offer.status === JOB_OFFER_STATUS.ACCEPTED) ?? null;
  },

  markAccepted(id: string, version: number): JobOffer {
    const offers = loadOffers();
    const index = offers.findIndex((offer) => offer.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = offers[index];
    assertOfferVersion(current, version);
    if (current.status !== JOB_OFFER_STATUS.SENT) {
      throw new Error("INVALID_TRANSITION");
    }

    const updated = decorateOffer({
      ...current,
      status: JOB_OFFER_STATUS.ACCEPTED,
      responseAt: nowIso(),
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    offers[index] = updated;
    saveOffers(offers);
    return updated;
  },

  markDeclined(id: string, version: number): JobOffer {
    const offers = loadOffers();
    const index = offers.findIndex((offer) => offer.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = offers[index];
    assertOfferVersion(current, version);
    if (current.status !== JOB_OFFER_STATUS.SENT) {
      throw new Error("INVALID_TRANSITION");
    }

    const updated = decorateOffer({
      ...current,
      status: JOB_OFFER_STATUS.DECLINED,
      responseAt: nowIso(),
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    offers[index] = updated;
    saveOffers(offers);
    return updated;
  },
};
