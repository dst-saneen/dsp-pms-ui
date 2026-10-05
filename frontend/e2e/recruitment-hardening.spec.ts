import { test, expect } from "@playwright/test";

import { MOCK_OFFER_RESPONSE } from "./helpers/mock-offer-response-seed";
import {
  stubInvalidOfferInspection,
  stubValidOfferInspection,
} from "./helpers/offer-response-routes";
import { getE2eCredentials, loginViaUi, logoutViaUi } from "./helpers/auth";

const credentials = getE2eCredentials();

test.describe("Recruitment shell", () => {
  test.skip(
    !credentials.configured,
    "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated Recruitment e2e."
  );

  test("loads recruitment route when the backend capability is available", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/hr/recruitment");
    await expect(page).toHaveURL(/\/hr\/recruitment/);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recruitment", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(/This module is not configured|Sign in|Welcome back/i),
    ).toHaveCount(0);
  });

  test.afterEach(async ({ page }) => {
    await logoutViaUi(page);
  });
});

test.describe("Public offer response", () => {
  test("shows safe invalid state when token is missing", async ({ page }) => {
    await page.goto("/offer-response");
    await expect(page.getByText("Invalid link")).toBeVisible();
    await expect(
      page.getByText("This offer response link is missing required information.")
    ).toBeVisible();
  });

  test("shows safe invalid state for unknown token", async ({ page }) => {
    await stubInvalidOfferInspection(page);
    await page.goto("/offer-response?token=unknown-token-value");
    await expect(page.getByText("Invalid link")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/invalid or has already been used|invalid or expired/i)
    ).toBeVisible();
  });

  test("does not persist raw token in browser storage", async ({ page }) => {
    await page.goto("/offer-response?token=ephemeral-token-value");

    const persistedToken = await page.evaluate(() => {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        const value = key ? window.localStorage.getItem(key) : null;
        if (value?.includes("ephemeral-token-value")) return true;
      }
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        const value = key ? window.sessionStorage.getItem(key) : null;
        if (value?.includes("ephemeral-token-value")) return true;
      }
      return false;
    });

    expect(persistedToken).toBe(false);
  });

  test("renders a valid mock offer for seeded token", async ({ page }) => {
    await stubValidOfferInspection(page);
    await page.goto(`/offer-response?token=${MOCK_OFFER_RESPONSE.token}`);

    await expect(page.getByRole("heading", { name: "Review your offer" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Offer details", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept offer" })).toBeVisible();
  });
});

test.describe("Public careers", () => {
  test("shows an explicit not-found state for an unknown company", async ({ page }) => {
    await page.goto("/careers/demo-company");
    await expect(page.getByText(/Careers page not found/i)).toBeVisible();
  });
});

test.describe("Employee entry hardening", () => {
  test.skip(
    !credentials.configured,
    "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated Employee e2e."
  );

  test("opens the authenticated add employee form", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/hr/employees/new");
    await expect(page).toHaveURL(/\/hr\/employees\/new/);
    await expect(page.getByText(/Add Employee|First Name/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Sign in|Welcome back|Cannot add employees/i)).toHaveCount(0);
  });

  test.afterEach(async ({ page }) => {
    await logoutViaUi(page);
  });
});
