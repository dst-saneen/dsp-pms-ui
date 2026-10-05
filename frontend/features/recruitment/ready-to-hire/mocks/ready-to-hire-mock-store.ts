import type { Employee } from "@/features/employee/types/employee";

import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import { OfferMockStore } from "../../offers/mocks/offer-mock-store";
import {
  JOB_APPLICATION_STATUS,
  JOB_OFFER_STATUS,
  RECRUITMENT_EMPLOYEE_STATUS,
} from "../../types/enums";
import type {
  ConversionPreflight,
  ConversionResult,
  ConvertCandidateDto,
  PreflightCheckItem,
  ReadyToHireQueueItem,
} from "../types/conversion-preflight";
import { PREFLIGHT_CHECK_CODES } from "../types/conversion-preflight";

const STORAGE_KEY = "recruitment-conversions-mock-v1";

interface ConversionRecord {
  applicationId: string;
  candidateId: string;
  employeeId: string;
  employeeCode: string;
  userId?: string;
  employeeOnboardingId?: string;
  offerId: string;
  invitationDeliveryStatus: ConversionResult["invitationDeliveryStatus"];
  operationId?: string;
  convertedAt: string;
}

interface ConversionStore {
  records: ConversionRecord[];
  employees: Record<string, Employee>;
  employeeSequence: number;
}

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function loadStore(): ConversionStore {
  if (typeof window === "undefined") {
    return { records: [], employees: {}, employeeSequence: 0 };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], employees: {}, employeeSequence: 0 };
    const parsed = JSON.parse(raw) as ConversionStore;
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      employees: parsed.employees ?? {},
      employeeSequence: parsed.employeeSequence ?? 0,
    };
  } catch {
    return { records: [], employees: {}, employeeSequence: 0 };
  }
}

