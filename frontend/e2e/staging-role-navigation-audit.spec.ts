import {
  expect,
  test,
  type Locator,
  type Page,
  type Response,
  type Route,
  type TestInfo,
} from "@playwright/test";

import { loginViaUi, logoutViaUi } from "./helpers/auth";

/**
 * This audit is deliberately limited to the reference personas provisioned by
 * backend/scripts/qa/reference-data-contract.ts. The runner supplies the
 * staging origin and the shared reference-persona password; this file never
 * logs either credential value or falls back to a local account.
 */
const stagingBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const qaPersonaPassword =
  process.env.QA_REFERENCE_PERSONA_PASSWORD?.trim() ||
  process.env.E2E_MAKER_PASSWORD?.trim();
const READ_ONLY_REQUEST_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ROUTE_TIMEOUT_MS = 15_000;

type QaPersona = {
  name: string;
  email: string;
  requiredSidebarHrefs: readonly string[];
  forbiddenSidebarHrefs: readonly string[];
  forbiddenDashboardHrefs?: readonly string[];
  allowedRoutes: readonly string[];
  forbiddenRoutes: readonly string[];
};

type SidebarLink = {
  href: string;
  label: string;
};

type RouteDiagnostic = {
  requestedPath: string;
  documentStatus: number | null;
  finalPath: string;
  hasMain: boolean;
  denial: string | undefined;
  authenticationScreen: boolean;
  navigationFailed: boolean;
};

type SafePresentationControl = {
  kind: "tab" | "disclosure";
  label: string;
  state: string | null;
};

const ACCESS_DENIAL_STATES: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "generic access denial", pattern: /you do not have access/i },
  { label: "module permission denial", pattern: /you do not have permission to access this module/i },
  { label: "module unavailable", pattern: /is unavailable for this company or your role/i },
  { label: "module disabled", pattern: /this module is not enabled for the active company and branch/i },
  { label: "cannot invite users", pattern: /cannot invite users/i },
  { label: "cannot add employees", pattern: /cannot add employees/i },
  { label: "cannot create roles", pattern: /cannot create roles/i },
];

const UNSAFE_PRESENTATION_CONTROL_NAME =
  /\b(?:add|apply|approve|archive|assign|cancel|clear|complete|confirm|create|delete|edit|generate|import|invite|manage|new|pay|process|publish|remove|save|send|submit|transfer|update|upload|waive)\b/i;

const AUDITABLE_CONTROL_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='combobox']",
].join(", ");

const REFERENCE_EMAILS = {
  employee: "qa+india-employee@dsp-reference.invalid",
  hr: "qa+india-hr@dsp-reference.invalid",
  projectManager: "qa+india-project-manager@dsp-reference.invalid",
  assetManager: "qa+india-asset-manager@dsp-reference.invalid",
  assetCustodian: "qa+india-asset-custodian@dsp-reference.invalid",
  financeMaker: "qa+india-finance-maker@dsp-reference.invalid",
  payrollMaker: "qa+india-payroll-maker@dsp-reference.invalid",
  readOnlyAuditor: "qa+india-auditor@dsp-reference.invalid",
  companyAdmin: "qa+india-admin@dsp-reference.invalid",
  disabled: "qa+india-disabled@dsp-reference.invalid",
} as const;

function qaEmail(environmentVariable: string, referenceEmail: string): string {
  return process.env[environmentVariable]?.trim() || referenceEmail;
}

/**
 * The reference Company Administrator is expected on the normal seeded QA
 * target. A runner can explicitly set this optional variable to an empty
 * value when that persona is intentionally not provisioned.
 */
function optionalQaEmail(environmentVariable: string, referenceEmail: string): string | undefined {
  const configured = process.env[environmentVariable];
  return configured === undefined ? referenceEmail : configured.trim() || undefined;
}

const companyAdminEmail = optionalQaEmail(
  "E2E_QA_COMPANY_ADMIN_EMAIL",
  REFERENCE_EMAILS.companyAdmin
);

/**
 * These narrow menu expectations are grounded in the reference role contract
 * and frontend/config/navigation.ts. Capability-gated entries are intentionally
 * not skipped: a missing entry for a role that owns the relevant permission is
 * the staging evidence this audit is meant to surface.
 */
