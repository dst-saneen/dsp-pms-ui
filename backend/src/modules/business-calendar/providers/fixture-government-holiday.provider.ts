import { Injectable } from '@nestjs/common';

import { BusinessCalendarErrorCode } from '../business-calendar-error-codes';
import { listSupportedJurisdictions } from '../geographic/jurisdictions';
import { INDIA_2026_FIXTURE, UAE_2026_FIXTURE } from './holiday-fixtures';
import type {
  GovernmentHolidayProvider,
  Jurisdiction,
  NormalizedHoliday,
} from './government-holiday-provider';

const REVIEWED_FIXTURE_YEAR = 2026;
const REVIEWED_SUBDIVISIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  IN: new Set(['IN-KL']),
  AE: new Set(['AE-DU']),
};

function unavailableFixture(message: string, code: string): Error {
  const error = new Error(
    `${message} Use the controlled CSV, Excel, or ICS import and complete validation and review before applying it to a draft.`,
  ) as Error & { code?: string };
  error.code = code;
  return error;
}

/**
 * Fixture-backed provider for India + Middle East (Stage 7).
 * Real government API adapters can replace this without changing import flow.
 */
@Injectable()
export class FixtureGovernmentHolidayProvider implements GovernmentHolidayProvider {
  listJurisdictions(): Promise<Jurisdiction[]> {
    return Promise.resolve(
      listSupportedJurisdictions().filter((jurisdiction) => {
        const supportedSubdivisions =
          REVIEWED_SUBDIVISIONS[jurisdiction.countryCode];
        return (
          supportedSubdivisions !== undefined &&
          (jurisdiction.subdivisionCode === null ||
            supportedSubdivisions.has(jurisdiction.subdivisionCode))
        );
      }),
    );
  }

  fetchHolidays(input: {
    countryCode: string;
    subdivisionCode?: string;
    year: number;
  }): Promise<NormalizedHoliday[]> {
    const country = input.countryCode.trim().toUpperCase();
    const subdivision = input.subdivisionCode?.trim().toUpperCase() || null;

    const supportedSubdivisions = REVIEWED_SUBDIVISIONS[country];
    if (!supportedSubdivisions) {
      return Promise.reject(
        unavailableFixture(
          `No reviewed government holiday fixture is available for country ${country || '(blank)'}.`,
          BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_FIXTURE_COUNTRY_UNSUPPORTED,
        ),
      );
    }

    if (input.year !== REVIEWED_FIXTURE_YEAR) {
      return Promise.reject(
        unavailableFixture(
          `No reviewed government holiday fixture is available for ${country} in ${input.year}.`,
          BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_FIXTURE_YEAR_UNSUPPORTED,
        ),
      );
    }

    if (subdivision && !supportedSubdivisions.has(subdivision)) {
      return Promise.reject(
        unavailableFixture(
          `No reviewed government holiday fixture is available for subdivision ${subdivision} in ${country}.`,
          BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_FIXTURE_SUBDIVISION_UNSUPPORTED,
        ),
      );
    }

    const pack = country === 'IN' ? INDIA_2026_FIXTURE : UAE_2026_FIXTURE;

    const holidays = pack.filter((row) => {
      if (row.countryCode !== country) return false;
      if (!subdivision) {
        return row.subdivisionCode == null;
      }
      return row.subdivisionCode == null || row.subdivisionCode === subdivision;
    });

    if (holidays.length === 0) {
      return Promise.reject(
        unavailableFixture(
          `The reviewed government holiday fixture for ${subdivision ?? country} in ${input.year} contains no holidays.`,
          BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_FIXTURE_EMPTY,
        ),
      );
    }

    return Promise.resolve(holidays);
  }
}
