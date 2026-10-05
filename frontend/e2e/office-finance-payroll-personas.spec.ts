import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { getE2eCredentials, loginViaUi, logoutViaUi } from "./helpers/auth";

const credentials = getE2eCredentials();
const mutationsEnabled = process.env.PLAYWRIGHT_LIVE_MUTATIONS === "true";
const financeMutationConfirmation =
  process.env.PLAYWRIGHT_FINANCE_MUTATION_CONFIRMATION?.trim();
const expectedFinanceMutationConfirmation =
  "RUN-FINANCE-TRANSACTION:dsp_erp_dev:dsp_pms_stg";
const referencePersonaPassword =
  process.env.QA_REFERENCE_PERSONA_PASSWORD?.trim() ||
  process.env.E2E_MAKER_PASSWORD?.trim();
const financeMakerEmail =
  process.env.E2E_QA_FINANCE_MAKER_EMAIL?.trim() ||
  "qa+india-finance-maker@dsp-reference.invalid";
const financeApproverEmail =
  process.env.E2E_QA_FINANCE_APPROVER_EMAIL?.trim() ||
  "qa+india-approver@dsp-reference.invalid";

type FinanceTransactionResponse = {
  data?: {
    id?: string;
    companyId?: string;
    status?: string;
    version?: number;
    reversedByTransactionId?: string | null;
  };
};

type FinanceQaRunManifest = {
  manifestVersion: 1;
  runId: string;
  suite: "finance-maker-checker-reversal";
  target: {
    databaseName: "dsp_erp_dev";
    databaseSchema: "dsp_pms_stg";
  };
  status: "IN_PROGRESS" | "COMPLETE";
  terminalState: "REVERSED" | null;
  createdRecords: Array<{
    entityType: "FinanceTransaction" | "FinanceTransactionReversal";
    id: string;
    companyId: string | null;
  }>;
};

function qaRunId(now = new Date()): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `QA-FINANCE-${timestamp}-${nonce}`;
}

function isFinanceTransactionResponse(response: URL, method: string, suffix = "") {
  return (
    response.pathname.endsWith(`/office-finance/transactions${suffix}`) &&
    method === "POST"
  );
}

