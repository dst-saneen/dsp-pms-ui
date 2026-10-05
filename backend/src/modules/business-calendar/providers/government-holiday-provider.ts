export type NormalizedHoliday = {
  eventName: string;
  eventCode: string | null;
  startDate: string;
  endDate: string;
  countryCode: string;
  subdivisionCode: string | null;
  eventTypeCode: string;
  categoryCode: string;
  dayPortion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
  paidHoliday: boolean;
  businessDayEffect:
    | 'NONE'
    | 'NON_WORKING_DAY'
    | 'WORKING_DAY_OVERRIDE'
    | 'FIRST_HALF_NON_WORKING'
    | 'SECOND_HALF_NON_WORKING';
  externalReference: string;
  allDay: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  eventTimezone?: string | null;
};

export type Jurisdiction = {
  countryCode: string;
  countryName: string;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  region: string;
};

/**
 * Replaceable government holiday provider (work order §18.3).
 * Default implementation uses reviewed fixture packs (India + ME).
 */
export interface GovernmentHolidayProvider {
  listJurisdictions(): Promise<Jurisdiction[]>;
  fetchHolidays(input: {
    countryCode: string;
    subdivisionCode?: string;
    year: number;
  }): Promise<NormalizedHoliday[]>;
}
