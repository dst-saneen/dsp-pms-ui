import type { Page } from "@playwright/test";

export function stubInvalidOfferInspection(page: Page) {
  return page.route("**/public/offer-response/inspect**", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        statusCode: 409,
        code: "OFFER_TOKEN_INVALID",
        message: "Offer token is invalid.",
      }),
    });
  });
}

export function stubValidOfferInspection(page: Page) {
  return page.route("**/public/offer-response/inspect**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          state: "VALID",
          message: "Review the offer details below and respond using your legal name.",
          canRespond: true,
          canDownloadPdf: false,
          responseVersion: 1,
          offer: {
            roleTitle: "Playwright Test Engineer",
            companyName: "Demo Company",
            branchName: "Head Office",
            designationName: "Test Engineer",
            reportingManagerName: "Jordan Manager",
            employmentType: "FULL_TIME",
            joiningDate: "2026-09-01",
            compensation: { amount: 1200000, currency: "INR", period: "ANNUAL" },
            probationDays: 90,
            expiryDate: "2026-09-15",
            terms: "Standard employment terms apply.",
            versionNumber: 1,
          },
        },
      }),
    });
  });
}