const personas: QaPersona[] = [
  {
    name: "Employee",
    email: qaEmail("E2E_QA_EMPLOYEE_EMAIL", REFERENCE_EMAILS.employee),
    requiredSidebarHrefs: [
      "/dashboard",
      "/my-workspace",
      "/my-workspace/calendar",
      "/my-workspace/leave",
      "/my-workspace/hr-requests",
      "/my-workspace/approvals",
    ],
    forbiddenSidebarHrefs: [
      "/hr/employees",
      "/office-finance/transactions",
      "/asset-management/assets",
      "/hr/payroll",
      "/administration/users",
    ],
    allowedRoutes: ["/my-workspace", "/my-workspace/calendar"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "HR",
    email: qaEmail("E2E_QA_HR_EMAIL", REFERENCE_EMAILS.hr),
    requiredSidebarHrefs: ["/dashboard", "/my-workspace", "/hr/employees", "/hr/attendance"],
    forbiddenSidebarHrefs: ["/administration/users"],
    allowedRoutes: ["/hr/employees", "/hr/attendance"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "Project Manager",
    email: qaEmail("E2E_QA_PROJECT_MANAGER_EMAIL", REFERENCE_EMAILS.projectManager),
    requiredSidebarHrefs: [
      "/dashboard",
      "/my-workspace",
      "/projects/projects",
      "/team/timesheets",
    ],
    forbiddenSidebarHrefs: [
      "/office-finance/transactions",
      "/asset-management/assets",
      "/hr/payroll",
      "/administration/users",
    ],
    allowedRoutes: ["/projects/projects", "/team/timesheets"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "Asset Manager",
    email: qaEmail("E2E_QA_ASSET_MANAGER_EMAIL", REFERENCE_EMAILS.assetManager),
    requiredSidebarHrefs: [
      "/dashboard",
      "/my-workspace",
      "/asset-management/inbox",
      "/asset-management/assets",
    ],
    forbiddenSidebarHrefs: ["/office-finance/transactions", "/hr/payroll", "/administration/users"],
    allowedRoutes: ["/asset-management/assets", "/asset-management/inbox"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "Asset Custodian",
    email: qaEmail("E2E_QA_ASSET_CUSTODIAN_EMAIL", REFERENCE_EMAILS.assetCustodian),
    requiredSidebarHrefs: ["/dashboard", "/my-workspace", "/asset-management/inbox"],
    forbiddenSidebarHrefs: [
      "/office-finance/transactions",
      "/hr/payroll",
      "/administration/users",
    ],
    allowedRoutes: ["/asset-management/inbox"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "Finance Maker",
    email: qaEmail("E2E_QA_FINANCE_MAKER_EMAIL", REFERENCE_EMAILS.financeMaker),
    requiredSidebarHrefs: [
      "/dashboard",
      "/office-finance",
      "/office-finance/transactions",
      "/office-finance/reports",
      "/office-finance/setup",
    ],
    forbiddenSidebarHrefs: [
      "/hr/employees",
      "/projects/projects",
      "/asset-management/assets",
      "/hr/payroll",
      "/administration/users",
    ],
    forbiddenDashboardHrefs: [
      "/hr/employees",
      "/hr/attendance",
      "/hr/leave/calendar",
      "/hr/employee-onboarding",
    ],
    allowedRoutes: ["/office-finance/transactions", "/office-finance/reports"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "Payroll Maker",
    email: qaEmail("E2E_QA_PAYROLL_MAKER_EMAIL", REFERENCE_EMAILS.payrollMaker),
    requiredSidebarHrefs: ["/dashboard", "/hr/payroll"],
    forbiddenSidebarHrefs: [
      "/hr/employees",
      "/projects/projects",
      "/asset-management/assets",
      "/office-finance/transactions",
      "/administration/users",
    ],
    allowedRoutes: ["/hr/payroll"],
    forbiddenRoutes: ["/administration/users/new"],
  },
  {
    name: "Read-only Auditor",
    email: qaEmail("E2E_QA_READ_ONLY_AUDITOR_EMAIL", REFERENCE_EMAILS.readOnlyAuditor),
    requiredSidebarHrefs: [
      "/dashboard",
      "/hr/employees",
      "/office-finance/transactions",
      "/asset-management/assets",
      "/hr/payroll",
      "/administration/users",
      "/administration/security",
    ],
    forbiddenSidebarHrefs: ["/my-workspace", "/team/timesheets"],
    allowedRoutes: ["/administration/users", "/office-finance/reports"],
    forbiddenRoutes: ["/administration/users/new"],
  },
];

if (companyAdminEmail) {
  personas.push({
    name: "Company Admin",
    email: companyAdminEmail,
    requiredSidebarHrefs: [
      "/dashboard",
      "/my-workspace",
      "/administration/users",
      "/administration/security",
      "/asset-management/assets",
    ],
    forbiddenSidebarHrefs: ["/administration/company-groups"],
    allowedRoutes: ["/administration/users", "/administration/security"],
    forbiddenRoutes: [],
  });
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? pathname;
  const normalized = withoutQuery.replace(/\/+$/, "");
  return normalized || "/";
}

function pathnameFromUrl(url: string): string {
  try {
    return normalizePathname(new URL(url).pathname);
  } catch {
    return normalizePathname(url);
  }
}

function isAuthenticationPath(pathname: string): boolean {
  return ["/login", "/register", "/change-password"].includes(normalizePathname(pathname));
}

function passwordForQaPersona(): string {
  if (!qaPersonaPassword) {
    throw new Error(
      "QA_REFERENCE_PERSONA_PASSWORD or E2E_MAKER_PASSWORD is required for the staging role audit."
    );
  }
  return qaPersonaPassword;
}

function requestDescription(method: string, requestUrl: string): string {
  try {
    return `${method.toUpperCase()} ${new URL(requestUrl).pathname}`;
  } catch {
    return `${method.toUpperCase()} [unparseable-url]`;
  }
}

function isSameOriginAuthRefresh(pageUrl: string, method: string, requestUrl: string): boolean {
  if (method.toUpperCase() !== "POST") return false;

  try {
    const pageOrigin = new URL(pageUrl).origin;
    const target = new URL(requestUrl);
    return (
      pageOrigin !== "null" &&
      target.origin === pageOrigin &&
      target.pathname === "/api/auth/refresh" &&
      !target.search &&
      !target.hash
    );
  } catch {
    return false;
  }
}

async function installNoBusinessWritesGuard(page: Page): Promise<{
  blockedRequests: string[];
  dispose: () => Promise<void>;
}> {
  const blockedRequests: string[] = [];
  const handler = async (route: Route) => {
    const request = route.request();
    const method = request.method();

    if (
      READ_ONLY_REQUEST_METHODS.has(method.toUpperCase()) ||
      isSameOriginAuthRefresh(page.url(), method, request.url())
    ) {
      await route.continue();
      return;
    }

    blockedRequests.push(requestDescription(method, request.url()));
    await route.abort("blockedbyclient");
  };

  await page.route("**/*", handler);

  return {
    blockedRequests,
    dispose: async () => {
      await page.unroute("**/*", handler);
    },
  };
}

async function isVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

/**
 * A successful hard navigation creates a new document, so its in-memory
 * access token is restored from the refresh cookie. Do not treat ordinary
 * product language such as "welcome back" (manager dashboard) or "last sign
 * in" (user table) as evidence that that restoration failed. A login screen
 * is the actual, visible credential form.
 */
async function isVisibleLoginForm(page: Page): Promise<boolean> {
  const loginForm = page
    .locator("form")
    .filter({
      has: page.getByRole("textbox", {
        name: "Username or email",
        exact: true,
      }),
    })
    .filter({
      has: page.getByLabel("Password", { exact: true }),
    });

  return isVisible(
    loginForm.getByRole("button", { name: "Sign in", exact: true }),
  );
}

async function findAccessDenial(page: Page): Promise<string | undefined> {
  for (const state of ACCESS_DENIAL_STATES) {
    if (await isVisible(page.getByText(state.pattern).first())) {
      return state.label;
    }
  }
  return undefined;
}

async function waitForRouteSettlement(page: Page): Promise<boolean> {
  // Some routes may intentionally open a modal immediately.
  // Radix marks the underlying main region aria-hidden while the dialog is
  // open, so role lookup would incorrectly report that no app surface exists.
  // Use the semantic element selector here; it still proves the route mounted.
  const main = page.locator("main").first();
  const hasMain = await main
    .waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);

  // Capability and permission gates render a small loading state before their
  // read-only API call resolves. Waiting for it when present makes a missing
  // capability-gated menu/route deterministic without polling the API directly.
  await page
    .getByText(/checking (permissions|module availability)/i)
    .first()
    .waitFor({ state: "hidden", timeout: ROUTE_TIMEOUT_MS })
    .catch(() => undefined);
  await page.waitForTimeout(100);

  return hasMain;
}

async function inspectRoute(page: Page, requestedPath: string): Promise<RouteDiagnostic> {
  let response: Response | null = null;
  try {
    response = await page.goto(requestedPath, {
      waitUntil: "domcontentloaded",
      timeout: ROUTE_TIMEOUT_MS,
    });
  } catch {
    return {
      requestedPath,
      documentStatus: null,
      finalPath: pathnameFromUrl(page.url()),
      hasMain: false,
      denial: undefined,
      authenticationScreen: isAuthenticationPath(pathnameFromUrl(page.url())),
      navigationFailed: true,
    };
  }

  const hasMain = await waitForRouteSettlement(page);
  const finalPath = pathnameFromUrl(page.url());
  const denial = await findAccessDenial(page);
  const authenticationScreen =
    isAuthenticationPath(finalPath) || (await isVisibleLoginForm(page));

  return {
    requestedPath,
    documentStatus: response?.status() ?? null,
    finalPath,
    hasMain,
    denial,
    authenticationScreen,
    navigationFailed: false,
  };
}

function formatRouteDiagnostic(diagnostic: RouteDiagnostic): string {
  return [
    `${diagnostic.requestedPath}`,
    `status=${diagnostic.documentStatus ?? "no-document-response"}`,
    `final=${diagnostic.finalPath}`,
    `main=${diagnostic.hasMain ? "visible" : "missing"}`,
    `denial=${diagnostic.denial ?? "none"}`,
    `authScreen=${diagnostic.authenticationScreen ? "yes" : "no"}`,
    `navigation=${diagnostic.navigationFailed ? "failed" : "ok"}`,
  ].join("; ");
}

function allowedRouteIssue(diagnostic: RouteDiagnostic): string | undefined {
  if (diagnostic.navigationFailed) {
    return `navigation failed (${formatRouteDiagnostic(diagnostic)})`;
  }
  if (diagnostic.finalPath !== normalizePathname(diagnostic.requestedPath)) {
    return `redirected to ${diagnostic.finalPath} (${formatRouteDiagnostic(diagnostic)})`;
  }
  if (!diagnostic.hasMain) {
    return `did not render an authenticated main surface (${formatRouteDiagnostic(diagnostic)})`;
  }
  if (diagnostic.authenticationScreen) {
    return `rendered an authentication screen (${formatRouteDiagnostic(diagnostic)})`;
  }
  if (diagnostic.denial) {
    return `rendered ${diagnostic.denial} (${formatRouteDiagnostic(diagnostic)})`;
  }
  return undefined;
}

function forbiddenRouteIssue(diagnostic: RouteDiagnostic): string | undefined {
  if (diagnostic.navigationFailed) return undefined;
  const redirected = diagnostic.finalPath !== normalizePathname(diagnostic.requestedPath);
  if (redirected || diagnostic.authenticationScreen || diagnostic.denial) return undefined;
  return "rendered without a denial or redirect";
}

async function expandSidebarGroups(page: Page, navigation: Locator): Promise<void> {
  const expandSidebar = page.getByRole("button", { name: "Expand sidebar", exact: true }).first();
  if (await isVisible(expandSidebar)) {
    await expandSidebar.click({ timeout: 3_000 });
  }

  for (let pass = 0; pass < 20; pass += 1) {
    const collapsedGroups = navigation.locator("button[aria-expanded='false']");
    const count = await collapsedGroups.count();
    let expandedAnyGroup = false;

    for (let index = 0; index < count; index += 1) {
      const group = collapsedGroups.nth(index);
      if (!(await isVisible(group))) continue;
      await group.click({ timeout: 3_000 });
      expandedAnyGroup = true;
    }

    if (!expandedAnyGroup) return;
  }
}

async function visibleSidebarLinks(navigation: Locator): Promise<SidebarLink[]> {
  const links = await navigation.locator("a[href]").evaluateAll((anchors) => {
    const normalize = (value: string | null | undefined): string =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element: HTMLElement): boolean => {
      if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        element.getClientRects().length > 0
      );
    };

    return anchors.flatMap((anchor) => {
      if (!(anchor instanceof HTMLAnchorElement) || !visible(anchor)) return [];
      const href = normalize(anchor.getAttribute("href"));
      if (!href.startsWith("/")) return [];
      return [
        {
          href: href.split(/[?#]/, 1)[0] || "/",
          label: normalize(anchor.getAttribute("aria-label")) || normalize(anchor.textContent),
        },
      ];
    });
  });

  return links as SidebarLink[];
}

function formatSidebarLinks(links: readonly SidebarLink[]): string {
  return links.length
    ? links.map((link) => `${link.label || "[unlabelled]"} → ${link.href}`).join(", ")
    : "[no visible sidebar links]";
}

async function auditSidebar(
  page: Page,
  persona: QaPersona,
  testInfo: TestInfo
): Promise<{ links: SidebarLink[]; findings: string[] }> {
  const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true }).first();
  const findings: string[] = [];

  if (!(await isVisible(navigation))) {
    const openNavigation = page
      .getByRole("button", { name: "Open main navigation", exact: true })
      .first();
    if (await isVisible(openNavigation)) {
      await openNavigation.click({ timeout: 3_000 });
      await navigation.waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS }).catch(() => undefined);
    }
  }

  if (!(await isVisible(navigation))) {
    return { links: [], findings: ["sidebar navigation landmark is not visible"] };
  }

  // A successful capability HTTP response precedes React Query's DOM commit.
  // The navigation landmark exposes that asynchronous state to assistive
  // technology, and gives this audit an exact UI-level point at which the
  // capability-filtered menu is ready to inspect.
  try {
    await expect(navigation).toHaveAttribute("aria-busy", "false", {
      timeout: ROUTE_TIMEOUT_MS,
    });
  } catch {
    return {
      links: [],
      findings: ["sidebar module access did not finish loading before the route timeout"],
    };
  }

  if (
    await isVisible(
      navigation.getByText("Navigation is degraded. Some module links are temporarily unavailable.")
    )
  ) {
    return {
      links: [],
      findings: ["sidebar module access check failed and left navigation degraded"],
    };
  }

  await expandSidebarGroups(page, navigation);
  const links = await visibleSidebarLinks(navigation);
  const visibleHrefs = new Set(links.map((link) => normalizePathname(link.href)));

  testInfo.annotations.push({
    type: "role-navigation-sidebar",
    description: `${persona.name}: ${formatSidebarLinks(links)}`,
  });

  for (const href of persona.requiredSidebarHrefs) {
    if (!visibleHrefs.has(normalizePathname(href))) {
      findings.push(`missing intended sidebar route ${href}`);
    }
  }
  for (const href of persona.forbiddenSidebarHrefs) {
    if (visibleHrefs.has(normalizePathname(href))) {
      findings.push(`exposes forbidden sidebar route ${href}`);
    }
  }

  return { links, findings };
}

async function auditDashboardLinks(
  page: Page,
  persona: QaPersona,
  testInfo: TestInfo
): Promise<string[]> {
  const forbiddenHrefs = persona.forbiddenDashboardHrefs ?? [];
  if (!forbiddenHrefs.length) return [];

  await page.goto("/dashboard");
  const main = page.getByRole("main").first();
  await expect(main).toBeVisible({ timeout: ROUTE_TIMEOUT_MS });
  await expect(
    main.getByRole("heading", { name: /welcome back/i })
  ).toBeVisible({ timeout: ROUTE_TIMEOUT_MS });

  const links = await main.locator("a[href]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        );
      })
      .map((element) => ({
        href: (element as HTMLAnchorElement).getAttribute("href") ?? "",
        label: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      }))
  );
  const visibleHrefs = new Set(links.map((link) => normalizePathname(link.href)));

  testInfo.annotations.push({
    type: "role-navigation-dashboard-links",
    description: `${persona.name}: ${
      links
        .map((link) => `${link.label || "[unlabelled]"} → ${link.href}`)
        .join(", ") || "[no main-content links]"
    }`,
  });

  return forbiddenHrefs
    .filter((href) => visibleHrefs.has(normalizePathname(href)))
    .map((href) => `dashboard exposes forbidden route ${href}`);
}

