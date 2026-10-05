/**
 * Development-only local data switch. Business availability always comes from
 * the backend capability APIs, never from a browser-build environment value.
 */
export function isRecruitmentMockEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.NEXT_PUBLIC_RECRUITMENT_USE_MOCK === "true";
}
