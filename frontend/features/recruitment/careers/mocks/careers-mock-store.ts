import { JobOpeningMockStore } from "../../openings/mocks/job-opening-mock-store";
import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import { JOB_OPENING_STATUS } from "../../types/enums";
import type {
  PublicApplicationReceipt,
  PublicCompanyProfile,
  PublicJobOpeningDetail,
  PublicJobOpeningListItem,
  SubmitPublicApplicationInput,
} from "../types/public-careers";
import { slugifyCompanyCode } from "../utils/file-validation";
import { toSafePublicReceipt } from "../utils/safe-public-receipt";

const COMPANY_MAP_KEY = "recruitment-careers-company-map-v1";
const SUBMISSIONS_KEY = "recruitment-public-submissions-v1";

interface CompanyMapEntry {
  companyId: string;
  companyName: string;
}

interface StoredSubmission {
  receiptReference: string;
  message: string;
  createdAt: string;
}

function loadCompanyMap(): Record<string, CompanyMapEntry> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(COMPANY_MAP_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CompanyMapEntry>;
  } catch {
    return {};
  }
}

function saveCompanyMap(map: Record<string, CompanyMapEntry>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPANY_MAP_KEY, JSON.stringify(map));
}

function ensureCompanyMap() {
  const map = loadCompanyMap();
  let changed = false;

  for (const opening of JobOpeningMockStore.list()) {
    if (!opening.companyName) continue;
    const code = slugifyCompanyCode(opening.companyName);
    if (!code || map[code]) continue;
    map[code] = {
      companyId: opening.companyId,
      companyName: opening.companyName,
    };
    changed = true;
  }

  if (changed) saveCompanyMap(map);
  return map;
}

function loadSubmissions(): Record<string, StoredSubmission> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredSubmission>;
  } catch {
    return {};
  }
}

function saveSubmission(key: string, receipt: PublicApplicationReceipt) {
  if (typeof window === "undefined") return;

  const submissions = loadSubmissions();
  submissions[key] = {
    ...receipt,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
}

function isOpeningExpired(deadline: string) {
  const end = new Date(deadline);
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

function toListItem(opening: ReturnType<typeof JobOpeningMockStore.getById>): PublicJobOpeningListItem {
  if (!opening) throw new Error("NOT_FOUND");

  const expired = isOpeningExpired(opening.applicationDeadline);

  return {
    openingCode: opening.openingCode,
    title: opening.title,
    branchLocation: opening.branchName ?? opening.location,
    employmentType: opening.employmentType,
    applicationDeadline: opening.applicationDeadline,
    isExpired: expired,
  };
}

function buildReceipt(referenceSeed: string): PublicApplicationReceipt {
  return toSafePublicReceipt({
    receiptReference: `APP-${referenceSeed.slice(-8).toUpperCase()}`,
  });
}

export const CareersMockStore = {
  resolveCompany(companyCode: string): PublicCompanyProfile | null {
    const map = ensureCompanyMap();
    const entry = map[companyCode.toLowerCase()];
    if (!entry) return null;

    return {
      companyCode: companyCode.toLowerCase(),
      companyName: entry.companyName,
    };
  },

  listOpenings(companyCode: string): PublicJobOpeningListItem[] {
    const company = this.resolveCompany(companyCode);
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const map = ensureCompanyMap();
    const entry = map[companyCode.toLowerCase()];

    return JobOpeningMockStore.list()
      .filter(
        (opening) =>
          opening.companyId === entry.companyId &&
          opening.status === JOB_OPENING_STATUS.OPEN,
      )
      .map((opening) => toListItem(opening))
      .sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        return (
          new Date(a.applicationDeadline).getTime() -
          new Date(b.applicationDeadline).getTime()
        );
      });
  },

  getOpening(companyCode: string, openingCode: string): PublicJobOpeningDetail {
    const company = this.resolveCompany(companyCode);
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const map = ensureCompanyMap();
    const entry = map[companyCode.toLowerCase()];

    const opening = JobOpeningMockStore.list().find(
      (item) =>
        item.openingCode.toLowerCase() === openingCode.toLowerCase() &&
        item.companyId === entry.companyId,
    );

    if (!opening) throw new Error("OPENING_NOT_FOUND");

    const expired = isOpeningExpired(opening.applicationDeadline);
    const closed = opening.status !== JOB_OPENING_STATUS.OPEN;
    const canApply = !expired && !closed;

    return {
      ...toListItem(opening),
      companyName: company.companyName,
      description: opening.description,
      location: opening.location ?? opening.branchName,
      canApply,
      closingMessage: closed
        ? "This opening is no longer accepting applications."
        : expired
          ? "The application deadline for this opening has passed."
          : undefined,
    };
  },

  submitApplication(
    companyCode: string,
    openingCode: string,
    input: SubmitPublicApplicationInput,
  ): PublicApplicationReceipt {
    if (input.honeypot?.trim()) {
      throw new Error("BOT_DETECTED");
    }

    const existing = loadSubmissions()[input.idempotencyKey];
    if (existing) {
      return {
        receiptReference: existing.receiptReference,
        message: existing.message,
      };
    }

    const openingDetail = this.getOpening(companyCode, openingCode);
    if (!openingDetail.canApply) throw new Error("OPENING_NOT_OPEN");

    const map = ensureCompanyMap();
    const entry = map[companyCode.toLowerCase()];
    const opening = JobOpeningMockStore.list().find(
      (item) =>
        item.openingCode.toLowerCase() === openingCode.toLowerCase() &&
        item.companyId === entry.companyId,
    );
    if (!opening) throw new Error("OPENING_NOT_FOUND");

    try {
      RecruitmentPipelineMockStore.createPublicApplication({
        jobOpeningId: opening.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        mobile: input.mobile,
        coverNote: input.coverNote,
        cvFileName: input.cv.fileName,
        cvFileSize: input.cv.fileSize,
        supportingDocuments: input.supportingDocuments,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_APPLICATION") {
        const receipt = buildReceipt(input.idempotencyKey);
        saveSubmission(input.idempotencyKey, receipt);
        return receipt;
      }
      throw error;
    }

    const receipt = buildReceipt(crypto.randomUUID());
    saveSubmission(input.idempotencyKey, receipt);
    return receipt;
  },
};
