/** Recruitment permission catalog — mirrors API plan route policy. */
export const RECRUITMENT_PERMISSIONS = {
  read: "hr.recruitment.read",
  manage: "hr.recruitment.manage",
  offer: "hr.recruitment.offer",
  verify: "recruitment.offer.verify",
  convert: "hr.recruitment.convert",
  deliveryRead: "hr.recruitment.delivery.read",
  deliveryRetry: "hr.recruitment.delivery.retry",
} as const;

export type RecruitmentPermission =
  (typeof RECRUITMENT_PERMISSIONS)[keyof typeof RECRUITMENT_PERMISSIONS];
