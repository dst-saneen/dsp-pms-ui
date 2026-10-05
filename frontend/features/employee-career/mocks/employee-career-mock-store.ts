import type { Employee } from "@/features/employee/types/employee";
import { RecruitmentPipelineMockStore } from "@/features/recruitment/applications/mocks/recruitment-pipeline-mock-store";
import { OfferMockStore } from "@/features/recruitment/offers/mocks/offer-mock-store";
import { ReadyToHireMockStore } from "@/features/recruitment/ready-to-hire/mocks/ready-to-hire-mock-store";
import {
  JOB_APPLICATION_STATUS,
  RECRUITMENT_EMPLOYEE_STATUS,
} from "@/features/recruitment/types/enums";

import { CAREER_EVENT_TYPE } from "../types/career-timeline";
import type {
  CareerTimelineEvent,
  CareerTimelineView,
  EmployeeCareerTimeline,
} from "../types/career-timeline";
import { sanitizeCareerTimeline } from "../utils/sanitize-career-timeline";
import type {
  ConfirmActiveDto,
  ConfirmActiveResult,
  ProbationConfirmationPreflight,
  ProbationDueQueueItem,
} from "../types/probation";

const STORAGE_KEY = "employee-career-mock-v1";

interface EmployeeLifecycleRecord {
  employeeId: string;
  applicationId?: string;
  offerId?: string;
  probationStartDate?: string;
  plannedProbationEndDate?: string;
  actualConfirmationDate?: string;
  confirmationNote?: string;
  version: number;
  extraEvents: CareerTimelineEvent[];
}

interface CareerStore {
  lifecycles: Record<string, EmployeeLifecycleRecord>;
}

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function loadStore(): CareerStore {
  if (typeof window === "undefined") return { lifecycles: {} };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lifecycles: {} };
    const parsed = JSON.parse(raw) as CareerStore;
    return { lifecycles: parsed.lifecycles ?? {} };
  } catch {
    return { lifecycles: {} };
  }
}

