/** Live recruitment API paths — match Nest controllers under /api. */
export const RECRUITMENT_LIST_LIMIT = 100;

export const RECRUITMENT_API = {
  dashboard: "/hr/recruitment/dashboard",
  openings: "/hr/recruitment/openings",
  opening: (id: string) => `/hr/recruitment/openings/${id}`,
  openingChecklist: (id: string) =>
    `/hr/recruitment/openings/${id}/publication-checklist`,
  openingPublish: (id: string) => `/hr/recruitment/openings/${id}/publish`,
  openingHold: (id: string) => `/hr/recruitment/openings/${id}/hold`,
  openingReopen: (id: string) => `/hr/recruitment/openings/${id}/reopen`,
  openingClose: (id: string) => `/hr/recruitment/openings/${id}/close`,
  candidates: "/hr/recruitment/candidates",
  candidate: (id: string) => `/hr/recruitment/candidates/${id}`,
  candidateIntake: "/hr/recruitment/candidates/internal-intake",
  applications: "/hr/recruitment/applications",
  application: (id: string) => `/hr/recruitment/applications/${id}`,
  applicationTimeline: (id: string) =>
    `/hr/recruitment/applications/${id}/timeline`,
  applicationShortlist: (id: string) =>
    `/hr/recruitment/applications/${id}/shortlist`,
  applicationStartScreening: (id: string) =>
    `/hr/recruitment/applications/${id}/start-screening`,
  applicationAdvanceInterview: (id: string) =>
    `/hr/recruitment/applications/${id}/advance-to-interview`,
  applicationAdvanceManager: (id: string) =>
    `/hr/recruitment/applications/${id}/advance-to-manager-review`,
  applicationReject: (id: string) => `/hr/recruitment/applications/${id}/reject`,
  applicationWithdraw: (id: string) =>
    `/hr/recruitment/applications/${id}/withdraw`,
  interviews: "/hr/recruitment/interviews",
  applicationInterviews: (applicationId: string) =>
    `/hr/recruitment/applications/${applicationId}/interviews`,
  interviewReschedule: (applicationId: string, sessionId: string) =>
    `/hr/recruitment/applications/${applicationId}/interviews/${sessionId}/reschedule`,
  interviewCancel: (applicationId: string, sessionId: string) =>
    `/hr/recruitment/applications/${applicationId}/interviews/${sessionId}/cancel`,
  interviewComplete: (applicationId: string, sessionId: string) =>
    `/hr/recruitment/applications/${applicationId}/interviews/${sessionId}/complete`,
  offers: "/hr/recruitment/offers",
  offer: (id: string) => `/hr/recruitment/offers/${id}`,
  applicationOffers: (applicationId: string) =>
    `/hr/recruitment/applications/${applicationId}/offers`,
  applicationOffer: (applicationId: string, offerId: string) =>
    `/hr/recruitment/applications/${applicationId}/offers/${offerId}`,
  offerSend: (applicationId: string, offerId: string) =>
    `/hr/recruitment/applications/${applicationId}/offers/${offerId}/send`,
  offerRevoke: (applicationId: string, offerId: string) =>
    `/hr/recruitment/applications/${applicationId}/offers/${offerId}/revoke`,
  offerRetry: (applicationId: string, offerId: string) =>
    `/hr/recruitment/applications/${applicationId}/offers/${offerId}/retry-delivery`,
  offerRevise: (applicationId: string, offerId: string) =>
    `/hr/recruitment/applications/${applicationId}/offers/${offerId}/revise`,
  conversionPreflight: (applicationId: string) =>
    `/hr/recruitment/applications/${applicationId}/conversion/preflight`,
  convert: (applicationId: string) =>
    `/hr/recruitment/applications/${applicationId}/conversion/convert`,
  meInterviews: "/me/recruitment/interviews",
  meEvaluation: (sessionId: string) =>
    `/me/recruitment/interviews/${sessionId}/evaluation`,
  meEvaluationDraft: (sessionId: string) =>
    `/me/recruitment/interviews/${sessionId}/evaluation/draft`,
  meEvaluationSubmit: (sessionId: string) =>
    `/me/recruitment/interviews/${sessionId}/evaluation/submit`,
  meHiringDecisions: "/me/recruitment/hiring-decisions",
  meOpeningComparison: (openingId: string) =>
    `/me/recruitment/openings/${openingId}/comparison`,
  meSelectApplication: (applicationId: string) =>
    `/me/recruitment/applications/${applicationId}/select`,
  meRejectApplication: (applicationId: string) =>
    `/me/recruitment/applications/${applicationId}/reject`,
  publicCareers: (companyCode: string) => `/public/careers/${companyCode}`,
  publicJob: (companyCode: string, openingCode: string) =>
    `/public/careers/${companyCode}/jobs/${openingCode}`,
  publicApply: (companyCode: string, openingCode: string) =>
    `/public/careers/${companyCode}/jobs/${openingCode}/applications`,
  offerInspect: "/public/offer-response/inspect",
  offerAccept: "/public/offer-response/accept",
  offerDecline: "/public/offer-response/decline",
  offerDocumentDownload: "/public/offer-response/document-download",
  employeeCareer: (employeeId: string) => `/hr/employees/${employeeId}/career`,
  myCareer: "/me/career",
  probationDue: "/hr/recruitment/probation-due",
  confirmActive: (employeeId: string) =>
    `/hr/employees/${employeeId}/confirm-active`,
} as const;
