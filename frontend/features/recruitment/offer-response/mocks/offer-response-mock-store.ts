import { OfferMockStore } from "../../offers/mocks/offer-mock-store";
import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import { JOB_APPLICATION_STATUS, JOB_OFFER_STATUS } from "../../types/enums";
import type {
  DeclineOfferInput,
  OfferResponseInput,
  OfferResponseInspection,
  OfferResponseResult,
  OfferResponseState,
  PublicOfferSnapshot,
} from "../types/offer-response";

const TOKEN_STORAGE_KEY = "recruitment-offer-response-tokens-v1";

interface OfferTokenRecord {
  offerId: string;
  expiresAt: string;
  consumedAt?: string;
  responseType?: "ACCEPTED" | "DECLINED";
}

function nowIso() {
  return new Date().toISOString();
}

function loadTokens(): Record<string, OfferTokenRecord> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, OfferTokenRecord>;
  } catch {
    return {};
  }
}

function saveTokens(tokens: Record<string, OfferTokenRecord>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

function generateToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function isExpiredDate(value: string) {
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

function toPublicSnapshot(
  offer: NonNullable<ReturnType<typeof OfferMockStore.getById>>
): PublicOfferSnapshot {
  return {
    roleTitle: offer.roleTitle,
    companyName: offer.organization.companyName,
    branchName: offer.organization.branchName,
    designationName: offer.organization.designationName,
    reportingManagerName: offer.reportingManagerName,
    employmentType: offer.employmentType,
    joiningDate: offer.joiningDate,
    compensation: offer.compensation,
    probationDays: offer.probationDays,
    expiryDate: offer.expiryDate,
    terms: offer.terms,
    versionNumber: offer.versionNumber,
  };
}

function buildInspection(
  state: OfferResponseState,
  message: string,
  offer?: PublicOfferSnapshot,
  canRespond = false,
  responseVersion?: number
): OfferResponseInspection {
  return {
    state,
    message,
    offer,
    canRespond,
    canDownloadPdf: Boolean(offer),
    responseVersion,
  };
}

function resolveOfferState(
  offer: NonNullable<ReturnType<typeof OfferMockStore.getById>>,
  tokenRecord?: OfferTokenRecord
): OfferResponseInspection {
  const snapshot = toPublicSnapshot(offer);

  if (offer.status === JOB_OFFER_STATUS.ACCEPTED || tokenRecord?.responseType === "ACCEPTED") {
    return buildInspection(
      "ALREADY_ACCEPTED",
      "This offer has already been accepted. No further action is required.",
      snapshot
    );
  }

  if (offer.status === JOB_OFFER_STATUS.DECLINED || tokenRecord?.responseType === "DECLINED") {
    return buildInspection("ALREADY_DECLINED", "This offer has already been declined.", snapshot);
  }

  if (offer.status === JOB_OFFER_STATUS.REVOKED) {
    return buildInspection(
      "REVOKED",
      "This offer is no longer available because it was revoked by the employer.",
      snapshot
    );
  }

  if (offer.status === JOB_OFFER_STATUS.SUPERSEDED) {
    return buildInspection(
      "SUPERSEDED",
      "This offer link is no longer active because a revised offer was issued.",
      snapshot
    );
  }

  if (offer.status === JOB_OFFER_STATUS.EXPIRED || isExpiredDate(offer.expiryDate)) {
    return buildInspection(
      "EXPIRED",
      "This offer has expired and can no longer be accepted or declined.",
      snapshot
    );
  }

  if (offer.status !== JOB_OFFER_STATUS.SENT) {
    return buildInspection(
      "INVALID",
      "This offer link is not valid for response right now.",
      snapshot
    );
  }

  return buildInspection(
    "VALID",
    "Review the offer details below and respond using your legal name.",
    snapshot,
    true,
    offer.version
  );
}

function syncAccepted(applicationId: string, legalName: string) {
  const application = RecruitmentPipelineMockStore.getApplication(applicationId);
  if (!application || application.status !== JOB_APPLICATION_STATUS.OFFER_SENT) return;

  RecruitmentPipelineMockStore.transition(
    applicationId,
    {
      expectedVersion: application.version,
      operationId: generateToken(),
      comment: `Accepted by ${legalName}`,
    },
    {
      from: JOB_APPLICATION_STATUS.OFFER_SENT,
      to: JOB_APPLICATION_STATUS.OFFER_ACCEPTED,
      summary: "Offer accepted by candidate",
    }
  );
}

function syncDeclined(applicationId: string, legalName: string, reason?: string) {
  const application = RecruitmentPipelineMockStore.getApplication(applicationId);
  if (!application || application.status !== JOB_APPLICATION_STATUS.OFFER_SENT) return;

  RecruitmentPipelineMockStore.transition(
    applicationId,
    {
      expectedVersion: application.version,
      operationId: generateToken(),
      comment: reason?.trim() || `Declined by ${legalName}`,
    },
    {
      from: JOB_APPLICATION_STATUS.OFFER_SENT,
      to: JOB_APPLICATION_STATUS.OFFER_DECLINED,
      summary: "Offer declined by candidate",
    }
  );
}

export const OfferResponseMockStore = {
  issueToken(offerId: string, expiresAt: string) {
    this.invalidateTokensForOffer(offerId);
    const token = generateToken();
    const tokens = loadTokens();
    tokens[token] = { offerId, expiresAt };
    saveTokens(tokens);
    return token;
  },

  invalidateTokensForOffer(offerId: string) {
    const tokens = loadTokens();
    let changed = false;

    for (const [token, record] of Object.entries(tokens)) {
      if (record.offerId === offerId && !record.consumedAt) {
        tokens[token] = {
          ...record,
          consumedAt: nowIso(),
        };
        changed = true;
      }
    }

    if (changed) saveTokens(tokens);
  },

  getTokenForOffer(offerId: string) {
    const tokens = loadTokens();
    return (
      Object.entries(tokens).find(
        ([, record]) => record.offerId === offerId && !record.consumedAt
      )?.[0] ?? null
    );
  },

  inspect(token: string): OfferResponseInspection {
    if (!token.trim()) {
      return buildInspection("INVALID", "This offer link is invalid.");
    }

    const tokens = loadTokens();
    const record = tokens[token];
    if (!record) {
      return buildInspection("INVALID", "This offer link is invalid or has already been used.");
    }

    if (record.consumedAt && !record.responseType) {
      return buildInspection("INVALID", "This offer link is invalid or has already been used.");
    }

    const offer = OfferMockStore.getById(record.offerId);
    if (!offer) {
      return buildInspection("INVALID", "This offer link is invalid.");
    }

    if (isExpiredDate(record.expiresAt) && offer.status === JOB_OFFER_STATUS.SENT) {
      return buildInspection(
        "EXPIRED",
        "This offer has expired and can no longer be accepted or declined.",
        toPublicSnapshot(offer)
      );
    }

    return resolveOfferState(offer, record);
  },

  accept(token: string, input: OfferResponseInput): OfferResponseResult {
    if (!input.legalName.trim()) throw new Error("LEGAL_NAME_REQUIRED");
    if (!input.acknowledgement) throw new Error("ACKNOWLEDGEMENT_REQUIRED");

    const inspection = this.inspect(token);
    if (!inspection.canRespond || !inspection.responseVersion) {
      throw new Error("OFFER_NOT_RESPONDABLE");
    }

    const tokens = loadTokens();
    const record = tokens[token];
    if (!record || record.consumedAt) throw new Error("OFFER_TOKEN_INVALID");

    const offer = OfferMockStore.getById(record.offerId);
    if (!offer || offer.version !== input.responseVersion) {
      throw new Error("STALE_STATE");
    }

    const timestamp = nowIso();
    OfferMockStore.markAccepted(offer.id, offer.version);
    syncAccepted(offer.jobApplicationId, input.legalName.trim());

    tokens[token] = {
      ...record,
      consumedAt: timestamp,
      responseType: "ACCEPTED",
    };
    saveTokens(tokens);

    RecruitmentPipelineMockStore.appendTimelineEvent(offer.jobApplicationId, {
      summary: `Offer v${offer.versionNumber} accepted`,
      comment: `Signed as ${input.legalName.trim()}`,
      actorName: "Candidate",
    });

    return {
      state: "ACCEPTED",
      message:
        "Thank you for accepting the offer. Our HR team will contact you with the next onboarding steps.",
      respondedAt: timestamp,
    };
  },

  decline(token: string, input: DeclineOfferInput): OfferResponseResult {
    if (!input.legalName.trim()) throw new Error("LEGAL_NAME_REQUIRED");
    if (!input.acknowledgement) throw new Error("ACKNOWLEDGEMENT_REQUIRED");

    const inspection = this.inspect(token);
    if (!inspection.canRespond || !inspection.responseVersion) {
      throw new Error("OFFER_NOT_RESPONDABLE");
    }

    const tokens = loadTokens();
    const record = tokens[token];
    if (!record || record.consumedAt) throw new Error("OFFER_TOKEN_INVALID");

    const offer = OfferMockStore.getById(record.offerId);
    if (!offer || offer.version !== input.responseVersion) {
      throw new Error("STALE_STATE");
    }

    const timestamp = nowIso();
    OfferMockStore.markDeclined(offer.id, offer.version);
    JobOpeningMockStore.releaseHeadcount(offer.jobOpeningId);
    syncDeclined(offer.jobApplicationId, input.legalName.trim(), input.reason);

    tokens[token] = {
      ...record,
      consumedAt: timestamp,
      responseType: "DECLINED",
    };
    saveTokens(tokens);

    RecruitmentPipelineMockStore.appendTimelineEvent(offer.jobApplicationId, {
      summary: `Offer v${offer.versionNumber} declined`,
      comment: input.reason?.trim() || `Signed as ${input.legalName.trim()}`,
      actorName: "Candidate",
    });

    return {
      state: "DECLINED",
      message: "Your decision to decline this offer has been recorded.",
      respondedAt: timestamp,
    };
  },
};
