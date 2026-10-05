import {
  isOfficeLocationReady,
  isValidIsoCountryCode,
  isValidIsoSubdivisionCode,
  isValidIanaTimeZone,
} from './business-calendar-validators';

describe('business-calendar-validators', () => {
  it('validates IANA timezones', () => {
    expect(isValidIanaTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidIanaTimeZone('Not/AZone')).toBe(false);
  });

  it('validates ISO country codes', () => {
    expect(isValidIsoCountryCode('IN')).toBe(true);
    expect(isValidIsoCountryCode('in')).toBe(true);
    expect(isValidIsoCountryCode('IND')).toBe(false);
  });

  it('validates ISO subdivision codes', () => {
    expect(isValidIsoSubdivisionCode('IN-KL')).toBe(true);
    expect(isValidIsoSubdivisionCode('AE-DU')).toBe(true);
    expect(isValidIsoSubdivisionCode('IN')).toBe(false);
  });

  it('reports office location readiness', () => {
    expect(
      isOfficeLocationReady({
        countryCode: 'IN',
        countrySubdivisionCode: 'IN-KL',
        timezone: 'Asia/Kolkata',
      }).ready,
    ).toBe(true);

    expect(
      isOfficeLocationReady({
        countryCode: null,
        countrySubdivisionCode: null,
        timezone: 'fdgfdg',
      }).missing,
    ).toEqual(
      expect.arrayContaining([
        'countryCode',
        'countrySubdivisionCode',
        'timezone',
      ]),
    );
  });
});