async function auditPersona(page: Page, persona: QaPersona, testInfo: TestInfo): Promise<string[]> {
  const findings: string[] = [];
  await loginViaUi(page, persona.email, passwordForQaPersona());

  let requestGuard: Awaited<ReturnType<typeof installNoBusinessWritesGuard>> | undefined;
  try {
    requestGuard = await installNoBusinessWritesGuard(page);
    const sidebar = await auditSidebar(page, persona, testInfo);
    findings.push(...sidebar.findings);
    findings.push(...(await auditDashboardLinks(page, persona, testInfo)));

    // Every visible sidebar link is a promise that the current role can reach
    // a usable page. Combine it with the explicit role cases so a route that
    // is not rendered in one navigation state still receives its direct check.
    const permittedRoutes = [
      ...new Set([
        ...sidebar.links.map((link) => normalizePathname(link.href)),
        ...persona.allowedRoutes.map((route) => normalizePathname(route)),
      ]),
    ].sort();

    for (const route of permittedRoutes) {
      const diagnostic = await inspectRoute(page, route);
      testInfo.annotations.push({
        type: "role-navigation-route",
        description: `${persona.name} permitted: ${formatRouteDiagnostic(diagnostic)}`,
      });
      const issue = allowedRouteIssue(diagnostic);
      if (issue) findings.push(`permitted route ${route}: ${issue}`);
    }

    for (const route of persona.forbiddenRoutes) {
      const diagnostic = await inspectRoute(page, route);
      testInfo.annotations.push({
        type: "role-navigation-route",
        description: `${persona.name} forbidden: ${formatRouteDiagnostic(diagnostic)}`,
      });
      const issue = forbiddenRouteIssue(diagnostic);
      if (issue) findings.push(`forbidden route ${route}: ${issue}`);
    }

    if (requestGuard.blockedRequests.length) {
      findings.push(
        `blocked non-read-only browser request(s): ${requestGuard.blockedRequests.join(", ")}`
      );
    }
  } finally {
    await requestGuard?.dispose();
    await logoutViaUi(page);
  }

  return findings;
}

