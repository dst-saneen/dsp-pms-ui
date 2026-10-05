/**
 * Recapture pages by sidebar click (avoids Turbopack nested GET 404s).
 * Run from frontend/: node scripts/capture-company-guide-screenshots-pass3.mjs
 * Does not print passwords or OTP values.
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
const OWNER_PASSWORD = requireGuideCredential("GUIDE_OWNER_PASSWORD");

const PARENT = {
  "/my-workspace": "My Workspace",
  "/my-workspace/calendar": "My Workspace",
  "/my-workspace/leave": "My Workspace",
  "/my-workspace/onboarding": "My Workspace",
  "/my-workspace/hr-requests": "My Workspace",
  "/my-workspace/approvals": "My Workspace",
  "/my-workspace/projects": "My Workspace",
  "/my-workspace/timesheets": "My Workspace",
  "/hr/attendance": "Attendance",
  "/hr/attendance/exceptions": "Attendance",
  "/hr/attendance/periods": "Attendance",
  "/hr/leave/types": "Leave",
  "/hr/leave/policies": "Leave",
  "/hr/leave/balances": "Leave",
  "/hr/leave": "Leave",
  "/hr/leave/calendar": "Leave",
  "/hr/leave/holidays": "Leave",
  "/hr/leave/comp-off": "Leave",
  "/hr/recruitment": "Recruitment",
  "/hr/recruitment/openings": "Recruitment",
  "/hr/recruitment/applications": "Recruitment",
  "/hr/recruitment/candidates": "Recruitment",
  "/hr/recruitment/interviews": "Recruitment",
  "/hr/recruitment/offers": "Recruitment",
  "/hr/employee-document-categories": "Employee Documents",
  "/office-finance": "Office Finance",
  "/office-finance/setup": "Office Finance",
  "/office-finance/transactions": "Office Finance",
  "/office-finance/reports": "Office Finance",
};

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${name} ${page.url()}`);
}

async function hideDevOtp(page) {
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll("p, div")].find((el) =>
      el.textContent?.includes("Development verification code"),
    );
    const box = heading?.closest("div.rounded-xl");
    if (box) box.style.visibility = "hidden";
  });
}

async function typeOtp(page, code) {
  await page.getByLabel("Digit 1 of 6").click();
  await page.keyboard.type(code, { delay: 40 });
}

function pageState(text) {
  if (text.includes("This page could not be found")) return "404";
  if (text.includes("Securing your workspace")) return "securing";
  if (text.includes("Checking module availability")) return "checking";
  if (text.includes("Compiling")) return "compiling";
  return "ok";
}

async function waitReady(page) {
  for (let i = 0; i < 30; i += 1) {
    const status = pageState(await page.locator("body").innerText());
    if (status === "404") return "404";
    if (status === "ok") {
      await page.waitForTimeout(800);
      return pageState(await page.locator("body").innerText());
    }
    await page.waitForTimeout(700);
  }
  return pageState(await page.locator("body").innerText());
}

function desktopNav(page) {
  return page.locator('nav[aria-label="Main navigation"]').last();
}

async function goHome(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  await desktopNav(page)
    .locator('a[href="/dashboard"]')
    .first()
    .waitFor({ timeout: 20_000 });
}

async function expandParent(page, href) {
  const name = PARENT[href];
  if (!name) return;
  const button = desktopNav(page).getByRole("button", { name, exact: true });
  if ((await button.count()) === 0) return;
  const expanded = await button.getAttribute("aria-expanded");
  if (expanded === "true") return;
  await button.click();
  await page.waitForTimeout(350);
}

async function captureHref(page, href, file) {
  try {
    if (pageState(await page.locator("body").innerText()) === "404") {
      await goHome(page);
    }
    await expandParent(page, href);
    const link = desktopNav(page).locator(`a[href="${href}"]`).first();
    if ((await link.count()) === 0) {
      console.log(`skip ${file}: no link ${href}`);
      return false;
    }
    await link.click({ timeout: 8_000 });
    const status = await waitReady(page);
    if (status !== "ok") {
      console.log(`skip ${file}: ${status} ${page.url()}`);
      await goHome(page);
      return false;
    }
    await shot(page, file);
    return true;
  } catch (error) {
    console.log(`skip ${file}: ${error.message.split("\n")[0]}`);
    await goHome(page).catch(() => {});
    return false;
  }
}

async function captureHub(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20_000);
  const stamp = Date.now();
  const email = `northstar.owner.${stamp}@example.test`;

  try {
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await page.locator("#organization-name").fill("Northstar Labs");
    await page.locator("#display-name").fill("Priya Owner");
    await page.locator("#registration-email").fill(email);
    await page.locator("#registration-password").fill(OWNER_PASSWORD);
    await page.locator("#confirm-password").fill(OWNER_PASSWORD);

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("register-organization") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByRole("button", { name: "Send verification code" }).click();
    const response = await responsePromise;
    const body = await response.json().catch(() => ({}));
    const otp = String(
      body?.data?.developmentVerificationCode ??
        body?.developmentVerificationCode ??
        "",
    ).replace(/\D/g, "");

    await page
      .getByRole("button", { name: "Verify and continue" })
      .waitFor({ timeout: 15_000 });

    let code = otp;
    if (code.length !== 6) {
      code = await page.evaluate(() => {
        const heading = [...document.querySelectorAll("p")].find((el) =>
          el.textContent?.includes("Development verification code"),
        );
        return heading?.nextElementSibling?.textContent?.replace(/\D/g, "") ?? "";
      });
    }
    if (code.length !== 6) {
      console.log("hub skipped: no verification code");
      await page.close();
      return;
    }

    await typeOtp(page, code);
    await hideDevOtp(page);
    await shot(page, "01-verify-email.png");

    const verify = page.getByRole("button", { name: "Verify and continue" });
    for (let i = 0; i < 12 && (await verify.isDisabled()); i += 1) {
      await page.waitForTimeout(250);
    }
    await verify.click({ force: true });
    await page.waitForURL("**/onboarding", { timeout: 25_000 });
    await page.waitForTimeout(1200);
    await shot(page, "01-onboarding-hub.png");

    const confirm = page.getByRole("button", { name: "Confirm branch" });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      await page.waitForTimeout(600);
      await page.locator("#hub-branch-name").fill("Kochi Head Office").catch(() => {});
      await shot(page, "01-confirm-branch-dialog.png");
      const saveBranch = page.getByRole("button", { name: "Save branch" });
      if (await saveBranch.isEnabled().catch(() => false)) {
        await saveBranch.click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press("Escape");
      }
    }

    const addDept = page.getByRole("button", { name: "Add department" });
    if (await addDept.isEnabled().catch(() => false)) {
      await addDept.click();
      await page.waitForTimeout(600);
      const dept = page.locator("#hub-department-name, input[id*='department']").first();
      if (await dept.count()) await dept.fill("Human Resources");
      await shot(page, "01-add-department-dialog.png");
      await page.keyboard.press("Escape");
    }

    await shot(page, "01-onboarding-ready.png");
    console.log("hub captured");
  } catch (error) {
    console.log(`hub skipped: ${error.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20_000);

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#identifier").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20_000,
  });
  await waitReady(page);
  await goHome(page);
  await page
    .getByRole("heading", { name: /welcome back/i })
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  await desktopNav(page)
    .getByText("Human Resources", { exact: true })
    .waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);

  const shots = [
    ["/my-workspace", "17-my-workspace.png"],
    ["/my-workspace/calendar", "17-my-calendar.png"],
    ["/my-workspace/leave", "17-apply-leave.png"],
    ["/my-workspace/onboarding", "17-my-onboarding.png"],
    ["/my-workspace/hr-requests", "17-my-hr-requests.png"],
    ["/my-workspace/approvals", "17-approvals.png"],
    ["/my-workspace/projects", "17-my-projects.png"],
    ["/my-workspace/timesheets", "17-my-timesheets.png"],
    ["/administration/business-calendar", "05-business-calendar.png"],
    ["/hr/work-schedule", "05-work-schedule.png"],
    ["/hr/attendance", "09-attendance.png"],
    ["/hr/attendance/exceptions", "09-exceptions.png"],
    ["/hr/attendance/periods", "09-periods.png"],
    ["/hr/leave/types", "10-leave-types.png"],
    ["/hr/leave/policies", "10-leave-policies.png"],
    ["/hr/leave/balances", "10-leave-balances.png"],
    ["/hr/leave", "10-leave-requests.png"],
    ["/hr/leave/calendar", "10-leave-calendar.png"],
    ["/hr/leave/holidays", "10-leave-holidays.png"],
    ["/hr/leave/comp-off", "10-comp-off.png"],
    ["/hr/overtime", "10-overtime.png"],
    ["/hr/recruitment", "06-recruitment.png"],
    ["/hr/recruitment/openings", "06-openings.png"],
    ["/hr/recruitment/applications", "06-applications.png"],
    ["/hr/recruitment/candidates", "06-candidates.png"],
    ["/hr/recruitment/interviews", "06-interviews.png"],
    ["/hr/recruitment/offers", "06-offers.png"],
    ["/hr/onboarding-templates", "07-onboarding-templates.png"],
    ["/hr/employee-onboarding", "07-employee-onboarding.png"],
    ["/hr/employee-document-categories", "08-doc-categories.png"],
    ["/office-finance", "14-finance.png"],
    ["/office-finance/setup", "14-finance-setup.png"],
    ["/office-finance/transactions", "14-transactions.png"],
    ["/office-finance/reports", "14-finance-reports.png"],
    ["/team/timesheets", "13-team-timesheets.png"],
    ["/admin/operations/delivery", "16-delivery.png"],
    ["/admin/operations/delivery/dead-letters", "16-dead-letters.png"],
    ["/administration/operations/files", "16-files.png"],
    ["/settings/security/document-retention", "16-retention.png"],
  ];

  for (const [href, file] of shots) {
    await captureHref(page, href, file);
  }

  try {
    if (pageState(await page.locator("body").innerText()) === "404") {
      await goHome(page);
    }
    await captureHref(
      page,
      "/administration/business-calendar",
      "05-business-calendar.png",
    );
    const preview = page.getByRole("link", { name: "Calendar Preview" }).first();
    if (await preview.count()) {
      await preview.click();
      const status = await waitReady(page);
      if (status === "ok") await shot(page, "05-calendar-preview.png");
      else {
        console.log(`skip 05-calendar-preview.png: ${status}`);
        await goHome(page);
      }
    }
  } catch (error) {
    console.log(`skip 05-calendar-preview.png: ${error.message.split("\n")[0]}`);
  }

  await page.close();
  await captureHub(browser);
  await browser.close();
  console.log("pass3 done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
