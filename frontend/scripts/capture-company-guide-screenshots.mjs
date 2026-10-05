/**
 * Capture beginner-guide screenshots from the local app.
 * Run from frontend/: node scripts/capture-company-guide-screenshots.mjs
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
const stamp = Date.now();
const OWNER_EMAIL = `northstar.owner.${stamp}@example.test`;
const OWNER_PASSWORD = requireGuideCredential("GUIDE_OWNER_PASSWORD");
const FALLBACK_EMAIL = requireGuideCredential("GUIDE_FALLBACK_EMAIL");
const FALLBACK_PASSWORD = requireGuideCredential("GUIDE_FALLBACK_PASSWORD");

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${name}`);
}

async function readDevOtp(page) {
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll("p")].find((el) =>
      el.textContent?.includes("Development verification code"),
    );
    const code = heading?.nextElementSibling?.textContent?.replace(/\D/g, "");
    return code && code.length === 6 ? code : "";
  });
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
  const first = page.getByLabel("Digit 1 of 6");
  await first.click();
  await page.keyboard.type(code, { delay: 40 });
}

async function captureListThenCreate(page, listPath, buttonName, listFile, formFile) {
  try {
    await gotoLogged(page, listPath);
    await shot(page, listFile);
    const button = page.getByRole("button", { name: buttonName }).first();
    if ((await button.count()) === 0) {
      console.log(`skip ${formFile}: no ${buttonName}`);
      return;
    }
    await button.click();
    await page.waitForTimeout(1200);
    if (page.url().includes("/login")) {
      console.log(`skip ${formFile}: redirected to login`);
      return;
    }
    await shot(page, formFile);
  } catch (error) {
    console.log(`skip ${formFile}: ${error.message}`);
  }
}

async function fillIfExists(page, selector, value) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return false;
  await loc.fill(value);
  return true;
}

async function clickIfVisible(page, nameOrText) {
  const loc = page.getByRole("button", { name: nameOrText }).first();
  if ((await loc.count()) === 0) return false;
  if (!(await loc.isVisible().catch(() => false))) return false;
  await loc.click();
  return true;
}

async function gotoLogged(page, href) {
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#identifier").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login"),
    { timeout: 20_000 },
  );
}

async function captureAdminPages(page) {
  await gotoLogged(page, "/dashboard");
  await shot(page, "01-dashboard.png");
  await gotoLogged(page, "/administration/company-groups");
  await shot(page, "02-company-groups.png");
  await captureListThenCreate(
    page,
    "/administration/companies",
    "Add Company",
    "02-companies.png",
    "02-company-new.png",
  );
  await captureListThenCreate(
    page,
    "/administration/branches",
    "Add Branch",
    "02-branches.png",
    "02-branch-new.png",
  );
  await captureListThenCreate(
    page,
    "/administration/departments",
    "New Department",
    "02-departments.png",
    "02-department-new.png",
  );
  await captureListThenCreate(
    page,
    "/administration/designations",
    "New Designation",
    "02-designations.png",
    "02-designation-new.png",
  );
  await captureListThenCreate(
    page,
    "/administration/shifts",
    "New Shift",
    "02-shifts.png",
    "02-shift-new.png",
  );
  await captureListThenCreate(
    page,
    "/hr/employees",
    "Add Employee",
    "04-employees.png",
    "04-employee-new.png",
  );
  await captureListThenCreate(
    page,
    "/administration/users",
    "Add user",
    "03-users.png",
    "03-invite-user.png",
  );
  await gotoLogged(page, "/administration/security");
  await shot(page, "03-roles.png");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15_000);

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(page, "01-login.png");
  await page.locator("#identifier").fill("priya.owner@northstar.example");
  await shot(page, "01-login-filled.png");

  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await shot(page, "01-register.png");
  await page.locator("#organization-name").fill("Northstar Labs");
  await page.locator("#display-name").fill("Priya Owner");
  await page.locator("#registration-email").fill(OWNER_EMAIL);
  await page.locator("#registration-password").fill(OWNER_PASSWORD);
  await page.locator("#confirm-password").fill(OWNER_PASSWORD);
  await shot(page, "01-register-filled.png");

  let registered = false;
  try {
    await page.getByRole("button", { name: "Send verification code" }).click();
    await page
      .getByRole("button", { name: "Verify and continue" })
      .waitFor({ timeout: 12_000 });
    const otp = await readDevOtp(page);
    if (otp) await typeOtp(page, otp);
    await hideDevOtp(page);
    await shot(page, "01-verify-email.png");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await page.waitForURL("**/onboarding", { timeout: 20_000 });
    registered = true;
    await page.waitForTimeout(800);
    await shot(page, "01-onboarding-hub.png");

    if (await clickIfVisible(page, "Confirm branch")) {
      await page.locator("#hub-branch-name").fill("Kochi Head Office");
      await fillIfExists(page, "#hub-branch-address", "42 Infopark Road");
      await fillIfExists(page, "#hub-branch-city", "Kochi");
      await fillIfExists(page, "#hub-branch-country", "IN");
      await shot(page, "01-confirm-branch-dialog.png");
      await page.getByRole("button", { name: "Save branch" }).click();
      await page.waitForTimeout(800);
    }

    if (await clickIfVisible(page, "Add department")) {
      const dept = page.locator("#hub-department-name, input[id*='department']").first();
      if (await dept.count()) await dept.fill("Human Resources");
      await shot(page, "01-add-department-dialog.png");
      await page.getByRole("button", { name: /Save department|Add department/i }).click();
      await page.waitForTimeout(800);
    }

    await shot(page, "01-onboarding-ready.png");

    const openWorkspace = page.getByRole("button", { name: "Open my workspace" });
    if (await openWorkspace.isEnabled()) {
      await openWorkspace.click();
      await page.waitForURL((url) => !url.pathname.startsWith("/onboarding"), {
        timeout: 20_000,
      });
    }

    await captureAdminPages(page);
  } catch (error) {
    console.log(`register path stopped: ${error.message}`);
  }

  if (!registered) {
    try {
      await login(page, FALLBACK_EMAIL, FALLBACK_PASSWORD);
      await shot(page, "01-dashboard.png");
      await captureAdminPages(page);
    } catch (error) {
      console.log(`fallback login skipped: ${error.message}`);
    }
  }

  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
