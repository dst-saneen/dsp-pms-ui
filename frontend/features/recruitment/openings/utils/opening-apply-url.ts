import { RECRUITMENT_PUBLIC_ROUTES } from "../../constants/routes";
import { JOB_OPENING_STATUS } from "../../types/enums";

export function getOpeningApplyPath(
  companyCode?: string,
  openingCode?: string,
) {
  if (!companyCode || !openingCode) return null;
  return RECRUITMENT_PUBLIC_ROUTES.jobDetail(companyCode, openingCode);
}

export function getOpeningApplyUrl(
  companyCode?: string,
  openingCode?: string,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  const path = getOpeningApplyPath(companyCode, openingCode);
  return path ? `${origin}${path}` : null;
}

export function isOpeningAcceptingApplications(status?: string) {
  return status === JOB_OPENING_STATUS.OPEN;
}