async function unnamedVisibleControls(page: Page): Promise<string[]> {
  const controls = await page.locator(AUDITABLE_CONTROL_SELECTOR).evaluateAll((elements) => {
    const normalize = (value: string | null | undefined): string =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element: HTMLElement): boolean => {
      if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        element.getClientRects().length > 0
      );
    };
    const enabled = (element: HTMLElement): boolean =>
      !element.matches(":disabled") &&
      element.getAttribute("aria-disabled") !== "true" &&
      !element.hasAttribute("data-disabled");
    const referencedLabel = (element: HTMLElement): string =>
      (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => normalize(document.getElementById(id)?.textContent))
        .filter(Boolean)
        .join(" ");
    const formLabel = (element: HTMLElement): string => {
      if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLSelectElement) &&
        !(element instanceof HTMLTextAreaElement)
      ) {
        return "";
      }
      return Array.from(element.labels ?? [])
        .map((label) => normalize(label.textContent))
        .filter(Boolean)
        .join(" ");
    };
    const accessibleName = (element: HTMLElement): string => {
      const imageAlt = Array.from(element.querySelectorAll("img[alt]"))
        .map((image) => normalize(image.getAttribute("alt")))
        .filter(Boolean)
        .join(" ");
      return [
        normalize(element.getAttribute("aria-label")),
        referencedLabel(element),
        formLabel(element),
        normalize(element.getAttribute("alt")),
        imageAlt,
        normalize(element.textContent),
        normalize(element.getAttribute("placeholder")),
        normalize(element.getAttribute("title")),
        normalize(element.getAttribute("value")),
      ].find(Boolean) ?? "";
    };
    const description = (element: HTMLElement): string => {
      const tag = element.tagName.toLowerCase();
      const role = normalize(element.getAttribute("role"));
      const href = normalize(element.getAttribute("href")).split(/[?#]/, 1)[0];
      return [tag, role && `role=${role}`, href && `href=${href}`].filter(Boolean).join(" ");
    };

    return elements.flatMap((element) => {
      if (!(element instanceof HTMLElement) || !visible(element) || !enabled(element)) return [];
      return accessibleName(element) ? [] : [description(element)];
    });
  });

  return controls as string[];
}

