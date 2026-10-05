const ANONYMOUS_PUBLIC_PATHS = ["/careers", "/offer-response", "/privacy"];

export function isAnonymousPublicPath(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  return ANONYMOUS_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isPublicApiRequest(url: string | undefined) {
  if (!url) {
    return false;
  }

  return url.includes("/public/");
}
