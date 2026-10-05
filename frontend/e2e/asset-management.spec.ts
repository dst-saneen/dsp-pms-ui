import { test, expect } from "@playwright/test";

import { getE2eCredentials, loginViaUi, logoutViaUi } from "./helpers/auth";

const credentials = getE2eCredentials();

test.describe("Asset management shell", () => {
  test.skip(
    !credentials.configured,
    "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated Asset e2e."
  );

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });
  test.afterEach(async ({ page }) => {
    await logoutViaUi(page);
  });

  test("loads the assets workspace", async ({ page }) => {
    await page.goto("/asset-management/assets");
    await expect(page).toHaveURL(/\/asset-management\/assets/);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assets", exact: true })).toBeVisible();
    await expect(page.getByText(/Sign in|Welcome back|not enabled/i)).toHaveCount(0);
  });

  test("loads licences workspace with pool selector", async ({ page }) => {
    await page.goto("/asset-management/licenses");
    await expect(page.getByRole("heading", { name: "Licences", exact: true })).toBeVisible();
    await expect(page.getByText(/Sign in|Welcome back|not enabled/i)).toHaveCount(0);
    const poolSelect = page.locator("select").first();
    if (await poolSelect.isVisible()) {
      await expect(poolSelect).toContainText(/Licence pool/i);
    }
  });

  test("exposes transfer, grant, and waiver routes", async ({ page }) => {
    await page.goto("/asset-management/transfers", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Ownership transfers", exact: true })
    ).toBeVisible();
    await page.goto("/asset-management/department-grants", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Department grants", exact: true })
    ).toBeVisible();
    await page.goto("/asset-management/waivers", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Clearance waivers", exact: true })
    ).toBeVisible();
    await expect(page.getByText(/Sign in|Welcome back|not enabled/i)).toHaveCount(0);
  });
});