async function safePresentationControls(page: Page): Promise<{
  exercised: number;
  findings: string[];
}> {
  const findings: string[] = [];
  const pageErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", onPageError);

  try {
    const main = page.getByRole("main").first();
    const handles = await main.locator("[role='tab'], button[aria-expanded]").elementHandles();
    let exercised = 0;

    for (const handle of handles) {
      const candidate = (await handle.evaluate((element) => {
        if (!(element instanceof HTMLElement)) return null;
        if (element.closest("[hidden], [inert], [aria-hidden='true']")) return null;
        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          !element.getClientRects().length ||
          element.matches(":disabled") ||
          element.getAttribute("aria-disabled") === "true"
        ) {
          return null;
        }
        if (element instanceof HTMLButtonElement && element.type.toLowerCase() === "submit") {
          return null;
        }

        const label =
          (element.getAttribute("aria-label") ?? "").trim() || element.textContent?.replace(/\s+/g, " ").trim() || "";
        if (!label) return null;

        if (element.getAttribute("role") === "tab") {
          return { kind: "tab", label, state: element.getAttribute("aria-selected") };
        }
        return { kind: "disclosure", label, state: element.getAttribute("aria-expanded") };
      })) as SafePresentationControl | null;

      if (!candidate || UNSAFE_PRESENTATION_CONTROL_NAME.test(candidate.label)) continue;
      if (candidate.kind === "tab" && candidate.state === "true") continue;

      try {
        await handle.click({ timeout: 3_000 });
        exercised += 1;
        await page.waitForTimeout(100);
        const nextState = await handle.getAttribute(
          candidate.kind === "tab" ? "aria-selected" : "aria-expanded"
        );

        if (candidate.kind === "tab" && nextState !== "true") {
          findings.push("a safe tab did not become selected after activation");
        }
        if (candidate.kind === "disclosure" && nextState === candidate.state) {
          findings.push("a safe disclosure did not change expanded state after activation");
        }
        if (isAuthenticationPath(pathnameFromUrl(page.url()))) {
          findings.push("a safe tab or disclosure redirected to authentication");
        }
        const denial = await findAccessDenial(page);
        if (denial) {
          findings.push(`a safe tab or disclosure rendered ${denial}`);
        }
      } catch {
        findings.push("a safe tab or disclosure could not be activated");
      } finally {
        await page.keyboard.press("Escape").catch(() => undefined);
      }
    }

    findings.push(...pageErrors.map(() => "a safe tab or disclosure triggered a page error"));
    return { exercised, findings };
  } finally {
    page.off("pageerror", onPageError);
  }
}

