/**
 * Business Calendar Stage 1 — permission codes (work order §9).
 */
export const BusinessCalendarPermission = {
  READ: 'calendar.business.read',
  MANAGE: 'calendar.business.manage',
  REVIEW: 'calendar.business.review',
  PUBLISH: 'calendar.business.publish',
  AMEND: 'calendar.business.amend',
  IMPORT: 'calendar.business.import',
  RUNTIME_PREVIEW: 'calendar.business.runtime.preview',
  PROTECTED_OVERRIDE: 'calendar.business.protected-override',
} as const;

export type BusinessCalendarPermission =
  (typeof BusinessCalendarPermission)[keyof typeof BusinessCalendarPermission];

export const BUSINESS_CALENDAR_PERMISSIONS = Object.values(
  BusinessCalendarPermission,
);
