import type { Candidate } from "../candidates/types/candidate";
import type {
  ApplicationTimelineEntry,
  JobApplication,
  RecruitmentDocument,
} from "../applications/types/job-application";
import type {
  HiringComparisonCandidate,
  HiringComparisonView,
  HiringDecisionQueueItem,
} from "../hiring-decisions/types/hiring-decision";
import type { InterviewEvaluation, InterviewSession } from "../interviews/types/interview";
import type { JobOffer } from "../offers/types/job-offer";
import { normalizeOfferDeliveryStatus } from "../offers/utils/offer-delivery";
import type { JobOpening } from "../openings/types/job-opening";
import type { PublicationChecklist } from "../openings/types/publication-checklist";
import type {
  ConversionPreflight,
  ConversionResult,
  ReadyToHireQueueItem,
} from "../ready-to-hire/types/conversion-preflight";
import type {
  PublicCompanyProfile,
  PublicJobOpeningDetail,
  PublicJobOpeningListItem,
} from "../careers/types/public-careers";
import type {
  OfferResponseInspection,
  OfferResponseResult,
  OfferResponseState,
} from "../offer-response/types/offer-response";
import type {
  JobApplicationSource,
  JobApplicationStatus,
  JobOfferStatus,
  RecruitmentDocumentKind,
} from "../types/enums";
import {
  JOB_APPLICATION_SOURCE,
  JOB_OFFER_STATUS,
  RECRUITMENT_DOCUMENT_KIND,
} from "../types/enums";
import {
  buildApplicationCurrentOwner,
  buildApplicationNextAction,
} from "../applications/utils/application-actions";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function optStr(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return str(value);
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function iso(value: unknown, fallback = ""): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? str(value, fallback) : date.toISOString();
}

function dateOnly(value: unknown, fallback = ""): string {
  const serialized = iso(value, fallback);
  return serialized ? serialized.slice(0, 10) : fallback;
}

function personName(...parts: unknown[]): string {
  return parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" ");
}

function nestedName(
  record: unknown,
  nameKey: string,
  fallbackKeys: string[] = []
): string | undefined {
  const source = asRecord(record);
  if (typeof source[nameKey] === "string") return source[nameKey] as string;
  for (const key of fallbackKeys) {
    if (typeof source[key] === "string") return source[key] as string;
  }
  return undefined;
}

export function unwrapRecruitmentRecord(payload: unknown): JsonRecord {
  const root = asRecord(payload);
  if (isRecord(root.record)) {
    return {
      ...root.record,
      version: root.version ?? root.record.version,
      allowedActions: root.allowedActions ?? root.record.allowedActions,
    };
  }
  if (isRecord(root.offer)) {
    return {
      ...root.offer,
      delivery: root.delivery ?? root.offer.delivery,
      allowedActions: root.allowedActions ?? root.offer.allowedActions,
      message: root.message,
    };
  }
  return root;
}

export function unwrapPagedItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.data)) return root.data;
  return [];
}

export function unwrapPagedResult(payload: unknown): {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
} {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      page: 1,
      limit: payload.length || 20,
    };
  }

  const root = asRecord(payload);
  const items = unwrapPagedItems(payload);
  return {
    items,
    total: num(root.total, items.length),
    page: num(root.page, 1),
    limit: num(root.limit, items.length || 20),
  };
}

function hasAction(actions: unknown, action: string): boolean {
  if (Array.isArray(actions)) {
    return actions.includes(action);
  }
  if (isRecord(actions)) {
    const camel = action.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return Boolean(actions[action] ?? actions[camel]);
  }
  return false;
}

function openingNextAction(status: string): string | undefined {
  switch (status) {
    case "DRAFT":
      return "Publish";
    case "OPEN":
      return "Hold";
    case "ON_HOLD":
      return "Reopen";
    case "FILLED":
      return "Close";
    default:
      return undefined;
  }
}

