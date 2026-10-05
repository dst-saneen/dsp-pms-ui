import {
  expect,
  test,
  type Locator,
  type Page,
  type Response as PlaywrightResponse,
  type Route,
  type TestInfo,
} from "@playwright/test";

import { navigation } from "../config/navigation";
import type { NavigationItem } from "../types/navigation";
import { getE2eCredentials, loginViaUi, logoutViaUi } from "./helpers/auth";

const credentials = getE2eCredentials();
const EXPECTED_CANONICAL_ROUTE_COUNT = 69;
const ROUTE_AUDIT_TIMEOUT = 10_000;
const AUDIT_TIMEOUT = 14 * 60_000;
const READ_ONLY_REQUEST_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type CanonicalNavigationRoute = {
  href: string;
  label: string;
  availability?: NavigationItem["availability"];
  disabled: boolean;
};

type ControlFinding = {
  kind: "missing-accessible-name" | "invalid-internal-href";
  control: string;
  detail: string;
};

type ControlAuditResult = {
  findings: ControlFinding[];
  internalHrefs: string[];
};

type RouteAuditResult = {
  issues: string[];
  unavailableReason?: string;
};

type SafeControlKind = "tab" | "disclosure" | "menu" | "combobox";

type SafeControlCandidate = {
  kind: SafeControlKind;
  label: string;
};

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
].join(", ");

const SAFE_CONTROL_SELECTOR = [
  "[role='tab']",
  "button[aria-expanded]",
  "[role='button'][aria-expanded]",
  "summary[aria-expanded]",
  "button[aria-haspopup='menu']",
  "[role='button'][aria-haspopup='menu']",
  "[role='combobox']",
  "[aria-haspopup='listbox']",
].join(", ");

const UNSAFE_CONTROL_NAME =
  /\b(?:activate|add|apply|approve|archive|assign|cancel|clear|complete|confirm|create|deactivate|delete|disable|edit|execute|generate|import|issue|link|logout|manage|new|pay|process|publish|reassign|reject|remove|reopen|request|reset|restore|return|run|save|send|start|stop|submit|sync|transfer|update|upload|validate|waive|withdraw)\b/i;
const SAFE_CONTROL_CLICK_TIMEOUT = 1_500;
const SAFE_CONTROL_SETTLE_MS = 100;

const UNAVAILABLE_ROUTE_STATES: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /you do not have access/i,
    reason: "permission-hidden by the current owner context",
  },
  {
    pattern: /you do not have permission to access this module/i,
    reason: "module permission-hidden by the current owner context",
  },
  {
    pattern: /select company and branch/i,
    reason: "requires an active company and branch context",
  },
  {
    pattern: /this module is not configured for the active company and branch/i,
    reason: "module capability is unavailable for the active company and branch",
  },
  {
    pattern: /assets & licences are not configured for this company\/branch/i,
    reason: "assets module capability is unavailable for the active company and branch",
  },
];

const RENDERED_ROUTE_FAILURE_STATES: ReadonlyArray<{
  locator: (page: Page) => Locator;
  reason: string;
}> = [
  {
    locator: (page) => page.getByText("This page could not be found.", { exact: true }),
    reason: "rendered a not-found page",
  },
  {
    locator: (page) => page.getByRole("heading", { name: "404", exact: true }),
    reason: "rendered a 404 heading",
  },
  {
    locator: (page) => page.getByText("Internal Server Error", { exact: true }),
    reason: "rendered an internal-server-error page",
  },
  {
    locator: (page) => page.getByText(/application error: a client-side exception/i),
    reason: "rendered a client-side application error",
  },
  {
    locator: (page) => page.getByText(/unhandled runtime error/i),
    reason: "rendered an unhandled runtime error",
  },
];

function flattenNavigationItems(
  items: NavigationItem[],
  ancestors: string[] = []
): CanonicalNavigationRoute[] {
  return items.flatMap((item) => {
    const itemPath = [...ancestors, item.title];
    const ownRoute = item.href
      ? [
          {
            href: item.href,
            label: itemPath.join(" / "),
            availability: item.availability,
            disabled: Boolean(item.disabled),
          },
        ]
      : [];

    return [...ownRoute, ...(item.children ? flattenNavigationItems(item.children, itemPath) : [])];
  });
}

