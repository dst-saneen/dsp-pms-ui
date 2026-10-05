/**
 * AUTH-01 — validated post-auth destination.
 * Only same-origin relative paths; Dashboard is the safe fallback.
 */

export const DEFAULT_POST_AUTH_PATH = "/dashboard";

const AUTH_NEXT_STORAGE_KEY = "erp.auth.next";

/** Routes that must not be restored as a post-auth destination. */
const BLOCKED_NEXT_PREFIXES = [
  "/login",
  "/register",
  "/change-password",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/onboarding",
  "/api",
] as const;

/**
 * Returns a safe in-app path or the Dashboard fallback.
 * Rejects absolute URLs, protocol-relative URLs, and auth/public entry routes.
 */
export function resolveSafeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_PATH,
): string {
  const candidate = (raw ?? "").trim();
  if (!candidate) {
    return fallback;
  }

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("://") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  // Strip hash; keep query on the path for deep links.
  const pathOnly = candidate.split("#")[0] ?? candidate;
  const pathname = pathOnly.split("?")[0] ?? pathOnly;

  if (
    pathname === "/" ||
    BLOCKED_NEXT_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  return pathOnly;
}

export function readNextParam(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): string | null {
  return searchParams.get("next");
}

/** Persist intended destination across password-change / onboarding hops. */
export function rememberAuthNext(raw: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const safe = resolveSafeNextPath(raw);
  try {
    if (safe === DEFAULT_POST_AUTH_PATH && !(raw ?? "").trim()) {
      window.sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, safe);
  } catch {
    // ignore quota / private mode
  }
}

export function peekAuthNext(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearAuthNext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Prefer URL `next`, then sessionStorage, then fallback.
 * Optionally remember the resolved value for later hops.
 */
export function resolveAndRememberAuthNext(
  urlNext: string | null | undefined,
  options?: { remember?: boolean; fallback?: string },
): string {
  const fromUrl = resolveSafeNextPath(urlNext, "");
  const fromStore = resolveSafeNextPath(peekAuthNext(), "");
  const fallback = options?.fallback ?? DEFAULT_POST_AUTH_PATH;
  const resolved =
    fromUrl && fromUrl !== DEFAULT_POST_AUTH_PATH
      ? fromUrl
      : fromStore || fallback || DEFAULT_POST_AUTH_PATH;

  if (options?.remember !== false) {
    rememberAuthNext(resolved === DEFAULT_POST_AUTH_PATH ? null : resolved);
  }

  return resolveSafeNextPath(resolved, fallback);
}

export function appendNextQuery(path: string, next: string | null | undefined): string {
  const safe = resolveSafeNextPath(next);
  if (safe === DEFAULT_POST_AUTH_PATH) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(safe)}`;
}

/** Final navigation target after all required auth gates. */
export function consumePostAuthDestination(
  urlNext?: string | null,
): string {
  const destination = resolveAndRememberAuthNext(urlNext, { remember: false });
  clearAuthNext();
  return destination;
}
