/** Seeds a minimal mock offer-response scenario in browser localStorage for Playwright. */
export const MOCK_OFFER_RESPONSE = {
  token: "playwright-offer-token-check",
  offerId: "playwright-offer-id",
} as const;

export function buildMockOfferResponseSeedScript() {
  const { token, offerId } = MOCK_OFFER_RESPONSE;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const offer = {
    id: offerId,
    jobApplicationId: "playwright-application-id",
    applicationNumber: "APP-PLAYWRIGHT",
    candidateName: "Alex Candidate",
    candidateEmail: "alex.candidate@example.com",
    jobOpeningId: "playwright-opening-id",
    openingCode: "JO-PLAYWRIGHT",
    openingTitle: "Playwright Test Engineer",
    versionNumber: 1,
    status: "SENT",
    version: 1,
    roleTitle: "Playwright Test Engineer",
    organization: {
      companyId: "company-1",
      companyName: "Demo Company",
      branchId: "branch-1",
      branchName: "Head Office",
      departmentId: "dept-1",
      departmentName: "Engineering",
      designationId: "desig-1",
      designationName: "Test Engineer",
    },
    reportingManagerEmployeeId: "manager-1",
    reportingManagerName: "Jordan Manager",
    employmentType: "FULL_TIME",
    joiningDate: expiresAt.toISOString().slice(0, 10),
    compensation: { amount: 1200000, currency: "INR", period: "ANNUAL" },
    probationDays: 90,
    expiryDate: expiresAt.toISOString().slice(0, 10),
    terms: "Standard employment terms apply.",
    delivery: { status: "SENT" },
    allowedActions: {
      canEdit: false,
      canPreview: true,
      canSend: false,
      canRetryDelivery: false,
      canRevoke: true,
      canRevise: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return `
    localStorage.setItem(
      "recruitment-offers-mock-v1",
      JSON.stringify([${JSON.stringify(offer)}]),
    );
    localStorage.setItem(
      "recruitment-offer-response-tokens-v1",
      JSON.stringify({
        "${token}": {
          offerId: "${offerId}",
          expiresAt: "${expiresAt.toISOString().slice(0, 10)}",
        },
      }),
    );
  `;
}
