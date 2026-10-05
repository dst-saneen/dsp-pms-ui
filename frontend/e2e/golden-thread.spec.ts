import { expect, test } from "@playwright/test";

import { getE2eCredentials, loginViaUi, logoutViaUi } from "./helpers/auth";

const credentials = getE2eCredentials();

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

test.describe("Authenticated golden-thread surfaces", () => {
  test.skip(
    !credentials.configured,
    "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated e2e."
  );
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });
  test.afterEach(async ({ page }) => {
    await logoutViaUi(page);
  });

  test("dashboard loads for organization owner", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("office finance transactions page loads", async ({ page }) => {
    await page.goto("/office-finance/transactions");
    await expect(page).toHaveURL(/\/office-finance\/transactions/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("payroll workspace loads", async ({ page }) => {
    await page.goto("/hr/payroll");
    await expect(page).toHaveURL(/\/hr\/payroll/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("my workspace loads with employee context", async ({ page }) => {
    await page.goto("/my-workspace");
    await expect(page).toHaveURL(/\/my-workspace/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("recruitment dashboard loads", async ({ page }) => {
    await page.goto("/hr/recruitment");
    await expect(page).toHaveURL(/\/hr\/recruitment/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
  });
});

test("owner test account is configured", () => {
  test.skip(
    !credentials.configured,
    "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated e2e."
  );
  expect(credentials.email).toContain("@");
});