function saveStore(store: CareerStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getLifecycle(employeeId: string): EmployeeLifecycleRecord | null {
  return loadStore().lifecycles[employeeId] ?? null;
}

function ensureLifecycle(employeeId: string): EmployeeLifecycleRecord {
  const store = loadStore();
  if (!store.lifecycles[employeeId]) {
    store.lifecycles[employeeId] = {
      employeeId,
      version: 1,
      extraEvents: [],
    };
    saveStore(store);
  }
  return loadStore().lifecycles[employeeId];
}

function findConversionForEmployee(employeeId: string) {
  for (const application of RecruitmentPipelineMockStore.listApplications()) {
    const conversion = ReadyToHireMockStore.getConversionByApplication(application.id);
    if (conversion?.employeeId === employeeId) {
      return { application, conversion };
    }
  }
  return null;
}

function syncLifecycleFromConversion(employeeId: string) {
  const lifecycle = getLifecycle(employeeId);
  if (lifecycle?.probationStartDate) return;

  const linked = findConversionForEmployee(employeeId);
  if (!linked?.conversion) return;

  seedFromConversion(
    employeeId,
    linked.conversion.applicationId,
    linked.conversion.offerId,
    linked.conversion.convertedAt,
    false,
  );
}

function buildRecruitmentEvents(
  employeeId: string,
  view: CareerTimelineView,
): CareerTimelineEvent[] {
  const linked = findConversionForEmployee(employeeId);
  if (!linked?.application) return [];

  const { application, conversion } = linked;
  const events: CareerTimelineEvent[] = [];

  for (const entry of application.timeline) {
    if (entry.toStatus === JOB_APPLICATION_STATUS.APPLIED) {
      events.push({
        id: entry.id,
        eventType: CAREER_EVENT_TYPE.APPLICATION_SUBMITTED,
        occurredAt: entry.occurredAt,
        summary: "Application submitted for review.",
        hrDetail:
          view === "HR"
            ? `${entry.summary}${entry.comment ? ` — ${entry.comment}` : ""}`
            : undefined,
        sourceModule: "RECRUITMENT",
        sourceRecordId: application.id,
        actorName: entry.actorName,
      });
    }

    if (entry.toStatus === JOB_APPLICATION_STATUS.SELECTED) {
      events.push({
        id: entry.id,
        eventType: CAREER_EVENT_TYPE.SELECTED,
        occurredAt: entry.occurredAt,
        summary: "Selected for offer preparation.",
        hrDetail: view === "HR" ? entry.comment : undefined,
        sourceModule: "RECRUITMENT",
        sourceRecordId: application.id,
        actorName: entry.actorName,
      });
    }

    if (entry.toStatus === JOB_APPLICATION_STATUS.OFFER_ACCEPTED) {
      events.push({
        id: entry.id,
        eventType: CAREER_EVENT_TYPE.OFFER_ACCEPTED,
        occurredAt: entry.occurredAt,
        summary: "Offer accepted.",
        sourceModule: "RECRUITMENT",
        sourceRecordId: application.id,
        actorName: entry.actorName,
      });
    }

    if (entry.toStatus === JOB_APPLICATION_STATUS.HIRED) {
      events.push({
        id: entry.id,
        eventType: CAREER_EVENT_TYPE.EMPLOYEE_CREATED,
        occurredAt: entry.occurredAt,
        summary: "Employee record created from recruitment.",
        hrDetail:
          view === "HR" && conversion
            ? `Employee code ${conversion.employeeCode}. Invitation delivery: ${conversion.invitationDeliveryStatus.toLowerCase()}.`
            : undefined,
        sourceModule: "RECRUITMENT",
        sourceRecordId: application.id,
        actorName: entry.actorName,
      });
    }
  }

  const interviewComplete = application.timeline.find(
    (entry) => entry.toStatus === JOB_APPLICATION_STATUS.MANAGER_REVIEW,
  );
  if (interviewComplete) {
    events.push({
      id: `interviews-${application.id}`,
      eventType: CAREER_EVENT_TYPE.INTERVIEWS_COMPLETED,
      occurredAt: interviewComplete.occurredAt,
      summary: "Interview process completed.",
      hrDetail:
        view === "HR"
          ? "Panel evaluations and recommendations are retained under confidential recruitment records."
          : undefined,
      sourceModule: "RECRUITMENT",
      sourceRecordId: application.id,
      actorName: interviewComplete.actorName,
    });
  }

  return events;
}

function buildTimeline(employeeId: string, view: CareerTimelineView): EmployeeCareerTimeline {
  syncLifecycleFromConversion(employeeId);
  const lifecycle = getLifecycle(employeeId);
  const recruitmentEvents = buildRecruitmentEvents(employeeId, view);
  const extraEvents = lifecycle?.extraEvents ?? [];

  const baseline =
    recruitmentEvents.length === 0 && extraEvents.length === 0
      ? [
          {
            id: `baseline-${employeeId}`,
            eventType: CAREER_EVENT_TYPE.EMPLOYEE_CREATED,
            occurredAt: nowIso(),
            summary: "Employee record established.",
            hrDetail:
              view === "HR"
                ? "Imported baseline milestone from migration backfill."
                : undefined,
            sourceModule: "EMPLOYEE",
            sourceRecordId: employeeId,
            actorName: "System",
          } satisfies CareerTimelineEvent,
        ]
      : [];

  const events = [...recruitmentEvents, ...extraEvents, ...baseline].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return {
    employeeId,
    view,
    events:
      view === "SANITIZED" ? sanitizeCareerTimeline(events) : events,
  };
}

function getRecruitmentEmployee(employeeId: string): Employee | null {
  return ReadyToHireMockStore.getEmployee(employeeId);
}

function updateRecruitmentEmployee(employeeId: string, patch: Partial<Employee>) {
  ReadyToHireMockStore.updateEmployee(employeeId, patch);
}

function daysRemaining(endDate: string) {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function buildProbationPreflight(employeeId: string): ProbationConfirmationPreflight {
  syncLifecycleFromConversion(employeeId);
  const employee = getRecruitmentEmployee(employeeId);
  if (!employee) throw new Error("NOT_FOUND");

  const lifecycle = ensureLifecycle(employeeId);
  const plannedEndDate = lifecycle.plannedProbationEndDate ?? "";
  const earliestConfirmationDate = plannedEndDate;
  const today = toDateOnly(new Date());
  const isProbation = employee.employmentStatus === RECRUITMENT_EMPLOYEE_STATUS.PROBATION;
  const endReached = plannedEndDate ? today >= plannedEndDate : false;

  let canConfirm = isProbation && endReached;
  let blockedReason: string | undefined;

  if (!isProbation) {
    canConfirm = false;
    blockedReason = "Employee must be in probation before confirmation to active.";
  } else if (!plannedEndDate) {
    canConfirm = false;
    blockedReason = "Probation dates are not configured yet.";
  } else if (!endReached) {
    canConfirm = false;
    blockedReason = `Confirmation is available on or after ${plannedEndDate}.`;
  }

  return {
    employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
    employeeCode: employee.employeeCode,
    plannedEndDate,
    earliestConfirmationDate,
    canConfirm,
    blockedReason,
    allowEarlyOverride: false,
    version: lifecycle.version,
  };
}

function seedFromConversion(
  employeeId: string,
  applicationId: string,
  offerId: string,
  convertedAt: string,
  mockProbationDue?: boolean,
) {
  const existing = getLifecycle(employeeId);
  if (existing?.probationStartDate) return;

  const offer = OfferMockStore.getById(offerId);
  const lifecycle = ensureLifecycle(employeeId);
  lifecycle.applicationId = applicationId;
  lifecycle.offerId = offerId;

  const start = new Date(convertedAt);
  const probationDays = offer?.probationDays ?? 90;
  const plannedEnd = mockProbationDue ? addDays(start, -1) : addDays(start, probationDays);

  lifecycle.probationStartDate = toDateOnly(start);
  lifecycle.plannedProbationEndDate = toDateOnly(plannedEnd);
  lifecycle.extraEvents = [
    ...lifecycle.extraEvents.filter(
      (event) =>
        event.eventType !== CAREER_EVENT_TYPE.ONBOARDING_STARTED &&
        event.eventType !== CAREER_EVENT_TYPE.ONBOARDING_COMPLETED &&
        event.eventType !== CAREER_EVENT_TYPE.PROBATION_STARTED,
    ),
    {
      id: createId(),
      eventType: CAREER_EVENT_TYPE.ONBOARDING_STARTED,
      occurredAt: convertedAt,
      summary: "Onboarding started.",
      sourceModule: "ONBOARDING",
      sourceRecordId: employeeId,
      actorName: "System",
    },
    {
      id: createId(),
      eventType: CAREER_EVENT_TYPE.ONBOARDING_COMPLETED,
      occurredAt: convertedAt,
      summary: "Required onboarding tasks completed.",
      sourceModule: "ONBOARDING",
      sourceRecordId: employeeId,
      actorName: "System",
    },
    {
      id: createId(),
      eventType: CAREER_EVENT_TYPE.PROBATION_STARTED,
      occurredAt: convertedAt,
      summary: "Probation period started.",
      hrDetail: `Planned end date: ${toDateOnly(plannedEnd)}.`,
      sourceModule: "EMPLOYEE",
      sourceRecordId: employeeId,
      actorName: "System",
    },
  ];

  const store = loadStore();
  store.lifecycles[employeeId] = lifecycle;
  saveStore(store);

  updateRecruitmentEmployee(employeeId, {
    employmentStatus: RECRUITMENT_EMPLOYEE_STATUS.PROBATION,
  });
}

export const EmployeeCareerMockStore = {
  getTimeline(employeeId: string, view: CareerTimelineView): EmployeeCareerTimeline {
    return buildTimeline(employeeId, view);
  },

  listProbationDue(): ProbationDueQueueItem[] {
    for (const employee of ReadyToHireMockStore.listRecruitmentEmployees()) {
      syncLifecycleFromConversion(employee.id);
    }

    const store = loadStore();
    const items: ProbationDueQueueItem[] = [];

    for (const lifecycle of Object.values(store.lifecycles)) {
      const employee = getRecruitmentEmployee(lifecycle.employeeId);
      if (!employee) continue;
      if (employee.employmentStatus !== RECRUITMENT_EMPLOYEE_STATUS.PROBATION) continue;
      if (!lifecycle.plannedProbationEndDate || !lifecycle.probationStartDate) continue;

      const preflight = buildProbationPreflight(lifecycle.employeeId);
      items.push({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        designationName: employee.designation?.designationName,
        departmentName: employee.department?.departmentName,
        branchName: employee.branch?.branchName,
        probationStartDate: lifecycle.probationStartDate,
        plannedEndDate: lifecycle.plannedProbationEndDate,
        daysRemaining: daysRemaining(lifecycle.plannedProbationEndDate),
        canConfirmActive: preflight.canConfirm,
        confirmBlockedReason: preflight.blockedReason,
        version: lifecycle.version,
      });
    }

    return items.sort(
      (a, b) =>
        new Date(a.plannedEndDate).getTime() - new Date(b.plannedEndDate).getTime(),
    );
  },

  getProbationPreflight(employeeId: string): ProbationConfirmationPreflight {
    return buildProbationPreflight(employeeId);
  },

  confirmActive(employeeId: string, dto: ConfirmActiveDto): ConfirmActiveResult {
    const preflight = buildProbationPreflight(employeeId);
    const lifecycle = ensureLifecycle(employeeId);

    if (lifecycle.version !== dto.version) throw new Error("STALE_STATE");
    if (!dto.note.trim()) throw new Error("REASON_REQUIRED");

    if (!preflight.canConfirm && !dto.earlyOverrideReason?.trim()) {
      throw new Error("CONFIRMATION_NOT_ALLOWED");
    }

    if (
      preflight.plannedEndDate &&
      dto.confirmationDate < preflight.plannedEndDate &&
      !dto.earlyOverrideReason?.trim()
    ) {
      throw new Error("CONFIRMATION_NOT_ALLOWED");
    }

    lifecycle.actualConfirmationDate = dto.confirmationDate;
    lifecycle.confirmationNote = dto.note.trim();
    lifecycle.version += 1;
    lifecycle.extraEvents.push({
      id: createId(),
      eventType: CAREER_EVENT_TYPE.PROBATION_CONFIRMED,
      occurredAt: new Date(`${dto.confirmationDate}T12:00:00`).toISOString(),
      summary: "Probation confirmed — employee is now active.",
      hrDetail: dto.reference ? `Reference: ${dto.reference}` : dto.note.trim(),
      sourceModule: "EMPLOYEE",
      sourceRecordId: employeeId,
      actorName: "HR User",
    });

    const store = loadStore();
    store.lifecycles[employeeId] = lifecycle;
    saveStore(store);

    updateRecruitmentEmployee(employeeId, {
      employmentStatus: RECRUITMENT_EMPLOYEE_STATUS.ACTIVE,
    });

    return {
      employeeId,
      employmentStatus: RECRUITMENT_EMPLOYEE_STATUS.ACTIVE,
      actualConfirmationDate: dto.confirmationDate,
    };
  },

  seedFromConversion,
};
