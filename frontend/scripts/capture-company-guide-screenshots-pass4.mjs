/**
 * Capture Apply leave sheet from My calendar (nested apply URL 404s in Turbopack).
 * Run from frontend/: node scripts/capture-company-guide-screenshots-pass4.mjs
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
  await page.waitForTimeout(1500);

  const nav = page.locator('nav[aria-label="Main navigation"]').last();
  const workspace = nav.getByRole("button", { name: "My Workspace", exact: true });
  if ((await workspace.getAttribute("aria-expanded")) !== "true") {
    await workspace.click();
    await page.waitForTimeout(300);
  }
  await nav.locator('a[href="/my-workspace/calendar"]').click();
  await page.getByRole("heading", { name: "My calendar" }).waitFor();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Apply leave" }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(OUT, "17-apply-leave.png"),
    fullPage: true,
  });
  console.log(`saved 17-apply-leave.png ${page.url()}`);
  await browser.close();
  console.log("pass4 done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
