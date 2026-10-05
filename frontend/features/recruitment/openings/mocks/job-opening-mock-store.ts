import { JOB_OPENING_STATUS } from "../../types/enums";
import type { CreateJobOpeningDto } from "../types/create-job-opening";
import type { JobOpeningCriterionInput } from "../types/job-opening-criterion";
import type { JobOpeningSearch } from "../types/job-opening-search";
import type { JobOpening } from "../types/job-opening";
import type { PublicationChecklist } from "../types/publication-checklist";
import type { UpdateJobOpeningDto } from "../types/update-job-opening";
import {
  buildAllowedActions,
  buildNextAction,
  buildPublicationChecklist,
} from "../utils/publication-checklist";

const STORAGE_KEY = "recruitment-job-openings-mock-v1";

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function generateOpeningCode() {
  return `JO-${Date.now().toString().slice(-6)}`;
}

function normalizeCriteria(
  criteria: JobOpeningCriterionInput[],
): JobOpening["criteria"] {
  return criteria
    .map((item, index) => ({
      id: item.id ?? createId(),
      name: item.name.trim(),
      description: item.description?.trim() || undefined,
      weightPercentage: item.weightPercentage,
      displayOrder: item.displayOrder ?? index,
      isRequired: item.isRequired,
      isActive: item.isActive,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function decorateOpening(opening: JobOpening): JobOpening {
  const checklist = buildPublicationChecklist(opening);
  return {
    ...opening,
    allowedActions: buildAllowedActions(opening, checklist),
    nextAction: buildNextAction(opening),
  };
}

function loadOpenings(): JobOpening[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JobOpening[];
    return Array.isArray(parsed) ? parsed.map(decorateOpening) : [];
  } catch {
    return [];
  }
}

function saveOpenings(openings: JobOpening[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openings));
}

function assertVersion(opening: JobOpening, version: number) {
  if (opening.version !== version) {
    throw new Error("STALE_STATE");
  }
}

function createOpeningRecord(dto: CreateJobOpeningDto): JobOpening {
  const timestamp = nowIso();
  const opening: JobOpening = {
    id: createId(),
    openingCode: generateOpeningCode(),
    title: dto.title.trim(),
    description: dto.description?.trim() || undefined,
    status: JOB_OPENING_STATUS.DRAFT,
    version: 1,
    companyGroupId: dto.companyGroupId,
    companyId: dto.companyId,
    branchId: dto.branchId,
    departmentId: dto.departmentId,
    designationId: dto.designationId,
    companyCode: dto.companyCode,
    companyGroupName: dto.companyGroupName,
    companyName: dto.companyName,
    branchName: dto.branchName,
    departmentName: dto.departmentName,
    designationName: dto.designationName,
    hiringManagerEmployeeId: dto.hiringManagerEmployeeId,
    hiringManagerName: dto.hiringManagerName,
    employmentType: dto.employmentType,
    location: dto.location?.trim() || undefined,
    headcount: {
      approved: dto.headcount,
      used: 0,
      reserved: 0,
      remaining: dto.headcount,
    },
    targetJoiningDate: dto.targetJoiningDate || undefined,
    applicationDeadline: dto.applicationDeadline,
    criteria: normalizeCriteria(dto.criteria),
    allowedActions: {
      canEdit: true,
      canPublish: false,
      canHold: false,
      canReopen: false,
      canClose: false,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return decorateOpening(opening);
}

function applyUpdate(opening: JobOpening, dto: UpdateJobOpeningDto): JobOpening {
  return decorateOpening({
    ...opening,
    title: dto.title.trim(),
    description: dto.description?.trim() || undefined,
    companyGroupId: dto.companyGroupId,
    companyId: dto.companyId,
    branchId: dto.branchId,
    departmentId: dto.departmentId,
    designationId: dto.designationId,
    companyCode: dto.companyCode ?? opening.companyCode,
    companyGroupName: dto.companyGroupName,
    companyName: dto.companyName,
    branchName: dto.branchName,
    departmentName: dto.departmentName,
    designationName: dto.designationName,
    hiringManagerEmployeeId: dto.hiringManagerEmployeeId,
    hiringManagerName: dto.hiringManagerName,
    employmentType: dto.employmentType,
    location: dto.location?.trim() || undefined,
    headcount: {
      ...opening.headcount,
      approved: dto.headcount,
      remaining: Math.max(
        0,
        dto.headcount - opening.headcount.used - opening.headcount.reserved,
      ),
    },
    targetJoiningDate: dto.targetJoiningDate || undefined,
    applicationDeadline: dto.applicationDeadline,
    criteria: normalizeCriteria(dto.criteria),
    version: opening.version + 1,
    updatedAt: nowIso(),
  });
}

function matchesSearch(opening: JobOpening, filters?: JobOpeningSearch) {
  if (!filters) return true;

  if (filters.status && opening.status !== filters.status) return false;
  if (filters.companyId && opening.companyId !== filters.companyId) return false;
  if (filters.branchId && opening.branchId !== filters.branchId) return false;
  if (filters.departmentId && opening.departmentId !== filters.departmentId)
    return false;
  if (filters.designationId && opening.designationId !== filters.designationId)
    return false;
  if (
    filters.hiringManagerEmployeeId &&
    opening.hiringManagerEmployeeId !== filters.hiringManagerEmployeeId
  ) {
    return false;
  }

  const keyword = filters.search?.trim().toLowerCase();
  if (!keyword) return true;

  return (
    opening.openingCode.toLowerCase().includes(keyword) ||
    opening.title.toLowerCase().includes(keyword) ||
    opening.companyName?.toLowerCase().includes(keyword) ||
    opening.branchName?.toLowerCase().includes(keyword) ||
    opening.designationName?.toLowerCase().includes(keyword) ||
    opening.hiringManagerName?.toLowerCase().includes(keyword)
  );
}

export const JobOpeningMockStore = {
  list(filters?: JobOpeningSearch): JobOpening[] {
    return loadOpenings()
      .filter((opening) => matchesSearch(opening, filters))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  },

  getById(id: string): JobOpening | null {
    return loadOpenings().find((opening) => opening.id === id) ?? null;
  },

  create(dto: CreateJobOpeningDto): JobOpening {
    const openings = loadOpenings();
    const created = createOpeningRecord(dto);
    saveOpenings([created, ...openings]);
    return created;
  },

  update(id: string, dto: UpdateJobOpeningDto): JobOpening {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    if (current.status !== JOB_OPENING_STATUS.DRAFT) {
      throw new Error("INVALID_TRANSITION");
    }

    assertVersion(current, dto.version);
    const updated = applyUpdate(current, dto);
    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },

  getPublicationChecklist(id: string): PublicationChecklist {
    const opening = this.getById(id);
    if (!opening) throw new Error("NOT_FOUND");
    return buildPublicationChecklist(opening);
  },

  publish(id: string, version: number): JobOpening {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    assertVersion(current, version);

    const checklist = buildPublicationChecklist(current);
    if (!checklist.canPublish) throw new Error("OPENING_CRITERIA_INVALID");

    const updated = decorateOpening({
      ...current,
      status: JOB_OPENING_STATUS.OPEN,
      version: current.version + 1,
      publishedAt: nowIso(),
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },

  hold(id: string, version: number): JobOpening {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    assertVersion(current, version);
    if (current.status !== JOB_OPENING_STATUS.OPEN) {
      throw new Error("INVALID_TRANSITION");
    }

    const updated = decorateOpening({
      ...current,
      status: JOB_OPENING_STATUS.ON_HOLD,
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },

  reopen(id: string, version: number): JobOpening {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    assertVersion(current, version);
    if (current.status !== JOB_OPENING_STATUS.ON_HOLD) {
      throw new Error("INVALID_TRANSITION");
    }

    const updated = decorateOpening({
      ...current,
      status: JOB_OPENING_STATUS.OPEN,
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },

  close(id: string, version: number): JobOpening {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === id);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    assertVersion(current, version);
    if (
      current.status !== JOB_OPENING_STATUS.OPEN &&
      current.status !== JOB_OPENING_STATUS.ON_HOLD &&
      current.status !== JOB_OPENING_STATUS.FILLED
    ) {
      throw new Error("INVALID_TRANSITION");
    }

    const updated = decorateOpening({
      ...current,
      status: JOB_OPENING_STATUS.CLOSED,
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },

  reserveHeadcount(openingId: string) {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === openingId);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    const before = { ...current.headcount };
    if (current.headcount.remaining <= 0) {
      throw new Error("HEADCOUNT_NOT_AVAILABLE");
    }

    const after = {
      ...current.headcount,
      reserved: current.headcount.reserved + 1,
      remaining: current.headcount.remaining - 1,
    };

    const updated = decorateOpening({
      ...current,
      headcount: after,
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);

    return {
      opening: updated,
      impact: {
        reservedBefore: before.reserved,
        reservedAfter: after.reserved,
        remainingBefore: before.remaining,
        remainingAfter: after.remaining,
      },
    };
  },

  releaseHeadcount(openingId: string) {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === openingId);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    if (current.headcount.reserved <= 0) {
      return current;
    }

    const updated = decorateOpening({
      ...current,
      headcount: {
        ...current.headcount,
        reserved: current.headcount.reserved - 1,
        remaining: current.headcount.remaining + 1,
      },
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },

  convertReservedToUsed(openingId: string) {
    const openings = loadOpenings();
    const index = openings.findIndex((opening) => opening.id === openingId);
    if (index < 0) throw new Error("NOT_FOUND");

    const current = openings[index];
    if (current.headcount.reserved <= 0) {
      throw new Error("HEADCOUNT_NOT_RESERVED");
    }

    const updated = decorateOpening({
      ...current,
      headcount: {
        ...current.headcount,
        reserved: current.headcount.reserved - 1,
        used: current.headcount.used + 1,
      },
      version: current.version + 1,
      updatedAt: nowIso(),
    });

    openings[index] = updated;
    saveOpenings(openings);
    return updated;
  },
};