const canonicalNavigationRoutes = navigation.flatMap((group) =>
  flattenNavigationItems(group.items, [group.title])
);
const routesUnderAudit = canonicalNavigationRoutes.filter(
  (route) => route.availability !== "planned" && !route.disabled
);
const intentionallyUnavailableRoutes = canonicalNavigationRoutes.filter(
  (route) => route.availability === "planned" || route.disabled
);

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function formatRouteDiagnostic(route: CanonicalNavigationRoute, issues: string[]): string {
  return [`${route.label} (${route.href})`, ...issues.map((issue) => `  - ${issue}`)].join("\n");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function isVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function waitForContentSurface(page: Page, timeout: number): Promise<void> {
  const main = page.getByRole("main").first();
  try {
    await main.waitFor({ state: "visible", timeout });
    return;
  } catch {
    const heading = page.getByRole("heading").first();
    if (await isVisible(heading)) return;
  }

  throw new Error("No visible main region or heading appeared before the route timeout.");
}

async function unavailableRouteReason(page: Page): Promise<string | undefined> {
  for (const state of UNAVAILABLE_ROUTE_STATES) {
    if (await isVisible(page.getByText(state.pattern).first())) {
      return state.reason;
    }
  }

  return undefined;
}

async function renderedRouteFailureReason(page: Page): Promise<string | undefined> {
  for (const state of RENDERED_ROUTE_FAILURE_STATES) {
    if (await isVisible(state.locator(page).first())) {
      return state.reason;
    }
  }

  return undefined;
}

function isAuthenticationPath(pathname: string): boolean {
  return ["/login", "/register", "/change-password"].includes(normalizePathname(pathname));
}

function isSameOriginAuthRefreshRequest(
  pageUrl: string,
  method: string,
  requestUrl: string
): boolean {
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

function shouldAllowReadOnlyAuditRequest(
  pageUrl: string,
  method: string,
  requestUrl: string
): boolean {
  return (
    READ_ONLY_REQUEST_METHODS.has(method.toUpperCase()) ||
    isSameOriginAuthRefreshRequest(pageUrl, method, requestUrl)
  );
}

async function auditVisibleControls(page: Page): Promise<ControlAuditResult> {
  const result = await page.locator(INTERACTIVE_SELECTOR).evaluateAll((elements) => {
    const normalize = (value: string | null | undefined): string =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const truncate = (value: string, limit = 100): string =>
      value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
    const text = (element: Element | null): string => normalize(element?.textContent);
    const visible = (element: HTMLElement): boolean => {
      if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return element.getClientRects().length > 0;
    };
    const enabled = (element: HTMLElement): boolean => {
      if (element.matches(":disabled")) return false;
      return (
        element.getAttribute("aria-disabled") !== "true" && !element.hasAttribute("data-disabled")
      );
    };
    const labelsFor = (element: HTMLElement): string => {
      if (!(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )) {
        return "";
      }

      return Array.from(element.labels ?? [])
        .map((label) => text(label))
        .filter(Boolean)
        .join(" ");
    };
    const labelledBy = (element: HTMLElement): string =>
      (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => text(document.getElementById(id)))
        .filter(Boolean)
        .join(" ");
    const accessibleName = (element: HTMLElement): string => {
      const ariaLabel = normalize(element.getAttribute("aria-label"));
      if (ariaLabel) return ariaLabel;

      const referencedLabel = labelledBy(element);
      if (referencedLabel) return referencedLabel;

      const explicitLabel = labelsFor(element);
      if (explicitLabel) return explicitLabel;

      if (element instanceof HTMLInputElement) {
        const type = element.type.toLowerCase();
        if (["button", "submit", "reset"].includes(type)) {
          const value = normalize(element.value);
          if (value) return value;
        }
        if (type === "image") {
          const alt = normalize(element.alt);
          if (alt) return alt;
        }
      }

      const visibleText = text(element);
      if (visibleText) return visibleText;

      const imageAlt = Array.from(element.querySelectorAll("img[alt]"))
        .map((image) => normalize(image.getAttribute("alt")))
        .filter(Boolean)
        .join(" ");
      if (imageAlt) return imageAlt;

      const placeholder = normalize(element.getAttribute("placeholder"));
      if (placeholder) return placeholder;

      return normalize(element.getAttribute("title"));
    };
    const describe = (element: HTMLElement): string => {
      const tag = element.tagName.toLowerCase();
      const role = normalize(element.getAttribute("role"));
      const id = normalize(element.id);
      const name = normalize(element.getAttribute("name"));
      const type = element instanceof HTMLInputElement ? normalize(element.type) : "";
      const testId = normalize(element.getAttribute("data-testid"));
      const parts = [tag];
      if (role) parts.push(`role=${role}`);
      if (type) parts.push(`type=${type}`);
      if (id) parts.push(`id=${truncate(id, 48)}`);
      if (name) parts.push(`name=${truncate(name, 48)}`);
      if (testId) parts.push(`data-testid=${truncate(testId, 48)}`);
      return parts.join(" ");
    };
    const isInternalHref = (href: string): boolean => {
      if (!href || href === "#" || /^javascript:/i.test(href)) return true;
      try {
        return new URL(href, window.location.href).origin === window.location.origin;
      } catch {
        return true;
      }
    };

    const auditFindings: ControlFinding[] = [];
    const internalHrefs = new Set<string>();
    for (const candidate of elements) {
      if (!(candidate instanceof HTMLElement) || !visible(candidate) || !enabled(candidate))
        continue;

      const control = describe(candidate);
      if (!accessibleName(candidate)) {
        auditFindings.push({
          kind: "missing-accessible-name",
          control,
          detail: "visible enabled control has no accessible name or associated label",
        });
      }

      const isLink =
        candidate instanceof HTMLAnchorElement || candidate.getAttribute("role") === "link";
      if (isLink) {
        const href = normalize(candidate.getAttribute("href"));
        if (isInternalHref(href) && (!href || href === "#" || /^javascript:/i.test(href))) {
          auditFindings.push({
            kind: "invalid-internal-href",
            control,
            detail: `visible internal link has an invalid href: ${href ? JSON.stringify(href) : "empty"}`,
          });
        } else if (isInternalHref(href) && !candidate.hasAttribute("download")) {
          try {
            const target = new URL(href, window.location.href);
            if (!target.pathname.startsWith("/api/")) {
              internalHrefs.add(`${target.pathname}${target.search}`);
            }
          } catch {
            auditFindings.push({
              kind: "invalid-internal-href",
              control,
              detail: `visible internal link has a malformed href: ${JSON.stringify(href)}`,
            });
          }
        }
      }
    }

    return { findings: auditFindings, internalHrefs: [...internalHrefs] };
  });

  return result as ControlAuditResult;
}

async function exerciseSafePageControls(
  page: Page,
  pageErrors: string[],
  serverErrors: Set<string>
): Promise<string[]> {
  const issues: string[] = [];
  const exercisedKinds = new Set<SafeControlKind>();
  const observedServerErrors = new Set(serverErrors);
  let observedPageErrorCount = pageErrors.length;
  const main = page.getByRole("main").first();
  const surface = (await isVisible(main)) ? main : page.locator("body");
  const controls = await surface.locator(SAFE_CONTROL_SELECTOR).elementHandles();

  for (const control of controls) {
    let candidate: SafeControlCandidate | null;
    try {
      candidate = (await control.evaluate((element) => {
        if (!(element instanceof HTMLElement)) return null;
        if (element.closest("[hidden], [inert], [aria-hidden='true']")) return null;

        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          !element.getClientRects().length ||
          element.matches(":disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          element.hasAttribute("data-disabled")
        ) {
          return null;
        }

        if (
          (element instanceof HTMLAnchorElement && Boolean(element.getAttribute("href"))) ||
          (element instanceof HTMLButtonElement && element.type.toLowerCase() === "submit") ||
          (element instanceof HTMLInputElement && element.type.toLowerCase() === "submit")
        ) {
          return null;
        }

        const role = element.getAttribute("role") ?? "";
        const popup = element.getAttribute("aria-haspopup") ?? "";
        let kind: SafeControlKind | null = null;
        if (role === "tab") {
          kind = "tab";
        } else if (role === "combobox" || popup === "listbox") {
          kind = "combobox";
        } else if (popup === "menu") {
          kind = "menu";
        } else if (
          element.hasAttribute("aria-expanded") &&
          (element.tagName === "BUTTON" || element.tagName === "SUMMARY" || role === "button")
        ) {
          kind = "disclosure";
        }
        if (!kind || (kind === "tab" && element.getAttribute("aria-selected") === "true")) {
          return null;
        }

        const normalize = (value: string | null | undefined): string =>
          (value ?? "").replace(/\s+/g, " ").trim();
        const labelledBy = (element.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => normalize(document.getElementById(id)?.textContent))
          .filter(Boolean)
          .join(" ");
        const labels =
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
            ? Array.from(element.labels ?? [])
                .map((label) => normalize(label.textContent))
                .filter(Boolean)
                .join(" ")
            : "";
        const label = [
          normalize(element.getAttribute("aria-label")),
          labelledBy,
          labels,
          normalize(element.textContent),
          normalize(element.getAttribute("placeholder")),
          normalize(element.getAttribute("title")),
        ].find(Boolean);

        return label ? { kind, label } : null;
      })) as SafeControlCandidate | null;
    } catch {
      // A route re-render can detach an already-collected handle. Skip it
      // rather than attempting a less precise replacement target.
      continue;
    }

    if (
      !candidate ||
      exercisedKinds.has(candidate.kind) ||
      UNSAFE_CONTROL_NAME.test(candidate.label)
    ) {
      continue;
    }
    exercisedKinds.add(candidate.kind);

    try {
      // Only activate safe presentation controls. We never choose a menu or
      // listbox item, fill a field, follow a link, or press a submit control.
      // Re-resolve by accessible role and name immediately before clicking.
      // Data-driven filters can re-render between enumeration and activation;
      // a Locator follows that replacement while an ElementHandle becomes
      // detached and would report a false broken-control finding.
      const liveRole =
        candidate.kind === "tab"
          ? "tab"
          : candidate.kind === "combobox"
            ? "combobox"
            : "button";
      const liveControl = surface
        .getByRole(liveRole, { name: candidate.label, exact: true })
        .first();
      if (!(await isVisible(liveControl))) continue;
      await liveControl.click({ timeout: SAFE_CONTROL_CLICK_TIMEOUT });
      await page.waitForTimeout(SAFE_CONTROL_SETTLE_MS);

      const actualPath = normalizePathname(new URL(page.url()).pathname);
      if (isAuthenticationPath(actualPath)) {
        issues.push(
          `safe ${candidate.kind} control ${JSON.stringify(candidate.label)} redirected to ${actualPath}`
        );
      }

      const renderedRouteFailure = await renderedRouteFailureReason(page);
      if (renderedRouteFailure) {
        issues.push(
          `safe ${candidate.kind} control ${JSON.stringify(candidate.label)} ${renderedRouteFailure}`
        );
      }
    } catch (error) {
      issues.push(
        `safe ${candidate.kind} control ${JSON.stringify(candidate.label)} could not be exercised: ${formatError(error)}`
      );
    } finally {
      // Menu, disclosure, and combobox overlays are always dismissed before
      // continuing so the audit never selects an option or leaves stale UI.
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(SAFE_CONTROL_SETTLE_MS);
    }

    for (const error of serverErrors) {
      if (!observedServerErrors.has(error)) {
        issues.push(
          `safe ${candidate.kind} control ${JSON.stringify(candidate.label)} triggered ${error}`
        );
        observedServerErrors.add(error);
      }
    }
    while (observedPageErrorCount < pageErrors.length) {
      issues.push(
        `safe ${candidate.kind} control ${JSON.stringify(candidate.label)} triggered an unhandled page error: ${pageErrors[observedPageErrorCount]}`
      );
      observedPageErrorCount += 1;
    }

    if (issues.length) break;
  }

  return issues;
}

async function auditInternalLinkTargets(
  page: Page,
  hrefs: string[],
  resultCache: Map<string, string | null>
): Promise<string[]> {
  const issues: string[] = [];
  for (const href of hrefs) {
    let issue = resultCache.get(href);
    if (issue === undefined) {
      try {
        const response = await page.request.get(href, {
          failOnStatusCode: false,
          timeout: ROUTE_AUDIT_TIMEOUT,
        });
        const status = response.status();
        const finalPath = normalizePathname(new URL(response.url()).pathname);
        issue =
          status === 404 || status >= 500
            ? `visible internal link ${href} returned HTTP ${status}`
            : isAuthenticationPath(finalPath)
              ? `visible internal link ${href} redirected to ${finalPath}`
              : null;
      } catch (error) {
        issue = `visible internal link ${href} could not be loaded: ${formatError(error)}`;
      }
      resultCache.set(href, issue);
    }
    if (issue) issues.push(issue);
  }
  return issues;
}

async function auditRoute(
  page: Page,
  route: CanonicalNavigationRoute,
  linkResultCache: Map<string, string | null>
): Promise<RouteAuditResult> {
  const issues: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors = new Set<string>();
  const routeStartedAt = Date.now();
  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onResponse = (response: PlaywrightResponse) => {
    const status = response.status();
    const request = response.request();

    if (request.isNavigationRequest() && (status === 404 || status >= 500)) {
      serverErrors.add(`document request returned HTTP ${status}: ${response.url()}`);
      return;
    }

    if (status >= 500 && ["document", "fetch", "xhr"].includes(request.resourceType())) {
      try {
        if (new URL(response.url()).origin === new URL(page.url()).origin) {
          serverErrors.add(`application request returned HTTP ${status}: ${response.url()}`);
        }
      } catch {
        // A malformed response URL is not a reliable application-route signal.
      }
    }
  };

  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  try {
    try {
      const response = await page.goto(route.href, {
        waitUntil: "domcontentloaded",
        timeout: ROUTE_AUDIT_TIMEOUT,
      });
      if (response && (response.status() === 404 || response.status() >= 500)) {
        serverErrors.add(`document request returned HTTP ${response.status()}: ${response.url()}`);
      }
    } catch (error) {
      issues.push(`navigation failed: ${formatError(error)}`);
      return { issues };
    }

    try {
      const remainingSurfaceTime = Math.max(
        1_000,
        ROUTE_AUDIT_TIMEOUT - (Date.now() - routeStartedAt)
      );
      await waitForContentSurface(page, remainingSurfaceTime);
    } catch (error) {
      issues.push(formatError(error));
    }

    const actualPath = normalizePathname(new URL(page.url()).pathname);
    if (isAuthenticationPath(actualPath)) {
      issues.push(`redirected to an authentication screen (${actualPath})`);
    } else if (actualPath !== normalizePathname(route.href)) {
      issues.push(`unexpected redirect to ${actualPath}`);
    }

    const renderedRouteFailure = await renderedRouteFailureReason(page);
    if (renderedRouteFailure) issues.push(renderedRouteFailure);

    const unavailableReason = await unavailableRouteReason(page);
    if (unavailableReason) {
      if (serverErrors.size) issues.push(...serverErrors);
      if (pageErrors.length) {
        issues.push(
          ...pageErrors.map(
            (message) => `unhandled page error before unavailable state: ${message}`
          )
        );
      }
      return issues.length ? { issues } : { issues, unavailableReason };
    }

    const routeHadRuntimeIssues = serverErrors.size > 0 || pageErrors.length > 0;
    if (serverErrors.size) issues.push(...serverErrors);
    if (pageErrors.length) {
      issues.push(...pageErrors.map((message) => `unhandled page error: ${message}`));
    }

    if (!routeHadRuntimeIssues) {
      try {
        const controlAudit = await auditVisibleControls(page);
        issues.push(
          ...controlAudit.findings.map(
            (finding) => `${finding.kind}: ${finding.control} — ${finding.detail}`
          ),
          ...(await auditInternalLinkTargets(page, controlAudit.internalHrefs, linkResultCache))
        );
      } catch (error) {
        issues.push(`control audit failed: ${formatError(error)}`);
      }

      try {
        issues.push(...(await exerciseSafePageControls(page, pageErrors, serverErrors)));
      } catch (error) {
        issues.push(`safe control audit failed: ${formatError(error)}`);
      }
    }

    return { issues };
  } finally {
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
}

async function installReadOnlyRequestGuard(page: Page): Promise<{
  blockedRequests: string[];
  dispose: () => Promise<void>;
}> {
  const blockedRequests: string[] = [];
  const handler = async (route: Route) => {
    const request = route.request();
    if (shouldAllowReadOnlyAuditRequest(page.url(), request.method(), request.url())) {
      await route.continue();
      return;
    }

    blockedRequests.push(`${page.url()} — ${request.method()} ${request.url()}`);
    await route.abort("blockedbyclient");
  };

  // The audit only navigates and inspects. Auth refresh is the one exception:
  // it rotates the same-origin cookie-backed session token needed to keep this
  // authenticated browser session alive, without performing a business write.
  // Every other non-read request, including all business mutations, is blocked.
  await page.route("**/*", handler);

  return {
    blockedRequests,
    dispose: async () => {
      await page.unroute("**/*", handler);
    },
  };
}

test("read-only audit request guard permits only the exact same-origin auth refresh POST", () => {
  const pageUrl = "https://hr.example.test/administration/designations";

  expect(
    shouldAllowReadOnlyAuditRequest(pageUrl, "POST", "https://hr.example.test/api/auth/refresh")
  ).toBe(true);
  expect(
    shouldAllowReadOnlyAuditRequest(
      pageUrl,
      "POST",
      "https://hr.example.test/api/auth/refresh?retry=1"
    )
  ).toBe(false);
  expect(
    shouldAllowReadOnlyAuditRequest(pageUrl, "POST", "https://other.example.test/api/auth/refresh")
  ).toBe(false);
  expect(
    shouldAllowReadOnlyAuditRequest(pageUrl, "PATCH", "https://hr.example.test/api/auth/refresh")
  ).toBe(false);
  expect(
    shouldAllowReadOnlyAuditRequest(pageUrl, "POST", "https://hr.example.test/api/auth/logout")
  ).toBe(false);
  expect(
    shouldAllowReadOnlyAuditRequest(pageUrl, "POST", "https://hr.example.test/api/designations")
  ).toBe(false);
});

function recordUnavailableRoute(
  testInfo: TestInfo,
  route: CanonicalNavigationRoute,
  reason: string
): void {
  testInfo.annotations.push({
    type: "navigation-route-unavailable",
    description: `${route.label} (${route.href}): ${reason}`,
  });
}

test.describe(
  "Authenticated canonical navigation and control audit",
  { tag: ["@navigation-audit", "@desktop-only"] },
  () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(AUDIT_TIMEOUT);
    test.skip(
      !credentials.configured,
      "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD for the authenticated navigation audit."
    );

    test("visits every available canonical route without mutating data", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "This intentionally bounded audit runs only in the desktop Chromium project."
      );

      const duplicateHrefs = canonicalNavigationRoutes.filter(
        (route, index, routes) => routes.findIndex(({ href }) => href === route.href) !== index
      );
      expect(
        duplicateHrefs,
        "Navigation config must not contain duplicate canonical hrefs."
      ).toEqual([]);
      expect(
        canonicalNavigationRoutes,
        "The browser audit route inventory must match the reviewed navigation contract."
      ).toHaveLength(EXPECTED_CANONICAL_ROUTE_COUNT);

      const auditFailures: string[] = [];
      const unavailableRoutes: string[] = [];
      const linkResultCache = new Map<string, string | null>();
      let auditedRouteCount = 0;

      await loginViaUi(page);
      try {
        const requestGuard = await installReadOnlyRequestGuard(page);
        try {
          for (const route of routesUnderAudit) {
            await test.step(`${route.label}: ${route.href}`, async () => {
              const result = await auditRoute(page, route, linkResultCache);
              if (result.unavailableReason) {
                unavailableRoutes.push(`${route.href} (${result.unavailableReason})`);
                recordUnavailableRoute(testInfo, route, result.unavailableReason);
                return;
              }

              auditedRouteCount += 1;
              if (result.issues.length) {
                auditFailures.push(formatRouteDiagnostic(route, result.issues));
              }
            });
          }

          if (!auditedRouteCount) {
            auditFailures.push(
              "No configured navigation route was accessible to the owner test persona."
            );
          }

          if (requestGuard.blockedRequests.length) {
            auditFailures.push(
              [
                "The read-only audit blocked unsafe browser requests after authentication:",
                ...requestGuard.blockedRequests.map((request) => `  - ${request}`),
              ].join("\n")
            );
          }

          if (intentionallyUnavailableRoutes.length) {
            testInfo.annotations.push({
              type: "navigation-route-not-audited",
              description: intentionallyUnavailableRoutes
                .map((route) => `${route.label} (${route.href}) is planned or disabled`)
                .join("; "),
            });
          }

          if (unavailableRoutes.length) {
            testInfo.annotations.push({
              type: "navigation-audit-summary",
              description: `Audited ${auditedRouteCount} available route(s); skipped ${unavailableRoutes.length} permission/capability-hidden route(s).`,
            });
          }

          console.log(
            `[page-control-audit] canonical=${canonicalNavigationRoutes.length} audited=${auditedRouteCount} unavailable=${unavailableRoutes.length} plannedOrDisabled=${intentionallyUnavailableRoutes.length} uniqueInternalLinks=${linkResultCache.size}`
          );

          expect(
            auditFailures,
            auditFailures.length
              ? `Navigation/control audit failures:\n${auditFailures.join("\n\n")}`
              : `Audited ${auditedRouteCount} available canonical navigation route(s).`
          ).toEqual([]);
        } finally {
          await requestGuard.dispose();
        }
      } finally {
        await logoutViaUi(page);
      }
    });
  }
);
