export type HolidaySource = "LEGACY_HOLIDAYS" | "BUSINESS_CALENDAR";

export interface Holiday {
  id: string;
  companyId: string;
  branchId?: string | null;
  holidayCode?: string | null;
  holidayName: string;
  holidayDate: string;
  holidayType: string;
  dayPortion?: string | null;
  description?: string | null;
  runtimeMode?: "LEGACY" | "SHADOW" | "ACTIVE";
  source?: HolidaySource;
  calendarId?: string | null;
  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };
  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
  } | null;
}

export interface HolidayDirectoryItem extends Holiday {
  endDate?: string | null;
  calendarName?: string | null;
  calendarScope?: "COMPANY" | "BRANCH" | null;
  paidHoliday?: boolean | null;
  isOptionalHoliday?: boolean | null;
  versionNumber?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  publishedAt?: string | null;
  isTransitioning?: boolean;
}

export interface HolidayOfficeSource {
  companyId: string;
  companyName: string;
  branchId: string | null;
  branchName: string | null;
  calendarId: string | null;
  runtimeMode: "LEGACY" | "SHADOW" | "ACTIVE";
  source: HolidaySource;
}

export interface HolidaySourceResponse {
  offices: HolidayOfficeSource[];
  canEditLegacyHolidays: boolean;
}

export interface HolidayPayload {
  companyId: string;
  branchId?: string;
  holidayName: string;
  holidayDate: string;
  holidayType: string;
  holidayCode?: string;
  description?: string;
  dayPortion?: string;
}
