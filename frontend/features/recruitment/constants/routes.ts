/** Internal recruitment route map — mirrors UI plan. */
export const RECRUITMENT_ROUTES = {
  dashboard: "/hr/recruitment",
  openings: {
    list: "/hr/recruitment/openings",
    detail: (id: string) => `/hr/recruitment/openings/${id}`,
  },
  candidates: {
    list: "/hr/recruitment/candidates",
    detail: (id: string) => `/hr/recruitment/candidates/${id}`,
  },
  applications: {
    list: "/hr/recruitment/applications",
    detail: (id: string) => `/hr/recruitment/applications/${id}`,
  },
  interviews: {
    list: "/hr/recruitment/interviews",
    detail: (id: string) => `/hr/recruitment/interviews/${id}`,
    evaluate: (id: string) => `/hr/recruitment/interviews/${id}/evaluate`,
  },
  hiringDecisions: {
    list: "/hr/recruitment/hiring-decisions",
    opening: (openingId: string) =>
      `/hr/recruitment/hiring-decisions/${openingId}`,
  },
  offers: {
    list: "/hr/recruitment/offers",
    detail: (id: string) => `/hr/recruitment/offers/${id}`,
  },
  employeeDetail: (id: string, tab?: "onboarding" | "overview" | "career") => {
    const base = `/hr/employees/${id}`;
    return tab ? `${base}?tab=${tab}` : base;
  },
} as const;

/** Public routes — implemented in later UI steps. */
export const RECRUITMENT_PUBLIC_ROUTES = {
  careers: (companyCode: string) => `/careers/${companyCode}`,
  jobDetail: (companyCode: string, openingCode: string) =>
    `/careers/${companyCode}/jobs/${openingCode}`,
  offerResponse: "/offer-response",
} as const;