async function auditEmployeeMyWork(page: Page, testInfo: TestInfo): Promise<string[]> {
  const employee = personas.find((persona) => persona.name === "Employee");
  if (!employee) throw new Error("Employee QA persona is missing from the role audit.");

  const findings: string[] = [];
  await loginViaUi(page, employee.email, passwordForQaPersona());

  let requestGuard: Awaited<ReturnType<typeof installNoBusinessWritesGuard>> | undefined;
  try {
    requestGuard = await installNoBusinessWritesGuard(page);
    const sidebar = await auditSidebar(page, employee, testInfo);
    findings.push(...sidebar.findings);

    const myWorkRoutes = new Set([
      "/my-workspace",
      "/my-workspace/calendar",
      "/my-workspace/leave",
      "/my-workspace/hr-requests",
      "/my-workspace/approvals",
      ...sidebar.links.map((link) => link.href).filter((href) => href.startsWith("/my-workspace")),
    ]);

    for (const route of myWorkRoutes) {
      const routeDiagnostic = await inspectRoute(page, route);
      testInfo.annotations.push({
        type: "employee-my-work-route",
        description: formatRouteDiagnostic(routeDiagnostic),
      });
      const routeIssue = allowedRouteIssue(routeDiagnostic);
      if (routeIssue) {
        findings.push(`Employee My Work route ${route}: ${routeIssue}`);
        continue;
      }

      const unlabelled = await unnamedVisibleControls(page);
      if (unlabelled.length) {
        findings.push(
          `Employee My Work route ${route}: visible enabled control(s) without an accessible label: ${unlabelled.join(", ")}`
        );
      }

      const controls = await safePresentationControls(page);
      testInfo.annotations.push({
        type: "employee-my-work-controls",
        description: `${route}: named-controls=${unlabelled.length ? "failed" : "passed"}; safe-tabs-disclosures=${controls.exercised}`,
      });
      findings.push(...controls.findings.map((finding) => `Employee My Work route ${route}: ${finding}`));
    }

    if (requestGuard.blockedRequests.length) {
      findings.push(
        `blocked non-read-only browser request(s): ${requestGuard.blockedRequests.join(", ")}`
      );
    }
  } finally {
    await requestGuard?.dispose();
    await logoutViaUi(page);
  }

  return findings;
}