async function responseBody(response: import("@playwright/test").Response) {
  const body = (await response.json()) as FinanceTransactionResponse;
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function persistFinanceQaRunManifest(manifest: FinanceQaRunManifest): Promise<string> {
  const manifestDirectory = process.env.QA_RUN_MANIFEST_DIR?.trim();
  if (!manifestDirectory) {
    throw new Error(
      "QA_RUN_MANIFEST_DIR must be supplied by the guarded staging runner for Finance mutations."
    );
  }

  const manifestPath = join(
    manifestDirectory,
    `finance-transaction-${manifest.runId}.json`
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

test.describe("Office Finance and Payroll production flow", () => {
  test.skip(
    !credentials.configured,
    "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated Finance/Payroll e2e."
  );
  test.setTimeout(90_000);

  test.afterEach(async ({ page }) => {
    await logoutViaUi(page);
  });

  test("authenticated Finance setup is reachable", async ({
    page,
  }) => {
    await loginViaUi(page);
    await page.goto("/office-finance/setup");
    await expect(page).toHaveURL(/\/office-finance\/setup/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Profile/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create profile|Save profile/i })).toBeVisible();
    await expect(page.getByText(/Sign in|Welcome back/i)).toHaveCount(0);
  });

  test("authenticated Payroll workspace is reachable", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/hr/payroll");
    await expect(page).toHaveURL(/\/hr\/payroll/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
    // On a narrow viewport the sidebar's Payroll group label remains in the
    // DOM but is intentionally hidden. Scope this assertion to the rendered
    // work surface so the test proves the page heading/content, not a hidden
    // navigation label.
    await expect(page.getByRole("main").getByText(/Payroll/i).first()).toBeVisible();
    await expect(page.getByText(/Sign in|Welcome back/i)).toHaveCount(0);
  });

  test("authenticated My workspace payslips surface is reachable", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/my-workspace");
    await expect(page).toHaveURL(/\/my-workspace/, { timeout: 20_000 });
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/Payslips|My workspace/i).first()).toBeVisible();
    await expect(page.getByText(/Sign in|Welcome back/i)).toHaveCount(0);
  });

  test("Finance maker and independent approver complete the UI lifecycle to reversal", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The run-owned Finance mutation executes once in the desktop Chromium project."
    );
    test.skip(
      !mutationsEnabled,
      "Set PLAYWRIGHT_LIVE_MUTATIONS=true only through the guarded staging runner."
    );
    test.skip(
      financeMutationConfirmation !== expectedFinanceMutationConfirmation,
      "The exact dsp_pms_stg Finance mutation confirmation is required."
    );
    test.skip(
      !referencePersonaPassword,
      "QA_REFERENCE_PERSONA_PASSWORD or E2E_MAKER_PASSWORD is required."
    );
    test.skip(
      !process.env.QA_RUN_MANIFEST_DIR?.trim(),
      "QA_RUN_MANIFEST_DIR is required so every staging mutation has durable evidence."
    );

    const runId = qaRunId();
    const description = `${runId} maker-checker reversal`;
    const password = referencePersonaPassword as string;

    await loginViaUi(page, financeMakerEmail, password);
    await page.goto("/office-finance/transactions");
    await expect(page.getByRole("button", { name: "New transaction", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "New transaction", exact: true }).click();

    const createDialog = page.getByRole("dialog", { name: "New transaction" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Date", { exact: true }).fill("2026-09-21");
    await createDialog.getByLabel("Amount", { exact: true }).fill("10.00");
    await createDialog.getByLabel("Category", { exact: true }).click();
    await page.getByRole("option", { name: "Operating Expense QA", exact: true }).click();
    await createDialog.getByLabel("Source account", { exact: true }).click();
    await page.getByRole("option", { name: "Petty Cash QA", exact: true }).click();
    await createDialog.getByLabel("Customer / vendor", { exact: true }).click();
    await page
      .getByRole("option", { name: "Office Supplies Vendor QA (VENDOR)", exact: true })
      .click();
    await createDialog.getByLabel("Description", { exact: true }).fill(description);

    const createResponsePromise = page.waitForResponse((response) =>
      isFinanceTransactionResponse(new URL(response.url()), response.request().method())
    );
    await createDialog.getByRole("button", { name: "Create", exact: true }).click();
    const createdBody = await responseBody(await createResponsePromise);
    const transactionId = createdBody.data?.id;
    if (!transactionId) {
      throw new Error("The created Finance transaction response did not include an ID.");
    }
    const manifest: FinanceQaRunManifest = {
      manifestVersion: 1,
      runId,
      suite: "finance-maker-checker-reversal",
      target: {
        databaseName: "dsp_erp_dev",
        databaseSchema: "dsp_pms_stg",
      },
      status: "IN_PROGRESS",
      terminalState: null,
      createdRecords: [
        {
          entityType: "FinanceTransaction",
          id: transactionId,
          companyId: createdBody.data?.companyId ?? null,
        },
      ],
    };
    const manifestPath = await persistFinanceQaRunManifest(manifest);
    testInfo.annotations.push({ type: "qa-run-manifest", description: manifestPath });

    await expect(page).toHaveURL(new RegExp(`/office-finance/transactions/${transactionId}$`));
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const submitDialog = page.getByRole("dialog", { name: "Submit transaction" });
    await expect(submitDialog).toBeVisible();
    const submitResponsePromise = page.waitForResponse((response) =>
      isFinanceTransactionResponse(
        new URL(response.url()),
        response.request().method(),
        `/${transactionId}/submit`
      )
    );
    await submitDialog.getByRole("button", { name: "Submit", exact: true }).click();
    await responseBody(await submitResponsePromise);
    await expect(page.getByText("SUBMITTED", { exact: true })).toBeVisible();
    await expect(page.getByText("SUBMIT", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

    await logoutViaUi(page);
    await loginViaUi(page, financeApproverEmail, password);
    await page.goto(`/office-finance/transactions/${transactionId}`);
    await expect(page.getByText(description, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    const approveDialog = page.getByRole("dialog", { name: "Approve transaction" });
    await expect(approveDialog).toBeVisible();
    const approveResponsePromise = page.waitForResponse((response) =>
      isFinanceTransactionResponse(
        new URL(response.url()),
        response.request().method(),
        `/${transactionId}/approve`
      )
    );
    await approveDialog.getByRole("button", { name: "Approve", exact: true }).click();
    await responseBody(await approveResponsePromise);
    await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
    await expect(page.getByText("APPROVE", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Reverse", exact: true }).click();
    const reverseDialog = page.getByRole("dialog", { name: "Reverse transaction" });
    await expect(reverseDialog).toBeVisible();
    await reverseDialog.getByLabel("Reason", { exact: true }).fill(`${runId} verified reversal`);
    const reverseResponsePromise = page.waitForResponse((response) =>
      isFinanceTransactionResponse(
        new URL(response.url()),
        response.request().method(),
        `/${transactionId}/reverse`
      )
    );
    await reverseDialog.getByRole("button", { name: "Reverse", exact: true }).click();
    const reversedBody = await responseBody(await reverseResponsePromise);
    const reversalTransactionId = reversedBody.data?.reversedByTransactionId;

    if (!reversalTransactionId) {
      throw new Error("The reversal response did not include the reversal transaction ID.");
    }
    await expect(page.getByText("REVERSED", { exact: true })).toBeVisible();
    await expect(page.getByText("REVERSE", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: reversalTransactionId as string })).toBeVisible();

    manifest.createdRecords.push({
      entityType: "FinanceTransactionReversal",
      id: reversalTransactionId,
      companyId: createdBody.data?.companyId ?? null,
    });
    manifest.status = "COMPLETE";
    manifest.terminalState = "REVERSED";
    await persistFinanceQaRunManifest(manifest);
  });
});
