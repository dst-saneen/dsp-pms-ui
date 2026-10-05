export type OptionalHolidayCalendarScope = "COMPANY" | "BRANCH";

export type OptionalHolidaySelectionStatus =
  | "NONE"
  | "SUBMITTED"
  | "APPROVED";

export interface OptionalHolidayCatalogHoliday {
  eventId: string;
  date: string;
  name: string;
  calendarScope: OptionalHolidayCalendarScope;
  selected: boolean;
  selectionStatus: OptionalHolidaySelectionStatus;
  locked: boolean;
  editableUntil: string;
}

export interface OptionalHolidayCatalog {
  year: number;
  timezone: string;
  maximumHolidayDays: number;
  mandatoryWorkingDayCount: number;
  optionalAllowance: number;
  selectedCount: number;
  remainingCount: number;
  holidays: OptionalHolidayCatalogHoliday[];
}