function skipNonDesktopProject(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== "chromium",
    "The desktop sidebar audit runs only in the Chromium desktop project."
  );
}

test.describe(
  "Staging QA role navigation audit",
  { tag: ["@staging", "@role-navigation-audit", "@non-mutating"] },
  () => {
    // Some broad-but-legitimate roles expose many independently navigable
    // menu entries. Keep the audit exhaustive rather than letting a healthy
    // role time out solely because each direct route is verified in turn.
    test.setTimeout(8 * 60_000);
    test.skip(
      !stagingBaseUrl || !qaPersonaPassword,
      "Set PLAYWRIGHT_BASE_URL and QA_REFERENCE_PERSONA_PASSWORD or E2E_MAKER_PASSWORD in the staging runner."
    );

    test("authentication detection requires the visible credential form", async ({ page }) => {
      await page.setContent(`
        <main>
          <h1>Hello manager, welcome back</h1>
          <table><thead><tr><th>Last sign in</th></tr></thead></table>
        </main>
      `);

      expect(await isVisibleLoginForm(page)).toBe(false);

      await page.setContent(`
        <form>
          <label for="identifier">Username or email</label>
          <input id="identifier" type="text" />
          <label for="password">Password</label>
          <input id="password" type="password" />
          <button type="submit">Sign in</button>
        </form>
      `);

      expect(await isVisibleLoginForm(page)).toBe(true);
    });

    for (const persona of personas) {
      test(`${persona.name} has intended menus and route boundaries`, async ({ page }, testInfo) => {
        skipNonDesktopProject(testInfo);
        const findings = await auditPersona(page, persona, testInfo);
        expect(
          findings,
          `${persona.name} role-navigation audit findings:\n${findings.map((finding) => `- ${finding}`).join("\n")}`
        ).toEqual([]);
      });
    }

    test("Employee My Work routes keep controls labelled and safe tabs/disclosures usable", async (
      { page },
      testInfo
    ) => {
      const findings = await auditEmployeeMyWork(page, testInfo);
      expect(
        findings,
        `Employee My Work accessibility audit findings:\n${findings.map((finding) => `- ${finding}`).join("\n")}`
      ).toEqual([]);
    });

    test("disabled QA user is denied before an authenticated session is created", async ({ page }, testInfo) => {
      skipNonDesktopProject(testInfo);
      const disabledUser = qaEmail("E2E_QA_DISABLED_USER_EMAIL", REFERENCE_EMAILS.disabled);

      await page.goto("/login", { waitUntil: "domcontentloaded", timeout: ROUTE_TIMEOUT_MS });
      await page.getByRole("textbox", { name: "Username or email" }).fill(disabledUser);
      // The reference seeder rejects disabled users before password verification.
      // This is an intentionally invalid, non-secret value rather than a credential.
      await page.getByLabel("Password", { exact: true }).fill("disabled-user-denial");
      const loginResponse = page.waitForResponse(
        (response) =>
          pathnameFromUrl(response.url()) === "/api/auth/login" &&
          response.request().method() === "POST",
        { timeout: ROUTE_TIMEOUT_MS }
      );
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const response = await loginResponse;

      testInfo.annotations.push({
        type: "disabled-user-login",
        description: `status=${response.status()}; final=${pathnameFromUrl(page.url())}`,
      });
      expect(response.status()).toBe(401);
      await expect(page).toHaveURL(/\/login(?:[?#]|$)/);
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    });
  }
);
