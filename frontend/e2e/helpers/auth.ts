import type { Page } from "@playwright/test";
import { request, type APIRequestContext } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4500";
const accessTokens = new WeakMap<Page, string>();

export function getE2eCredentials() {
  const email = process.env.E2E_MAKER_EMAIL?.trim();
  const password = process.env.E2E_MAKER_PASSWORD?.trim();
  return {
    email,
    password,
    configured: Boolean(email && password),
  };
}

export function requireE2eCredentials() {
  const credentials = getE2eCredentials();
  if (!credentials.configured || !credentials.email || !credentials.password) {
    throw new Error(
      "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for authenticated e2e."
    );
  }
  return { email: credentials.email, password: credentials.password };
}

export const TEST_OWNER = {
  get email() {
    return getE2eCredentials().email ?? "";
  },
  get password() {
    return getE2eCredentials().password ?? "";
  },
};

export async function loginViaApi(
  email?: string,
  password?: string
): Promise<{
  token: string;
  request: APIRequestContext;
  close: () => Promise<void>;
}> {
  const credentials = email && password ? { email, password } : requireE2eCredentials();
  const api = await request.newContext({ baseURL: API_BASE });
  const response = await api.post("/auth/login", {
    data: { identifier: credentials.email, password: credentials.password },
  });
  if (!response.ok()) {
    throw new Error(
      `Login failed for ${credentials.email}: ${response.status()} ${await response.text()}`
    );
  }
  const body = await response.json();
  const token = body.data?.accessToken as string;
  if (!token) {
    throw new Error(`Login response missing accessToken for ${credentials.email}`);
  }

  let closed = false;
  return {
    token,
    request: api,
    close: async () => {
      if (closed) return;
      closed = true;

      try {
        const logoutResponse = await api.post("/auth/logout", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (logoutResponse.status() !== 204 && logoutResponse.status() !== 401) {
          throw new Error(
            `E2E API logout failed: ${logoutResponse.status()} ${await logoutResponse.text()}`
          );
        }
      } finally {
        await api.dispose();
      }
    },
  };
}

/**
 * Authenticates through the real login screen. This keeps the browser's
 * in-memory access token and refresh-cookie lifecycle in the same flow the
 * product uses, instead of relying on APIRequestContext cookie propagation
 * through the Next.js rewrite.
 */
export async function loginViaUi(page: Page, email?: string, password?: string) {
  const credentials = email && password ? { email, password } : requireE2eCredentials();

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username or email" }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);

  // The dashboard shell uses this request to resolve capability-gated menu
  // entries. Start observing it before sign-in so callers do not inspect the
  // temporary, baseline-only sidebar while the real role menu is still loading.
  // A password-change route intentionally has no dashboard shell, so that
  // branch does not require the request to occur.
  const moduleCapabilitiesResponse = page
    .waitForResponse(
      (candidate) => {
        try {
          return (
            new URL(candidate.url()).pathname === "/api/me/module-capabilities" &&
            candidate.request().method() === "GET"
          );
        } catch {
          return false;
        }
      },
      { timeout: 60_000 }
    )
    .catch(() => null);

  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST",
    { timeout: 60_000 }
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await responsePromise;

  if (!response.ok()) {
    const detail = await response.text();
    throw new Error(`Login failed for ${credentials.email}: ${response.status()} ${detail}`);
  }

  const body = await response.json();
  const token = body.data?.accessToken as string | undefined;
  if (!token) {
    throw new Error(`Login response missing accessToken for ${credentials.email}`);
  }
  accessTokens.set(page, token);

  await page.waitForURL(/\/(dashboard|my-workspace|change-password)/, {
    timeout: 60_000,
  });
  if (!new URL(page.url()).pathname.includes("/change-password")) {
    await page
      .getByRole("button", { name: "Open account menu" })
      .waitFor({ state: "visible", timeout: 60_000 });

    const capabilityResponse = await moduleCapabilitiesResponse;
    if (!capabilityResponse) {
      throw new Error("Timed out waiting for the authenticated module capability response.");
    }
    if (!capabilityResponse.ok()) {
      throw new Error(
        `Authenticated module capability request failed: ${capabilityResponse.status()}`
      );
    }
  }
}

export async function logoutViaUi(page: Page): Promise<void> {
  let token = accessTokens.get(page);
  if (!token) return;

  const refreshResponse = await page.request.post("/api/auth/refresh", {
    data: {},
  });
  if (refreshResponse.ok()) {
    const body = await refreshResponse.json();
    token = (body.data?.accessToken as string | undefined) ?? token;
  }

  const response = await page.request.post("/api/auth/logout", {
    headers: { Authorization: `Bearer ${token}` },
  });
  accessTokens.delete(page);
  await page.context().clearCookies();

  if (response.status() !== 204 && response.status() !== 401) {
    throw new Error(`E2E logout failed: ${response.status()} ${await response.text()}`);
  }
}
