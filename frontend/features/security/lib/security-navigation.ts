const SECURITY_LIST = "/administration/security";
const USERS_LIST = "/administration/users";

const ALLOWED_SECURITY_RETURN_PREFIXES = [SECURITY_LIST] as const;
const ALLOWED_USERS_RETURN_PREFIXES = [
  USERS_LIST,
  "/hr/employees",
] as const;

function resolveReturnPath(
  returnParam: string | null | undefined,
  fallback: string,
  allowed: readonly string[],
): string {
  const candidate = (returnParam ?? "").trim();
  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("://") &&
    allowed.some(
      (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`),
    )
  ) {
    return candidate;
  }
  return fallback;
}

export function resolveSecurityReturnPath(
  returnParam: string | null | undefined,
  fallback: string = SECURITY_LIST,
): string {
  return resolveReturnPath(
    returnParam,
    fallback,
    ALLOWED_SECURITY_RETURN_PREFIXES,
  );
}

export function resolveUsersReturnPath(
  returnParam: string | null | undefined,
  fallback: string = USERS_LIST,
): string {
  return resolveReturnPath(returnParam, fallback, ALLOWED_USERS_RETURN_PREFIXES);
}

export function roleCreateHref(options?: { returnTo?: string }): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  return query ? `${SECURITY_LIST}/new?${query}` : `${SECURITY_LIST}/new`;
}

export function roleEditHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${SECURITY_LIST}/${id}/edit`;
  return query ? `${base}?${query}` : base;
}

export function userInviteHref(options?: {
  returnTo?: string;
  employeeId?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  if (options?.employeeId) params.set("employeeId", options.employeeId);
  const query = params.toString();
  return query ? `${USERS_LIST}/new?${query}` : `${USERS_LIST}/new`;
}

export function userAccessHref(
  id: string,
  options?: { returnTo?: string },
): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return", options.returnTo);
  const query = params.toString();
  const base = `${USERS_LIST}/${id}/access`;
  return query ? `${base}?${query}` : base;
}

export { SECURITY_LIST, USERS_LIST };
