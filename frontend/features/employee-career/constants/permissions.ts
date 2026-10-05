/** Employee career and probation permissions — mirrors API plan. */
export const EMPLOYEE_CAREER_PERMISSIONS = {
  read: "hr.recruitment.read",
  manage: "hr.recruitment.manage",
  override: "hr.recruitment.probation.override",
} as const;

export const PLATFORM_ADMIN_PERMISSION = "platform.admin";
