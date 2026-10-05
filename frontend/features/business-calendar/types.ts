export type CalendarConfigurationStatus =
  | "READY"
  | "MISSING_TIMEZONE"
  | "MISSING_LOCATION"
  | "LEGACY_MODE"
  | "SHADOW_MODE"
  | "ACTIVE_MODE"
  | "INACTIVE";

export type CalendarVersionStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "SUPERSEDED" | "RETIRED";

export interface BusinessCalendarRow {
  id: string;
  companyId: string;
  branchId: string | null;
  parentCalendarId: string | null;
  scope: "COMPANY" | "BRANCH";
  scopeKey: string;
  calendarCode: string;
  calendarName: string;
  defaultTimezone: string;
  runtimeMode: "LEGACY" | "SHADOW" | "ACTIVE";
  isActive: boolean;
  hasPublishedVersion: boolean;
  configurationStatus: CalendarConfigurationStatus[];
  company?: { id: string; companyCode: string; companyName: string };
  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
    timezone: string | null;
    countryCode: string | null;
    countrySubdivisionCode: string | null;
  } | null;
  parentCalendar?: {
    id: string;
    calendarCode: string;
    calendarName: string;
    scope: string;
  } | null;
  childCalendars?: Array<{
    id: string;
    calendarCode: string;
    calendarName: string;
    branchId: string | null;
  }>;
}

export interface WorkingWeekRule {
  id?: string;
  dayOfWeek: number;
  ruleMode: "DEFINE" | "OVERRIDE";
  isWorkingDay: boolean;
  dayPortion: "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF";
  reason?: string | null;
}

export interface VersionValidation {
  issues: string[];
  readyForReview: boolean;
  workingWeekRuleCount: number;
  eventCount: number;
  inheritanceNote: string;
}

export interface CalendarVersion {
  id: string;
  calendarId: string;
  versionNumber: number;
  status: CalendarVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  amendsVersionId?: string | null;
  changeReason: string | null;
  optimisticVersion: number;
  contentChecksum: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  calendar: {
    id: string;
    companyId: string;
    branchId: string | null;
    scope: "COMPANY" | "BRANCH";
    calendarCode: string;
    calendarName: string;
    defaultTimezone: string;
    parentCalendarId: string | null;
  };
  workingWeekRules: WorkingWeekRule[];
  events: Array<{ id: string }>;
  validation: VersionValidation;
}

export interface CalendarEventType {
  id: string;
  eventTypeCode: string;
  eventTypeName: string;
  allowsBusinessDayEffect: boolean;
  isSystem: boolean;
  isActive: boolean;
}

export interface CalendarEventCategory {
  id: string;
  categoryCode: string;
  categoryName: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface CalendarEventSource {
  id: string;
  sourceCode: string;
  sourceName: string;
  sourceKind: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface CalendarEventTarget {
  id?: string;
  targetType: "COMPANY" | "BRANCH" | "DEPARTMENT" | "EMPLOYEE" | "PROJECT";
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
  projectId?: string | null;
}

export interface CalendarEvent {
  id: string;
  calendarVersionId: string;
  companyId: string;
  eventTypeId: string;
  eventCategoryId: string;
  eventSourceId: string;
  eventCode: string | null;
  eventName: string;
  description: string | null;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startsAt: string | null;
  endsAt: string | null;
  eventTimezone: string | null;
  businessDayEffect: string;
  paidHoliday: boolean;
  isOptionalHoliday: boolean;
  isProtected: boolean;
  eventType?: CalendarEventType;
  eventCategory?: CalendarEventCategory;
  eventSource?: CalendarEventSource;
  targets: CalendarEventTarget[];
}

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface ImportBatchSummary {
  id: string;
  sourceKind: string;
  sourceFileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  changedRows: number;
  invalidRows: number;
}

export interface ImportHolidayPayload {
  eventName?: string;
  eventCode?: string | null;
  startDate?: string;
  endDate?: string;
  dayPortion?: string;
  paidHoliday?: boolean;
  isOptionalHoliday?: boolean;
  businessDayEffect?: string;
  countryCode?: string;
  subdivisionCode?: string | null;
}

export interface ImportBatchDetail extends ImportBatchSummary {
  rows: Array<{
    id: string;
    rowNumber: number;
    externalReference: string | null;
    payloadHash: string;
    status: string;
    validationErrors?: unknown;
    normalizedPayload?: ImportHolidayPayload | null;
  }>;
}

export interface ImportJurisdiction {
  countryCode: string;
  countryName: string;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  region: string;
}

export interface CalendarImpactRow {
  id: string;
  businessDate: string;
  entityType: string;
  entityId: string;
  impactCode: string;
  impactSummary: string;
  status: "PENDING" | "ACKNOWLEDGED" | "RESOLVED" | "IGNORED";
  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
  } | null;
  amendment?: {
    id: string;
    reason: string;
    effectiveDate: string;
    amendmentVersionId: string;
    calendarId: string;
  } | null;
}