export function mapJobOpening(payload: unknown): JobOpening {
  const raw = unwrapRecruitmentRecord(payload);
  const company = asRecord(raw.company);
  const branch = asRecord(raw.branch);
  const department = asRecord(raw.department);
  const designation = asRecord(raw.designation);
  const hiringManager = asRecord(raw.hiringManager);
  const approved = num(raw.headcountTotal ?? asRecord(raw.headcount).approved, 1);
  const used = num(raw.headcountFilled ?? asRecord(raw.headcount).used);
  const reserved = num(raw.headcountReserved ?? asRecord(raw.headcount).reserved);
  const remaining = Math.max(approved - used - reserved, 0);
  const actions = raw.allowedActions;

  return {
    id: str(raw.id),
    openingCode: str(raw.openingCode),
    title: str(raw.title),
    description: optStr(raw.description),
    status: str(raw.status, "DRAFT") as JobOpening["status"],
    version: num(raw.version, 1),
    companyGroupId: str(raw.companyGroupId),
    companyId: str(raw.companyId),
    companyCode: optStr(company.companyCode) ?? optStr(raw.companyCode),
    branchId: str(raw.branchId),
    departmentId: str(raw.departmentId),
    designationId: str(raw.designationId),
    companyName: nestedName(company, "companyName") ?? optStr(raw.companyName),
    branchName: nestedName(branch, "branchName") ?? optStr(raw.branchName),
    departmentName: nestedName(department, "departmentName") ?? optStr(raw.departmentName),
    designationName: nestedName(designation, "designationName") ?? optStr(raw.designationName),
    hiringManagerEmployeeId: str(raw.hiringManagerEmployeeId),
    hiringManagerName:
      personName(hiringManager.firstName, hiringManager.lastName) || optStr(raw.hiringManagerName),
    employmentType: str(raw.employmentType, "FULL_TIME"),
    location: optStr(raw.location),
    headcount: {
      approved,
      used,
      reserved,
      remaining: num(asRecord(raw.headcount).remaining, remaining),
    },
    targetJoiningDate: optStr(dateOnly(raw.targetJoiningDate, "")),
    applicationDeadline: dateOnly(raw.applicationDeadline),
    publishedAt: optStr(iso(raw.publishedAt, "")),
    criteria: asArray(raw.criteria).map((item, index) => {
      const criterion = asRecord(item);
      return {
        id: str(criterion.id, `criterion-${index}`),
        name: str(criterion.name),
        description: optStr(criterion.description),
        weightPercentage: num(criterion.weightPercentage ?? criterion.weightPercent),
        displayOrder: num(criterion.displayOrder, index + 1),
        isRequired: Boolean(criterion.isRequired ?? true),
        isActive: Boolean(criterion.isActive ?? true),
      };
    }),
    allowedActions:
      isRecord(actions) && "canEdit" in actions
        ? {
            canEdit: Boolean(actions.canEdit),
            canPublish: Boolean(actions.canPublish),
            canHold: Boolean(actions.canHold),
            canReopen: Boolean(actions.canReopen),
            canClose: Boolean(actions.canClose),
          }
        : {
            canEdit: hasAction(actions, "update"),
            canPublish: hasAction(actions, "publish"),
            canHold: hasAction(actions, "hold"),
            canReopen: hasAction(actions, "reopen"),
            canClose: hasAction(actions, "close"),
          },
    nextAction: optStr(raw.nextAction) ?? openingNextAction(str(raw.status)),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function mapPublicationChecklist(payload: unknown): PublicationChecklist {
  const root = asRecord(payload);
  const items = asArray(root.items ?? payload).map((item) => {
    const check = asRecord(item);
    return {
      code: str(check.code),
      label: str(check.label, str(check.code)),
      passed: Boolean(check.passed),
      message: optStr(check.message),
    };
  });

  return {
    items,
    canPublish:
      typeof root.canPublish === "boolean"
        ? root.canPublish
        : items.length > 0 && items.every((item) => item.passed),
  };
}

export function toOpeningWritePayload(dto: {
  companyId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  hiringManagerEmployeeId: string;
  title: string;
  description?: string;
  employmentType: string;
  location?: string;
  headcount: number;
  targetJoiningDate?: string;
  applicationDeadline: string;
  criteria: Array<{
    name: string;
    description?: string;
    weightPercentage: number;
    displayOrder: number;
    isRequired: boolean;
    isActive: boolean;
  }>;
  version?: number;
}) {
  return {
    companyId: dto.companyId,
    branchId: dto.branchId,
    departmentId: dto.departmentId,
    designationId: dto.designationId,
    hiringManagerEmployeeId: dto.hiringManagerEmployeeId,
    title: dto.title,
    description: dto.description,
    employmentType: dto.employmentType,
    location: dto.location,
    headcountTotal: dto.headcount,
    targetJoiningDate: dto.targetJoiningDate || undefined,
    applicationDeadline: dto.applicationDeadline || undefined,
    version: dto.version,
    criteria: dto.criteria.map((item, index) => ({
      name: item.name,
      description: item.description,
      weightPercent: item.weightPercentage,
      displayOrder: index + 1,
      isRequired: item.isRequired,
      isActive: item.isActive,
    })),
  };
}

function mapApplicationSource(value: unknown): JobApplicationSource {
  if (value === "HR_INTERNAL" || value === JOB_APPLICATION_SOURCE.INTERNAL_HR) {
    return JOB_APPLICATION_SOURCE.INTERNAL_HR;
  }
  return JOB_APPLICATION_SOURCE.PUBLIC_CAREERS;
}

function mapDocumentKind(value: unknown): RecruitmentDocumentKind {
  if (value === "SUPPORTING" || value === "SUPPORTING_DOCUMENT") {
    return RECRUITMENT_DOCUMENT_KIND.SUPPORTING_DOCUMENT;
  }
  if (value === "OFFER_PDF") return RECRUITMENT_DOCUMENT_KIND.OFFER_PDF;
  return RECRUITMENT_DOCUMENT_KIND.CV;
}

function mapTimeline(raw: JsonRecord): ApplicationTimelineEntry[] {
  const history = asArray(raw.timeline ?? raw.statusHistory);
  return history.map((item, index) => {
    const entry = asRecord(item);
    const toStatus = str(entry.toStatus, "APPLIED") as JobApplicationStatus;
    return {
      id: str(entry.id, `timeline-${index}`),
      fromStatus: optStr(entry.fromStatus) as JobApplicationStatus | undefined,
      toStatus,
      summary: str(
        entry.summary,
        entry.fromStatus ? `${entry.fromStatus} → ${toStatus}` : `Moved to ${toStatus}`
      ),
      reasonCode: optStr(entry.reasonCode),
      comment: optStr(entry.comment),
      actorName: str(entry.actorName ?? entry.actorType, "System"),
      occurredAt: iso(entry.occurredAt ?? entry.createdAt),
    };
  });
}

function mapDocuments(raw: JsonRecord): RecruitmentDocument[] {
  return asArray(raw.documents).map((item, index) => {
    const document = asRecord(item);
    return {
      id: str(document.id, `document-${index}`),
      kind: mapDocumentKind(document.kind),
      fileName: str(
        document.fileName ?? document.displayName ?? document.originalFileName,
        "Document"
      ),
      fileSize: num(document.fileSize),
      uploadedAt: iso(document.uploadedAt ?? document.createdAt),
    };
  });
}

export function mapJobApplication(payload: unknown): JobApplication {
  const raw = unwrapRecruitmentRecord(payload);
  const candidate = asRecord(raw.candidate);
  const opening = asRecord(raw.jobOpening);
  const branch = asRecord(opening.branch ?? raw.branch);
  const status = str(raw.status, "APPLIED") as JobApplicationStatus;
  const actions = raw.allowedActions;

  return {
    id: str(raw.id),
    applicationNumber: str(raw.applicationNumber ?? raw.applicationCode),
    candidateId: str(raw.candidateId ?? candidate.id),
    candidateFirstName: str(raw.candidateFirstName ?? candidate.firstName),
    candidateLastName: str(raw.candidateLastName ?? candidate.lastName),
    candidateEmail: str(raw.candidateEmail ?? candidate.email),
    candidateMobile: optStr(raw.candidateMobile ?? candidate.mobile),
    jobOpeningId: str(raw.jobOpeningId ?? opening.id),
    openingCode: str(raw.openingCode ?? opening.openingCode),
    openingTitle: str(raw.openingTitle ?? opening.title),
    branchId: str(raw.branchId ?? opening.branchId ?? branch.id),
    branchName: nestedName(branch, "branchName") ?? optStr(raw.branchName),
    companyId: str(raw.companyId ?? opening.companyId),
    companyName: optStr(raw.companyName),
    status,
    source: mapApplicationSource(raw.source),
    version: num(raw.version, 1),
    coverNote: optStr(raw.coverNote),
    submittedAt: iso(raw.submittedAt ?? raw.createdAt),
    currentOwner: optStr(raw.currentOwner) ?? buildApplicationCurrentOwner(status),
    nextAction: optStr(raw.nextAction) ?? buildApplicationNextAction(status),
    relevantDeadline: optStr(iso(raw.relevantDeadline, "")),
    allowedActions:
      isRecord(actions) && "canStartScreening" in actions
        ? {
            canShortlist: Boolean(actions.canShortlist),
            canStartScreening: Boolean(actions.canStartScreening),
            canAdvanceToInterview: Boolean(actions.canAdvanceToInterview),
            canAdvanceToManagerReview: Boolean(actions.canAdvanceToManagerReview),
            canReject: Boolean(actions.canReject),
            canWithdraw: Boolean(actions.canWithdraw),
          }
        : {
            canShortlist: hasAction(actions, "shortlist"),
            canStartScreening: hasAction(actions, "start-screening"),
            canAdvanceToInterview: hasAction(actions, "advance-to-interview"),
            canAdvanceToManagerReview: hasAction(actions, "advance-to-manager-review"),
            canReject: hasAction(actions, "reject"),
            canWithdraw: hasAction(actions, "withdraw"),
          },
    documents: mapDocuments(raw),
    timeline: mapTimeline(raw),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function mapCandidate(payload: unknown): Candidate {
  const raw = asRecord(payload);
  const applications = asArray(raw.applications);
  return {
    id: str(raw.id),
    firstName: str(raw.firstName),
    lastName: str(raw.lastName),
    email: str(raw.email),
    mobile: optStr(raw.mobile),
    primarySource: mapApplicationSource(raw.source ?? raw.primarySource),
    employeeId: optStr(raw.employeeId),
    applicationCount: num(raw.applicationCount, applications.length),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

function mapEvaluation(payload: unknown, sessionId: string): InterviewEvaluation {
  const raw = asRecord(payload);
  return {
    id: str(raw.id),
    interviewSessionId: str(raw.interviewSessionId ?? sessionId),
    panelMemberEmployeeId: str(raw.panelMemberEmployeeId ?? raw.employeeId),
    panelMemberName: str(raw.panelMemberName, "Panel member"),
    status: str(raw.status, "DRAFT") as InterviewEvaluation["status"],
    recommendation: optStr(raw.recommendation),
    strengths: optStr(raw.strengths),
    concerns: optStr(raw.concerns),
    confidentialNotes: optStr(raw.confidentialNotes),
    weightedTotal: raw.weightedTotal == null ? undefined : num(raw.weightedTotal),
    scores: asArray(raw.scores).map((item) => {
      const score = asRecord(item);
      return {
        criterionId: str(score.criterionId),
        criterionName: str(score.criterionName ?? score.criterionNameSnapshot),
        weightPercentage: num(score.weightPercentage ?? score.weightPercentSnapshot),
        score: num(score.score),
        weightedContribution: num(score.weightedContribution),
      };
    }),
    submittedAt: optStr(iso(raw.submittedAt, "")),
    version: num(raw.version, 1),
  };
}

export function mapMyEvaluationContext(payload: unknown) {
  const raw = asRecord(payload);
  const session = asRecord(raw.interviewSession);
  const application = asRecord(session.jobApplication);
  const opening = asRecord(application.jobOpening);
  const criteria = asArray(opening.criteria).map((item, index) => {
    const criterion = asRecord(item);
    return {
      id: str(criterion.id, `criterion-${index}`),
      name: str(criterion.name),
      description: optStr(criterion.description),
      weightPercentage: num(criterion.weightPercentage ?? criterion.weightPercent),
      displayOrder: num(criterion.displayOrder, index + 1),
      isRequired: Boolean(criterion.isRequired ?? true),
      isActive: Boolean(criterion.isActive ?? true),
    };
  });

  return {
    evaluation: mapEvaluation(raw, str(session.id)),
    criteria,
  };
}

export function mapInterviewSession(payload: unknown): InterviewSession {
  const raw = asRecord(payload);
  const application = asRecord(raw.jobApplication);
  const candidate = asRecord(application.candidate ?? raw.candidate);
  const opening = asRecord(application.jobOpening ?? raw.jobOpening);
  const branch = asRecord(opening.branch ?? raw.branch);
  const panelMembers = asArray(raw.panelMembers);
  const evaluationsFromPanel = panelMembers.flatMap((member) => {
    const panel = asRecord(member);
    const evaluation = panel.evaluation;
    if (!evaluation) return [];
    const employee = asRecord(panel.employee);
    return [
      mapEvaluation(
        {
          ...asRecord(evaluation),
          panelMemberEmployeeId: panel.employeeId ?? employee.id,
          panelMemberName: personName(employee.firstName, employee.lastName),
        },
        str(raw.id)
      ),
    ];
  });

  return {
    id: str(raw.id),
    jobApplicationId: str(raw.jobApplicationId ?? application.id),
    jobOpeningId: str(raw.jobOpeningId ?? opening.id),
    applicationNumber: str(raw.applicationNumber ?? application.applicationCode),
    candidateName: optStr(raw.candidateName) || personName(candidate.firstName, candidate.lastName),
    candidateEmail: str(raw.candidateEmail ?? candidate.email),
    openingCode: str(raw.openingCode ?? opening.openingCode),
    openingTitle: str(raw.openingTitle ?? opening.title),
    branchId: str(raw.branchId ?? opening.branchId ?? branch.id),
    branchName: nestedName(branch, "branchName") ?? optStr(raw.branchName),
    roundNumber: num(raw.roundNumber, 1),
    roundName: str(raw.roundName),
    isRequired: Boolean(raw.isRequired ?? true),
    scheduledStartAt: iso(raw.scheduledStartAt),
    scheduledEndAt: iso(raw.scheduledEndAt),
    timezone: str(raw.timezone, "UTC"),
    mode: str(raw.mode, "VIDEO") as InterviewSession["mode"],
    locationOrLink: optStr(raw.locationOrLink),
    evaluationDeadline: iso(raw.evaluationDeadline ?? raw.evaluationDeadlineAt),
    status: str(raw.status, "SCHEDULED") as InterviewSession["status"],
    cancellationReason: optStr(raw.cancellationReason),
    rescheduleReason: optStr(raw.rescheduleReason),
    panelMembers: panelMembers.map((item) => {
      const member = asRecord(item);
      const employee = asRecord(member.employee);
      return {
        employeeId: str(member.employeeId ?? employee.id),
        employeeName:
          personName(employee.firstName, employee.lastName) ||
          str(member.employeeName, "Panel member"),
        userId: optStr(member.userId),
        isLeadInterviewer: Boolean(member.isLeadInterviewer ?? member.isLead),
      };
    }),
    evaluations:
      evaluationsFromPanel.length > 0
        ? evaluationsFromPanel
        : asArray(raw.evaluations).map((item) => mapEvaluation(item, str(raw.id))),
    version: num(raw.version, 1),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

function offerAllowedActions(status: string, actions?: unknown): JobOffer["allowedActions"] {
  if (isRecord(actions) && "canEdit" in actions) {
    return {
      canEdit: Boolean(actions.canEdit),
      canPreview: Boolean(actions.canPreview),
      canSend: Boolean(actions.canSend),
      canRetryDelivery: Boolean(actions.canRetryDelivery),
      canRevoke: Boolean(actions.canRevoke),
      canRevise: Boolean(actions.canRevise),
    };
  }

  return {
    canEdit: status === JOB_OFFER_STATUS.DRAFT,
    canPreview: status === JOB_OFFER_STATUS.DRAFT || status === JOB_OFFER_STATUS.SENT,
    canSend: status === JOB_OFFER_STATUS.DRAFT,
    canRetryDelivery: false,
    canRevoke: status === JOB_OFFER_STATUS.SENT,
    canRevise: status === JOB_OFFER_STATUS.DRAFT || status === JOB_OFFER_STATUS.SENT,
  };
}

export function mapJobOffer(payload: unknown): JobOffer {
  const raw = unwrapRecruitmentRecord(payload);
  const application = asRecord(raw.jobApplication);
  const candidate = asRecord(application.candidate);
  const opening = asRecord(application.jobOpening ?? raw.jobOpening);
  const company = asRecord(opening.company ?? raw.company);
  const branch = asRecord(opening.branch ?? raw.branch);
  const department = asRecord(opening.department ?? raw.department);
  const designation = asRecord(opening.designation ?? raw.designation);
  const manager = asRecord(raw.reportingManager);
  const status = str(raw.status, "DRAFT") as JobOfferStatus;
  const compensation = asRecord(raw.compensation);
  const delivery = asRecord(raw.delivery);

  return {
    id: str(raw.id),
    jobApplicationId: str(raw.jobApplicationId ?? application.id),
    applicationNumber: str(raw.applicationNumber ?? application.applicationCode),
    candidateName: optStr(raw.candidateName) || personName(candidate.firstName, candidate.lastName),
    candidateEmail: str(raw.candidateEmail ?? candidate.email),
    jobOpeningId: str(raw.jobOpeningId ?? opening.id ?? application.jobOpeningId),
    openingCode: str(raw.openingCode ?? opening.openingCode),
    openingTitle: str(raw.openingTitle ?? opening.title),
    versionNumber: num(raw.versionNumber ?? raw.versionNo, 1),
    status,
    version: num(raw.version, 1),
    roleTitle: str(raw.roleTitle ?? designation.designationName ?? opening.title),
    organization: {
      companyId: str(raw.companyId ?? opening.companyId ?? company.id),
      companyName: nestedName(company, "companyName"),
      branchId: str(raw.branchId ?? opening.branchId ?? branch.id),
      branchName: nestedName(branch, "branchName"),
      departmentId: str(raw.departmentId ?? opening.departmentId ?? department.id),
      departmentName: nestedName(department, "departmentName"),
      designationId: str(raw.designationId ?? opening.designationId ?? designation.id),
      designationName: nestedName(designation, "designationName"),
    },
    reportingManagerEmployeeId: str(raw.reportingManagerEmployeeId ?? manager.id),
    reportingManagerName:
      personName(manager.firstName, manager.lastName) || optStr(raw.reportingManagerName),
    employmentType: str(raw.employmentType, "FULL_TIME"),
    joiningDate: iso(raw.joiningDate).slice(0, 10),
    compensation: {
      amount: num(compensation.amount ?? raw.compensationAmount),
      currency: str(compensation.currency ?? raw.compensationCurrency),
      period: str(
        compensation.period ?? raw.compensationPeriod,
        "MONTHLY"
      ) as JobOffer["compensation"]["period"],
    },
    probationDays: num(raw.probationDays, 90),
    expiryDate: iso(raw.expiryDate).slice(0, 10),
    terms: optStr(raw.terms ?? raw.termsText),
    delivery: {
      status: normalizeOfferDeliveryStatus(optStr(delivery.status), optStr(iso(raw.sentAt, ""))),
      lastAttemptAt: optStr(iso(delivery.lastAttemptAt ?? raw.sentAt, "")),
      failureReason: optStr(delivery.failureReason),
      retryAvailable: Boolean(delivery.retryAvailable),
    },
    candidateResponseUrl: optStr(raw.candidateResponseUrl),
    sentAt: optStr(iso(raw.sentAt, "")),
    revokedAt: optStr(iso(raw.revokedAt, "")),
    responseAt: optStr(iso(raw.responseAt ?? raw.respondedAt, "")),
    allowedActions: {
      ...offerAllowedActions(status, raw.allowedActions),
      canRetryDelivery:
        Boolean(delivery.retryAvailable) ||
        offerAllowedActions(status, raw.allowedActions).canRetryDelivery,
    },
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function toOfferWritePayload(dto: {
  roleTitle?: string;
  reportingManagerEmployeeId: string;
  employmentType: string;
  joiningDate: string;
  compensationAmount: number;
  compensationCurrency: string;
  compensationPeriod: string;
  probationDays: number;
  expiryDate: string;
  terms?: string;
  version?: number;
}) {
  return {
    reportingManagerEmployeeId: dto.reportingManagerEmployeeId,
    employmentType: dto.employmentType,
    joiningDate: dto.joiningDate,
    compensationAmount: dto.compensationAmount,
    compensationCurrency: dto.compensationCurrency,
    compensationPeriod: dto.compensationPeriod,
    probationDays: dto.probationDays,
    expiryDate: dto.expiryDate,
    termsText: dto.terms,
    version: dto.version,
  };
}

export function combineDateTime(date: string, time: string, durationMinutes: number) {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    scheduledStartAt: start.toISOString(),
    scheduledEndAt: end.toISOString(),
  };
}

export function mapHiringQueue(payload: unknown): HiringDecisionQueueItem[] {
  const applications = unwrapPagedItems(payload).map(mapJobApplication);
  const grouped = new Map<string, HiringDecisionQueueItem>();

  for (const application of applications) {
    const existing = grouped.get(application.jobOpeningId);
    if (existing) {
      existing.pendingDecisionCount += 1;
      existing.inPipelineCount += 1;
      continue;
    }

    grouped.set(application.jobOpeningId, {
      jobOpeningId: application.jobOpeningId,
      openingCode: application.openingCode,
      openingTitle: application.openingTitle,
      branchName: application.branchName,
      headcountRemaining: 0,
      pendingDecisionCount: 1,
      inPipelineCount: 1,
    });
  }

  for (const item of asArray(payload)) {
    const raw = asRecord(item);
    const opening = asRecord(raw.jobOpening);
    const openingId = str(raw.jobOpeningId ?? opening.id);
    const groupedItem = grouped.get(openingId);
    if (!groupedItem) continue;
    const remaining =
      num(opening.headcountTotal) - num(opening.headcountFilled) - num(opening.headcountReserved);
    if (remaining > 0) groupedItem.headcountRemaining = remaining;
    groupedItem.branchName =
      groupedItem.branchName ?? nestedName(asRecord(opening.branch), "branchName");
  }

  return [...grouped.values()];
}

export function mapHiringComparison(payload: unknown): HiringComparisonView {
  const raw = asRecord(payload);
  const opening = asRecord(raw.opening);
  const remaining =
    num(opening.headcountTotal) - num(opening.headcountFilled) - num(opening.headcountReserved);

  const candidates: HiringComparisonCandidate[] = asArray(raw.candidates).map((item) => {
    const candidate = asRecord(item);
    const person = asRecord(candidate.candidate);
    const status = str(
      candidate.applicationStatus ?? candidate.status,
      "MANAGER_REVIEW"
    ) as JobApplicationStatus;
    const interviews = asArray(candidate.interviews);
    const summaries = interviews.flatMap((interview) => {
      const session = asRecord(interview);
      return asArray(session.evaluations).map((evaluation) => {
        const row = asRecord(evaluation);
        return {
          roundName: str(session.roundName),
          roundNumber: num(session.roundNumber, 1),
          panelMemberName: str(row.panelMemberName, "Panel"),
          recommendation: optStr(row.recommendation),
          weightedTotal: row.weightedTotal == null ? undefined : num(row.weightedTotal),
          strengths: optStr(row.strengths),
          concerns: optStr(row.concerns),
        };
      });
    });
    const required = interviews.filter((interview) => {
      const session = asRecord(interview);
      return session.isRequired !== false && session.status !== "CANCELLED";
    });
    const completed = required.filter((interview) => asRecord(interview).status === "COMPLETED");
    const expected = required.length;
    const submitted = summaries.length;
    const ready = expected > 0 && completed.length === expected && submitted >= expected;

    return {
      applicationId: str(candidate.applicationId ?? candidate.id),
      applicationNumber: str(candidate.applicationNumber ?? candidate.applicationCode),
      candidateId: str(candidate.candidateId ?? person.id),
      candidateName:
        optStr(candidate.candidateName) || personName(person.firstName, person.lastName),
      candidateEmail: str(candidate.candidateEmail ?? person.email),
      applicationStatus: status,
      submittedAt: iso(candidate.submittedAt),
      readiness: {
        status: ready ? "READY_FOR_DECISION" : "EVALUATIONS_PENDING",
        message: ready
          ? "Interviews and evaluations are complete."
          : "Waiting for required interviews or evaluations.",
        requiredRoundsTotal: expected,
        requiredRoundsCompleted: completed.length,
        submittedEvaluationsCount: submitted,
        expectedEvaluationsCount: expected,
      },
      aggregateScore:
        summaries.length > 0
          ? summaries.reduce((sum, summary) => sum + (summary.weightedTotal ?? 0), 0) /
            summaries.length
          : undefined,
      evaluationSummaries: summaries,
      allowedActions: {
        canSelect: hasAction(candidate.allowedActions, "select"),
        canReject: hasAction(candidate.allowedActions, "reject"),
      },
      decisionBlockReason: optStr(candidate.decisionBlockReason),
      version: num(candidate.version, 1),
    };
  });

  return {
    jobOpeningId: str(raw.jobOpeningId ?? opening.id),
    openingCode: str(raw.openingCode ?? opening.openingCode),
    openingTitle: str(raw.openingTitle ?? opening.title),
    branchName: nestedName(asRecord(opening.branch), "branchName"),
    headcountRemaining: num(raw.headcountRemaining, Math.max(remaining, 0)),
    decisionOwnerName: optStr(
      raw.decisionOwnerName ?? opening.hiringManagerName,
    ),
    decisionOwnerEmployeeId: optStr(
      raw.decisionOwnerEmployeeId ?? opening.hiringManagerEmployeeId,
    ),
    candidates,
  };
}

export function mapConversionPreflight(
  applicationId: string,
  payload: unknown
): ConversionPreflight {
  const raw = asRecord(payload);
  const checks = asArray(raw.checks).map((item) => {
    const check = asRecord(item);
    const passed = Boolean(check.passed ?? check.status === "PASSED");
    const code = str(check.code);
    const status =
      (optStr(check.status) as "PASSED" | "BLOCKED" | "WARNING") ??
      (passed
        ? "PASSED"
        : code === "ALREADY_CONVERTED" || code === "NOT_ALREADY_CONVERTED"
          ? "WARNING"
          : "BLOCKED");
    return {
      code,
      label: str(check.label, code.replaceAll("_", " ")),
      status,
      message: str(check.message, passed ? "Passed" : "Blocked"),
    };
  });

  const invitationDelivery = asRecord(raw.invitationDelivery);
  const invitationDeliveryStatus = mapInvitationDeliveryStatus(
    invitationDelivery.status ?? raw.invitationDeliveryStatus,
    Boolean(raw.idempotent),
  );

  return {
    applicationId,
    candidateName: str(raw.candidateName, "Candidate"),
    roleTitle: str(raw.roleTitle, "Role"),
    organizationSummary: str(raw.organizationSummary, "—"),
    joiningDate: iso(raw.joiningDate).slice(0, 10),
    onboardingTemplateName: str(raw.onboardingTemplateName, "Resolved by server"),
    reportingManagerName: optStr(raw.reportingManagerName),
    canConvert: Boolean(raw.canConvert ?? (raw.ready && !raw.idempotent)),
    existingEmployeeId: optStr(raw.existingEmployeeId ?? raw.employeeId),
    existingUserId: optStr(raw.existingUserId ?? raw.userId),
    existingEmployeeOnboardingId: optStr(
      raw.existingEmployeeOnboardingId ?? raw.employeeOnboardingId,
    ),
    invitationDeliveryStatus,
    checks,
    applicationVersion: num(raw.applicationVersion, 1),
    acceptedOfferId: str(raw.acceptedOfferId),
    acceptedOfferVersion: num(raw.acceptedOfferVersion, 1),
  };
}

function mapInvitationDeliveryStatus(
  rawStatus: unknown,
  idempotentFallbackDelivered: boolean,
): ConversionResult["invitationDeliveryStatus"] | undefined {
  const status = typeof rawStatus === "string" ? rawStatus.toUpperCase() : "";
  if (
    status === "DELIVERED" ||
    status === "SENT" ||
    status === "ACCEPTED" ||
    status === "OUTBOX_READY"
  ) {
    return "DELIVERED";
  }
  if (
    status === "FAILED" ||
    status === "DEAD_LETTER" ||
    status === "OUTBOX_MISSING" ||
    status === "MISSING_INVITATION"
  ) {
    return "FAILED";
  }
  if (status === "PENDING" || status === "QUEUED" || status === "PROCESSING") {
    return "PENDING";
  }
  if (idempotentFallbackDelivered && !status) return undefined;
  return status ? "PENDING" : undefined;
}

export function mapConversionResult(applicationId: string, payload: unknown): ConversionResult {
  const raw = asRecord(payload);
  const invitationDelivery = asRecord(raw.invitationDelivery);
  const invitationDeliveryStatus =
    mapInvitationDeliveryStatus(
      invitationDelivery.status ??
        invitationDelivery.deliveryStatus ??
        raw.invitationDeliveryStatus,
      false,
    ) ?? (raw.idempotent ? "DELIVERED" : "PENDING");

  return {
    employeeId: str(raw.employeeId),
    employeeCode: str(raw.employeeCode, "—"),
    applicationId,
    userId: optStr(raw.userId),
    employeeOnboardingId: optStr(raw.employeeOnboardingId),
    invitationId: optStr(raw.invitationId),
    invitationDeliveryStatus,
    isExistingConversion: Boolean(raw.idempotent ?? raw.isExistingConversion),
    operationId: optStr(raw.operationId),
  };
}

export function mapReadyToHireItem(payload: unknown): ReadyToHireQueueItem {
  const application = mapJobApplication(payload);
  return {
    applicationId: application.id,
    applicationNumber: application.applicationNumber,
    candidateName: `${application.candidateFirstName} ${application.candidateLastName}`.trim(),
    openingTitle: application.openingTitle,
    branchName: application.branchName,
    acceptedAt: application.updatedAt,
    canConvert: true,
    existingEmployeeId: undefined,
  };
}

export function mapPublicCompany(payload: unknown): PublicCompanyProfile {
  const raw = asRecord(payload);
  const company = asRecord(raw.company);
  return {
    companyCode: str(company.companyCode ?? raw.companyCode),
    companyName: str(company.companyName ?? raw.companyName),
  };
}

export function mapPublicOpenings(payload: unknown): PublicJobOpeningListItem[] {
  const raw = asRecord(payload);
  return asArray(raw.openings ?? payload).map((item) => {
    const opening = asRecord(item);
    const deadline = optStr(iso(opening.applicationDeadline, ""));
    const expired = Boolean(deadline && new Date(deadline).getTime() < Date.now());
    return {
      openingCode: str(opening.openingCode),
      title: str(opening.title),
      branchLocation: optStr(
        opening.location ?? nestedName(asRecord(opening.department), "departmentName")
      ),
      employmentType: str(opening.employmentType, "FULL_TIME"),
      applicationDeadline: deadline ?? "",
      isExpired: expired,
    };
  });
}

export function mapPublicOpeningDetail(payload: unknown): PublicJobOpeningDetail {
  const raw = asRecord(payload);
  const company = asRecord(raw.company);
  const opening = asRecord(raw.opening);
  const deadline = optStr(iso(opening.applicationDeadline, ""));
  const expired = Boolean(deadline && new Date(deadline).getTime() < Date.now());
  const status = optStr(opening.status)?.toUpperCase();
  const closed = Boolean(status && status !== "OPEN");
  const canApply = !expired && !closed;

  return {
    openingCode: str(opening.openingCode),
    title: str(opening.title),
    branchLocation: optStr(opening.location),
    employmentType: str(opening.employmentType, "FULL_TIME"),
    applicationDeadline: deadline ?? "",
    isExpired: expired,
    companyName: str(company.companyName),
    description: optStr(opening.description),
    location: optStr(opening.location),
    canApply,
    closingMessage: closed
      ? "This opening is no longer accepting applications."
      : expired
        ? "The application deadline for this opening has passed."
        : undefined,
  };
}

function mapOfferInspectState(value: string): OfferResponseState {
  switch (value) {
    case "VALID":
    case "INVALID":
    case "EXPIRED":
    case "REVOKED":
    case "SUPERSEDED":
    case "ALREADY_ACCEPTED":
    case "ALREADY_DECLINED":
      return value;
    case "ACCEPTED":
      return "ALREADY_ACCEPTED";
    case "DECLINED":
      return "ALREADY_DECLINED";
    default:
      return "INVALID";
  }
}

export function mapOfferInspection(payload: unknown): OfferResponseInspection {
  const raw = asRecord(payload);
  const state = mapOfferInspectState(str(raw.state ?? raw.status, "INVALID"));
  const valid = state === "VALID";
  const compensation = asRecord(raw.compensation);
  const downloadToken = optStr(raw.downloadToken);

  return {
    state,
    message: str(
      raw.message,
      valid ? "Review this offer and respond." : "This offer link is invalid or expired."
    ),
    canRespond: Boolean(raw.canRespond ?? valid),
    canDownloadPdf: Boolean(raw.canDownloadPdf ?? downloadToken),
    downloadToken,
    responseVersion: num(
      raw.responseVersion ?? raw.offerVersion ?? raw.version,
      1,
    ),
    offer: valid
      ? {
          roleTitle: str(raw.roleTitle ?? raw.designationName, "Offer"),
          companyName: optStr(raw.companyName),
          designationName: optStr(raw.designationName),
          employmentType: str(raw.employmentType, "FULL_TIME"),
          joiningDate: iso(raw.joiningDate).slice(0, 10),
          compensation: {
            amount: num(compensation.amount ?? raw.compensationAmount),
            currency: str(compensation.currency ?? raw.compensationCurrency),
            period: str(
              compensation.period ?? raw.compensationPeriod,
              "MONTHLY"
            ) as JobOffer["compensation"]["period"],
          },
          probationDays: num(raw.probationDays, 90),
          expiryDate: iso(raw.expiryDate).slice(0, 10),
          terms: optStr(raw.terms ?? raw.termsText),
          versionNumber: num(raw.versionNumber ?? raw.versionNo, 1),
        }
      : undefined,
  };
}

export function mapOfferResponseResult(payload: unknown): OfferResponseResult {
  const raw = asRecord(payload);
  const status = str(raw.status ?? raw.state, "ACCEPTED");
  return {
    state: status === "DECLINED" ? "DECLINED" : "ACCEPTED",
    message: str(
      raw.message,
      status === "DECLINED"
        ? "Response recorded."
        : "Offer accepted - HR verification pending",
    ),
    respondedAt: iso(raw.respondedAt),
    verificationPending:
      str(raw.status ?? raw.state, "ACCEPTED") !== "DECLINED",
  };
}

export function mapCareerTimeline(employeeId: string, view: "HR" | "SANITIZED", payload: unknown) {
  const raw = asRecord(payload);
  return {
    employeeId: str(raw.employeeId, employeeId),
    view,
    events: asArray(raw.events).map((item) => {
      const event = asRecord(item);
      return {
        id: str(event.id),
        eventType: str(event.eventType) as never,
        occurredAt: iso(event.occurredAt ?? event.eventAt),
        summary: str(event.summary ?? event.employeeVisibleSummary),
        hrDetail:
          view === "SANITIZED" ? undefined : optStr(event.hrDetail ?? event.hrDetailReference),
        sourceModule: optStr(event.sourceModule),
        sourceRecordId: optStr(event.sourceRecordId),
        actorName: view === "SANITIZED" ? undefined : optStr(event.actorName),
      };
    }),
  };
}

export function mapProbationQueue(payload: unknown) {
  const raw = asRecord(payload);
  const employees = asArray(raw.employees ?? payload);
  const asOf = raw.asOf ? new Date(str(raw.asOf)) : new Date();

  return employees.map((item) => {
    const employee = asRecord(item);
    const plannedEnd = iso(employee.plannedEndDate ?? employee.probationPlannedEndDate);
    const planned = new Date(plannedEnd);
    const daysRemaining = Number.isNaN(planned.getTime())
      ? 0
      : Math.ceil((planned.getTime() - asOf.getTime()) / 86_400_000);

    return {
      employeeId: str(employee.employeeId ?? employee.id),
      employeeCode: str(employee.employeeCode),
      employeeName:
        optStr(employee.employeeName) || personName(employee.firstName, employee.lastName),
      designationName: nestedName(asRecord(employee.designation), "designationName"),
      departmentName: nestedName(asRecord(employee.department), "departmentName"),
      branchName: nestedName(asRecord(employee.branch), "branchName"),
      probationStartDate: iso(employee.probationStartDate).slice(0, 10),
      plannedEndDate: plannedEnd.slice(0, 10),
      daysRemaining,
      canConfirmActive:
        employee.canConfirmActive === undefined
          ? daysRemaining <= 0
          : Boolean(employee.canConfirmActive),
      allowEarlyOverride: Boolean(employee.allowEarlyOverride),
      confirmBlockedReason: optStr(employee.confirmBlockedReason),
      version: num(employee.version, 1),
    };
  });
}
