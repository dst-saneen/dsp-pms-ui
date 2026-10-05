/**
 * Pass 2: remaining module screenshots (lists + drawer creates).
 * Run from frontend/: node scripts/capture-company-guide-screenshots-pass2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  requireGuideBaseUrl,
  requireGuideCredential,
} from "./capture-company-guide-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = requireGuideBaseUrl();
const OUT = path.resolve(
  __dirname,
  "../../docs/product/company-workflow-guide/images",
);
const EMAIL = requireGuideCredential("GUIDE_FALLBACK_EMAIL");
const PASSWORD = requireGuideCredential("GUIDE_FALLBACK_PASSWORD");

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${name}`);
}

async function gotoPage(page, href) {
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
}

async function capture(page, href, file) {
  try {
    await gotoPage(page, href);
    if (page.url().includes("/login")) {
      console.log(`skip ${file}: login`);
      return;
    }
    await shot(page, file);
  } catch (error) {
    console.log(`skip ${file}: ${error.message}`);
  }
}

async function captureClick(page, href, buttonName, file) {
  try {
    await gotoPage(page, href);
    const button = page.getByRole("button", { name: buttonName }).first();
    if ((await button.count()) === 0 || !(await button.isVisible().catch(() => false))) {
      console.log(`skip ${file}: no ${buttonName}`);
      return;
    }
    await button.click();
    await page.waitForTimeout(800);
    await shot(page, file);
    await page.keyboard.press("Escape");
  } catch (error) {
    console.log(`skip ${file}: ${error.message}`);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12_000);

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#identifier").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20_000,
  });

  await capture(page, "/my-workspace", "17-my-workspace.png");
  await capture(page, "/my-workspace/calendar", "17-my-calendar.png");
  await capture(page, "/my-workspace/leave?action=apply", "17-apply-leave.png");
  await capture(page, "/my-workspace/onboarding", "17-my-onboarding.png");
  await capture(page, "/my-workspace/hr-requests", "17-my-hr-requests.png");
  await capture(page, "/my-workspace/approvals", "17-approvals.png");
  await capture(page, "/my-workspace/projects", "17-my-projects.png");
  await capture(page, "/my-workspace/timesheets", "17-my-timesheets.png");

  await capture(page, "/administration/business-calendar", "05-business-calendar.png");
  await capture(page, "/administration/business-calendar/preview", "05-calendar-preview.png");
  await capture(page, "/hr/work-schedule", "05-work-schedule.png");

  await capture(page, "/hr/attendance", "09-attendance.png");
  await capture(page, "/hr/attendance/exceptions", "09-exceptions.png");
  await capture(page, "/hr/attendance/periods", "09-periods.png");

  await capture(page, "/hr/leave/types", "10-leave-types.png");
  await captureClick(page, "/hr/leave/types", /New|Add/, "10-leave-type-new.png");
  await capture(page, "/hr/leave/policies", "10-leave-policies.png");
  await capture(page, "/hr/leave/balances", "10-leave-balances.png");
  await capture(page, "/hr/leave", "10-leave-requests.png");
  await capture(page, "/hr/leave/calendar", "10-leave-calendar.png");
  await capture(page, "/hr/leave/holidays", "10-leave-holidays.png");
  await capture(page, "/hr/leave/comp-off", "10-comp-off.png");
  await capture(page, "/hr/overtime", "10-overtime.png");

  await capture(page, "/hr/recruitment", "06-recruitment.png");
  await capture(page, "/hr/recruitment/openings", "06-openings.png");
  await capture(page, "/hr/recruitment/applications", "06-applications.png");
  await capture(page, "/hr/recruitment/candidates", "06-candidates.png");
  await capture(page, "/hr/recruitment/interviews", "06-interviews.png");
  await capture(page, "/hr/recruitment/offers", "06-offers.png");
  await capture(page, "/hr/onboarding-templates", "07-onboarding-templates.png");
  await capture(page, "/hr/employee-onboarding", "07-employee-onboarding.png");

  await capture(page, "/hr/employee-document-categories", "08-doc-categories.png");
  await capture(page, "/hr/employee-document-types", "08-doc-types.png");
  await capture(page, "/hr/employee-documents", "08-documents.png");

  await capture(page, "/asset-management/asset-categories", "11-categories.png");
  await captureClick(page, "/asset-management/asset-categories", /New|Add/, "11-category-new.png");
  await capture(page, "/asset-management/asset-types", "11-types.png");
  await capture(page, "/asset-management/assets", "11-assets.png");
  await capture(page, "/asset-management/licenses", "11-licences.png");
  await capture(page, "/asset-management/employee-assets", "11-assigned.png");
  await capture(page, "/asset-management/inbox", "11-inbox.png");
  await capture(page, "/asset-management/department-grants", "11-grants.png");
  await capture(page, "/asset-management/transfers", "11-transfers.png");

  await capture(page, "/hr/hr-requests", "12-hr-requests.png");
  await capture(page, "/hr/employee-separations", "12-separations.png");

  await capture(page, "/projects/projects", "13-projects.png");
  await capture(page, "/team/timesheets", "13-team-timesheets.png");

  await capture(page, "/office-finance", "14-finance.png");
  await capture(page, "/office-finance/setup", "14-finance-setup.png");
  await capture(page, "/office-finance/transactions", "14-transactions.png");
  await captureClick(page, "/office-finance/transactions", /New|Add|Create/, "14-transaction-new.png");
  await capture(page, "/office-finance/reports", "14-finance-reports.png");

  await capture(page, "/hr/payroll", "15-payroll.png");
  await capture(page, "/admin/operations/delivery", "16-delivery.png");
  await capture(page, "/admin/operations/delivery/dead-letters", "16-dead-letters.png");
  await capture(page, "/administration/operations/files", "16-files.png");
  await capture(page, "/settings/security/document-retention", "16-retention.png");

  await browser.close();
  console.log("pass2 done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
