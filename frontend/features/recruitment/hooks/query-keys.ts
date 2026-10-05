/** React Query key factory for recruitment feature. */
export const recruitmentKeys = {
  all: ["recruitment"] as const,

  dashboard: () => [...recruitmentKeys.all, "dashboard"] as const,

  openings: {
    all: () => [...recruitmentKeys.all, "openings"] as const,
    lists: () => [...recruitmentKeys.openings.all(), "list"] as const,
    list: (filters?: unknown) =>
      [...recruitmentKeys.openings.lists(), filters] as const,
    details: () => [...recruitmentKeys.openings.all(), "detail"] as const,
    detail: (id: string) => [...recruitmentKeys.openings.details(), id] as const,
  },

  candidates: {
    all: () => [...recruitmentKeys.all, "candidates"] as const,
    lists: () => [...recruitmentKeys.candidates.all(), "list"] as const,
    list: (filters?: unknown) =>
      [...recruitmentKeys.candidates.lists(), filters] as const,
    details: () => [...recruitmentKeys.candidates.all(), "detail"] as const,
    detail: (id: string) =>
      [...recruitmentKeys.candidates.details(), id] as const,
  },

  applications: {
    all: () => [...recruitmentKeys.all, "applications"] as const,
    lists: () => [...recruitmentKeys.applications.all(), "list"] as const,
    list: (filters?: unknown) =>
      [...recruitmentKeys.applications.lists(), filters] as const,
    details: () => [...recruitmentKeys.applications.all(), "detail"] as const,
    detail: (id: string) =>
      [...recruitmentKeys.applications.details(), id] as const,
    timeline: (id: string) =>
      [...recruitmentKeys.applications.detail(id), "timeline"] as const,
  },

  interviews: {
    all: () => [...recruitmentKeys.all, "interviews"] as const,
    lists: () => [...recruitmentKeys.interviews.all(), "list"] as const,
    list: (filters?: unknown) =>
      [...recruitmentKeys.interviews.lists(), filters] as const,
    calendar: (filters?: unknown) =>
      [...recruitmentKeys.interviews.all(), "calendar", filters] as const,
  },

  offers: {
    all: () => [...recruitmentKeys.all, "offers"] as const,
    lists: () => [...recruitmentKeys.offers.all(), "list"] as const,
    list: (filters?: unknown) =>
      [...recruitmentKeys.offers.lists(), filters] as const,
    details: () => [...recruitmentKeys.offers.all(), "detail"] as const,
    detail: (id: string) => [...recruitmentKeys.offers.details(), id] as const,
    byApplication: (applicationId: string) =>
      [...recruitmentKeys.offers.all(), "application", applicationId] as const,
  },

  readyToHire: {
    all: () => [...recruitmentKeys.all, "ready-to-hire"] as const,
    queue: () => [...recruitmentKeys.readyToHire.all(), "queue"] as const,
    preflight: (applicationId: string) =>
      [...recruitmentKeys.readyToHire.all(), "preflight", applicationId] as const,
  },

  hiringDecisions: {
    all: () => [...recruitmentKeys.all, "hiring-decisions"] as const,
    queue: (hiringManagerEmployeeId?: string) =>
      [...recruitmentKeys.hiringDecisions.all(), "queue", hiringManagerEmployeeId] as const,
    comparison: (openingId: string, hiringManagerEmployeeId?: string) =>
      [
        ...recruitmentKeys.hiringDecisions.all(),
        "comparison",
        openingId,
        hiringManagerEmployeeId,
      ] as const,
  },

  careers: {
    all: () => [...recruitmentKeys.all, "careers"] as const,
    company: (companyCode: string) =>
      [...recruitmentKeys.careers.all(), "company", companyCode] as const,
    openings: (companyCode: string) =>
      [...recruitmentKeys.careers.all(), "openings", companyCode] as const,
    opening: (companyCode: string, openingCode: string) =>
      [
        ...recruitmentKeys.careers.all(),
        "opening",
        companyCode,
        openingCode,
      ] as const,
  },

  offerResponse: {
    inspect: (token: string) =>
      [...recruitmentKeys.all, "offer-response", "inspect", token] as const,
  },
} as const;
