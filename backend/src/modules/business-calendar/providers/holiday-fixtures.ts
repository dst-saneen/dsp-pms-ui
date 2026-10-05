import { createHash } from 'node:crypto';

import type { NormalizedHoliday } from '../providers/government-holiday-provider';

/**
 * Representative India national + Kerala (IN-KL) holidays for fixture tests.
 * Not a complete statutory list — staging pack for Stage 7 review flow.
 */
export const INDIA_2026_FIXTURE: NormalizedHoliday[] = [
  {
    eventName: 'Republic Day',
    eventCode: 'IN-REPUBLIC-DAY',
    startDate: '2026-01-26',
    endDate: '2026-01-26',
    countryCode: 'IN',
    subdivisionCode: null,
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'GOVERNMENT',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:IN:2026:republic-day',
    allDay: true,
  },
  {
    eventName: 'Independence Day',
    eventCode: 'IN-INDEPENDENCE-DAY',
    startDate: '2026-08-15',
    endDate: '2026-08-15',
    countryCode: 'IN',
    subdivisionCode: null,
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'GOVERNMENT',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:IN:2026:independence-day',
    allDay: true,
  },
  {
    eventName: 'Gandhi Jayanti',
    eventCode: 'IN-GANDHI-JAYANTI',
    startDate: '2026-10-02',
    endDate: '2026-10-02',
    countryCode: 'IN',
    subdivisionCode: null,
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'GOVERNMENT',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:IN:2026:gandhi-jayanti',
    allDay: true,
  },
  {
    eventName: 'Onam',
    eventCode: 'IN-KL-ONAM',
    startDate: '2026-08-26',
    endDate: '2026-08-26',
    countryCode: 'IN',
    subdivisionCode: 'IN-KL',
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'REGIONAL',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:IN-KL:2026:onam',
    allDay: true,
  },
  {
    eventName: 'Vishu',
    eventCode: 'IN-KL-VISHU',
    startDate: '2026-04-14',
    endDate: '2026-04-14',
    countryCode: 'IN',
    subdivisionCode: 'IN-KL',
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'REGIONAL',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:IN-KL:2026:vishu',
    allDay: true,
  },
];

/** Representative UAE national holidays for Middle East fixture exit gate. */
export const UAE_2026_FIXTURE: NormalizedHoliday[] = [
  {
    eventName: 'New Year Day',
    eventCode: 'AE-NEW-YEAR',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    countryCode: 'AE',
    subdivisionCode: null,
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'GOVERNMENT',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:AE:2026:new-year',
    allDay: true,
  },
  {
    eventName: 'UAE National Day',
    eventCode: 'AE-NATIONAL-DAY',
    startDate: '2026-12-02',
    endDate: '2026-12-03',
    countryCode: 'AE',
    subdivisionCode: null,
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'GOVERNMENT',
    dayPortion: 'FULL_DAY',
    paidHoliday: true,
    businessDayEffect: 'NON_WORKING_DAY',
    externalReference: 'gov:AE:2026:national-day',
    allDay: true,
  },
  {
    eventName: 'Dubai Shopping Festival Observance',
    eventCode: 'AE-DU-DSF',
    startDate: '2026-01-15',
    endDate: '2026-01-15',
    countryCode: 'AE',
    subdivisionCode: 'AE-DU',
    eventTypeCode: 'HOLIDAY',
    categoryCode: 'REGIONAL',
    dayPortion: 'FIRST_HALF',
    paidHoliday: false,
    businessDayEffect: 'FIRST_HALF_NON_WORKING',
    externalReference: 'gov:AE-DU:2026:dsf-half',
    allDay: true,
  },
];

export function fixturePackChecksum(holidays: NormalizedHoliday[]): string {
  const payload = holidays
    .map((h) => h.externalReference)
    .sort()
    .join('|');
  return createHash('sha256').update(payload).digest('hex');
}