function saveStore(store: ConversionStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function check(
  code: PreflightCheckItem["code"],
  label: string,
  status: PreflightCheckItem["status"],
  message: string
): PreflightCheckItem {
  return { code, label, status, message };
}

function buildOrganizationSummary(
  offer: NonNullable<ReturnType<typeof OfferMockStore.getAcceptedOffer>>
) {
  const parts = [
    offer.organization.companyName,
    offer.organization.branchName,
    offer.organization.departmentName,
    offer.organization.designationName,
  ].filter(Boolean);
  return parts.join(" · ");
}

function getExistingConversion(applicationId: string) {
  return loadStore().records.find((record) => record.applicationId === applicationId) ?? null;
}

function buildPreflight(applicationId: string): ConversionPreflight {
  const application = RecruitmentPipelineMockStore.getApplication(applicationId);
  if (!application) throw new Error("NOT_FOUND");

  const acceptedOffer = OfferMockStore.getAcceptedOffer(applicationId);
  const existing = getExistingConversion(applicationId);
  const opening = JobOpeningMockStore.getById(application.jobOpeningId);
  const checks: PreflightCheckItem[] = [];

  const offerAccepted =
    application.status === JOB_APPLICATION_STATUS.OFFER_ACCEPTED ||
    application.status === JOB_APPLICATION_STATUS.HIRED;
  const offerAcceptedCheck = check(
    PREFLIGHT_CHECK_CODES.OFFER_ACCEPTED,
    "Offer accepted",
    offerAccepted && acceptedOffer ? "PASSED" : "BLOCKED",
    offerAccepted && acceptedOffer
      ? `Accepted offer v${acceptedOffer.versionNumber} is on file.`
      : "The candidate must accept the current offer before conversion."
  );
  checks.push(offerAcceptedCheck);

  const positionReserved = Boolean(opening && opening.headcount.reserved > 0);
  checks.push(
    check(
      PREFLIGHT_CHECK_CODES.POSITION_RESERVED,
      "Position reserved",
      positionReserved || application.status === JOB_APPLICATION_STATUS.HIRED
        ? "PASSED"
        : "BLOCKED",
      positionReserved || application.status === JOB_APPLICATION_STATUS.HIRED
        ? "A headcount slot is reserved for this hire."
        : "No reserved headcount is available for this opening."
    )
  );

  if (existing) {
    checks.push(
      check(
        PREFLIGHT_CHECK_CODES.NOT_ALREADY_CONVERTED,
        "Not already converted",
        "WARNING",
        "This application was already converted. Open the existing employee record."
      )
    );
  } else {
    checks.push(
      check(
        PREFLIGHT_CHECK_CODES.NOT_ALREADY_CONVERTED,
        "Not already converted",
        application.status === JOB_APPLICATION_STATUS.HIRED ? "WARNING" : "PASSED",
        application.status === JOB_APPLICATION_STATUS.HIRED
          ? "Application is marked hired but no conversion record was found."
          : "No employee record exists for this application yet."
      )
    );
  }

  const hasEmail = Boolean(application.candidateEmail?.trim());
  checks.push(
    check(
      PREFLIGHT_CHECK_CODES.CANDIDATE_EMAIL_AVAILABLE,
      "Candidate email available",
      hasEmail ? "PASSED" : "BLOCKED",
      hasEmail
        ? "Email can be used for the user invitation."
        : "A valid candidate email is required for invitation delivery."
    )
  );

  const orgActive = Boolean(
    acceptedOffer?.organization.companyId &&
    acceptedOffer.organization.branchId &&
    acceptedOffer.organization.departmentId &&
    acceptedOffer.organization.designationId
  );
  checks.push(
    check(
      PREFLIGHT_CHECK_CODES.ORGANIZATION_ACTIVE,
      "Organization hierarchy active",
      orgActive ? "PASSED" : "BLOCKED",
      orgActive
        ? buildOrganizationSummary(acceptedOffer!)
        : "Company, branch, department, and designation must be active."
    )
  );

  const managerActive = Boolean(acceptedOffer?.reportingManagerEmployeeId);
  checks.push(
    check(
      PREFLIGHT_CHECK_CODES.MANAGER_ACTIVE,
      "Manager active",
      managerActive ? "PASSED" : "BLOCKED",
      managerActive
        ? `${acceptedOffer?.reportingManagerName ?? "Reporting manager"} is assigned.`
        : "An active reporting manager must be assigned on the accepted offer."
    )
  );

  const onboardingTemplateName = acceptedOffer
    ? `${acceptedOffer.organization.designationName ?? "Role"} onboarding template`
    : "Default onboarding template";
  checks.push(
    check(
      PREFLIGHT_CHECK_CODES.ONBOARDING_TEMPLATE_RESOLVED,
      "Onboarding template resolved",
      orgActive ? "PASSED" : "BLOCKED",
      orgActive
        ? `Published template: ${onboardingTemplateName}.`
        : "Resolve the onboarding template before converting."
    )
  );

  const store = loadStore();
  const emailConflict = Object.values(store.employees).some(
    (employee) =>
      employee.email?.toLowerCase() === application.candidateEmail.toLowerCase() &&
      employee.id !== existing?.employeeId
  );
  checks.push(
    check(
      PREFLIGHT_CHECK_CODES.IDENTITY_AVAILABLE,
      "User and employee creatable",
      emailConflict ? "BLOCKED" : "PASSED",
      emailConflict
        ? "An employee with this email already exists."
        : "No conflicting employee identity was detected."
    )
  );

  const blocked = checks.some((item) => item.status === "BLOCKED");
  const canConvert =
    !existing &&
    !blocked &&
    Boolean(acceptedOffer) &&
    application.status === JOB_APPLICATION_STATUS.OFFER_ACCEPTED;

  return {
    applicationId,
    candidateName: `${application.candidateFirstName} ${application.candidateLastName}`.trim(),
    roleTitle: acceptedOffer?.roleTitle ?? application.openingTitle,
    organizationSummary: acceptedOffer
      ? buildOrganizationSummary(acceptedOffer)
      : `${application.companyName ?? "Company"} · ${application.branchName ?? "Branch"}`,
    joiningDate: acceptedOffer?.joiningDate ?? "",
    onboardingTemplateName,
    reportingManagerName: acceptedOffer?.reportingManagerName,
    canConvert,
    existingEmployeeId: existing?.employeeId,
    existingUserId: existing?.userId,
    existingEmployeeOnboardingId: existing?.employeeOnboardingId,
    invitationDeliveryStatus: existing?.invitationDeliveryStatus,
    checks,
    applicationVersion: application.version,
    acceptedOfferId: acceptedOffer?.id ?? "",
    acceptedOfferVersion: acceptedOffer?.version ?? 0,
  };
}

function buildEmployeeFromOffer(
  offer: NonNullable<ReturnType<typeof OfferMockStore.getAcceptedOffer>>,
  application: NonNullable<ReturnType<typeof RecruitmentPipelineMockStore.getApplication>>,
  employeeCode: string
): Employee {
  const [firstName, ...rest] = application.candidateFirstName
    ? [application.candidateFirstName, application.candidateLastName]
    : offer.candidateName.split(" ");

  return {
    id: createId(),
    employeeCode,
    firstName: firstName.trim(),
    lastName: rest.join(" ").trim() || application.candidateLastName,
    email: application.candidateEmail,
    mobile: application.candidateMobile,
    companyId: offer.organization.companyId,
    branchId: offer.organization.branchId,
    departmentId: offer.organization.departmentId,
    designationId: offer.organization.designationId,
    managerId: offer.reportingManagerEmployeeId,
    joiningDate: offer.joiningDate,
    employeeType: offer.employmentType,
    employmentStatus: RECRUITMENT_EMPLOYEE_STATUS.PENDING_ONBOARDING,
    isActive: true,
    company: offer.organization.companyName
      ? {
          id: offer.organization.companyId,
          companyCode: "",
          companyName: offer.organization.companyName,
        }
      : undefined,
    branch: offer.organization.branchName
      ? {
          id: offer.organization.branchId,
          branchCode: "",
          branchName: offer.organization.branchName,
        }
      : undefined,
    department: offer.organization.departmentName
      ? {
          id: offer.organization.departmentId,
          departmentCode: "",
          departmentName: offer.organization.departmentName,
        }
      : undefined,
    designation: offer.organization.designationName
      ? {
          id: offer.organization.designationId,
          designationCode: "",
          designationName: offer.organization.designationName,
        }
      : undefined,
    manager: offer.reportingManagerName
      ? {
          id: offer.reportingManagerEmployeeId,
          employeeCode: "",
          firstName: offer.reportingManagerName.split(" ")[0] ?? "",
          lastName: offer.reportingManagerName.split(" ").slice(1).join(" "),
        }
      : undefined,
  };
}

export const ReadyToHireMockStore = {
  listReadyToHire(): ReadyToHireQueueItem[] {
    return RecruitmentPipelineMockStore.listApplications()
      .filter(
        (application) =>
          application.status === JOB_APPLICATION_STATUS.OFFER_ACCEPTED ||
          application.status === JOB_APPLICATION_STATUS.HIRED
      )
      .map((application) => {
        const acceptedOffer = OfferMockStore.getAcceptedOffer(application.id);
        const existing = getExistingConversion(application.id);
        const preflight = buildPreflight(application.id);

        return {
          applicationId: application.id,
          applicationNumber: application.applicationNumber,
          candidateName:
            `${application.candidateFirstName} ${application.candidateLastName}`.trim(),
          openingTitle: application.openingTitle,
          branchName: application.branchName,
          acceptedAt: acceptedOffer?.responseAt,
          canConvert: preflight.canConvert,
          existingEmployeeId: existing?.employeeId,
        };
      })
      .sort(
        (a, b) => new Date(b.acceptedAt ?? 0).getTime() - new Date(a.acceptedAt ?? 0).getTime()
      );
  },

  getPreflight(applicationId: string): ConversionPreflight {
    return buildPreflight(applicationId);
  },

  convert(applicationId: string, dto: ConvertCandidateDto): ConversionResult {
    if (!dto.operationId?.trim()) {
      throw new Error("OPERATION_ID_REQUIRED");
    }

    const store = loadStore();
    const byOperation = store.records.find(
      (record) => record.operationId === dto.operationId,
    );
    if (byOperation) {
      return {
        employeeId: byOperation.employeeId,
        employeeCode: byOperation.employeeCode,
        applicationId,
        userId: byOperation.userId,
        employeeOnboardingId: byOperation.employeeOnboardingId,
        invitationDeliveryStatus: byOperation.invitationDeliveryStatus,
        isExistingConversion: true,
        operationId: byOperation.operationId,
      };
    }

    const existing = getExistingConversion(applicationId);
    if (existing) {
      return {
        employeeId: existing.employeeId,
        employeeCode: existing.employeeCode,
        applicationId,
        userId: existing.userId,
        employeeOnboardingId: existing.employeeOnboardingId,
        invitationDeliveryStatus: existing.invitationDeliveryStatus,
        isExistingConversion: true,
        operationId: existing.operationId,
      };
    }

    const preflight = buildPreflight(applicationId);
    if (!preflight.canConvert) {
      throw new Error("CONVERSION_PREFLIGHT_FAILED");
    }

    const application = RecruitmentPipelineMockStore.getApplication(applicationId);
    const acceptedOffer = OfferMockStore.getAcceptedOffer(applicationId);
    if (!application || !acceptedOffer) throw new Error("NOT_FOUND");

    if (application.version !== dto.applicationVersion) {
      throw new Error("STALE_STATE");
    }
    if (acceptedOffer.version !== dto.acceptedOfferVersion) {
      throw new Error("STALE_STATE");
    }
    if (acceptedOffer.status !== JOB_OFFER_STATUS.ACCEPTED) {
      throw new Error("INVALID_TRANSITION");
    }

    store.employeeSequence += 1;
    const employeeCode = `REC-${String(store.employeeSequence).padStart(4, "0")}`;
    const employee = buildEmployeeFromOffer(acceptedOffer, application, employeeCode);
    const userId = createId();
    const employeeOnboardingId = createId();

    const invitationDeliveryStatus = dto.confirmationNote?.includes("[mock-invitation-fail]")
      ? "FAILED"
      : "DELIVERED";

    store.employees[employee.id] = employee;
    store.records.push({
      applicationId,
      candidateId: application.candidateId,
      employeeId: employee.id,
      employeeCode,
      userId,
      employeeOnboardingId,
      offerId: acceptedOffer.id,
      invitationDeliveryStatus,
      operationId: dto.operationId,
      convertedAt: nowIso(),
    });
    saveStore(store);

    JobOpeningMockStore.convertReservedToUsed(application.jobOpeningId);
    RecruitmentPipelineMockStore.convertToHired(applicationId, {
      expectedVersion: application.version,
      operationId: dto.operationId,
      comment: dto.confirmationNote?.trim() || "Converted to employee",
    });
    RecruitmentPipelineMockStore.linkCandidateToEmployee(application.candidateId, employee.id);

    if (typeof window !== "undefined") {
      void import("@/features/employee-career/mocks/employee-career-mock-store").then(
        ({ EmployeeCareerMockStore }) => {
          EmployeeCareerMockStore.seedFromConversion(
            employee.id,
            applicationId,
            acceptedOffer.id,
            nowIso(),
            dto.confirmationNote?.includes("[mock-probation-due]")
          );
        }
      );
    }

    return {
      employeeId: employee.id,
      employeeCode,
      applicationId,
      userId,
      employeeOnboardingId,
      invitationDeliveryStatus,
      isExistingConversion: false,
      operationId: dto.operationId,
    };
  },

  retryInvitation(employeeId: string): ConversionResult["invitationDeliveryStatus"] {
    const store = loadStore();
    const record = store.records.find((item) => item.employeeId === employeeId);
    if (!record) throw new Error("NOT_FOUND");

    record.invitationDeliveryStatus = "DELIVERED";
    saveStore(store);
    return record.invitationDeliveryStatus;
  },

  getEmployee(employeeId: string): Employee | null {
    return loadStore().employees[employeeId] ?? null;
  },

  updateEmployee(employeeId: string, patch: Partial<Employee>): Employee | null {
    const store = loadStore();
    const current = store.employees[employeeId];
    if (!current) return null;

    store.employees[employeeId] = { ...current, ...patch };
    saveStore(store);
    return store.employees[employeeId];
  },

  listRecruitmentEmployees(): Employee[] {
    return Object.values(loadStore().employees);
  },

  getConversionByApplication(applicationId: string): ConversionRecord | null {
    return getExistingConversion(applicationId);
  },
};
