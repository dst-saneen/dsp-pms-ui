import {
  assertSupportedImportGeography,
  isValidSubdivisionCode,
  listSupportedJurisdictions,
} from './jurisdictions';

describe('Business Calendar geographic model', () => {
  it('lists India national + state jurisdictions including Kerala', () => {
    const rows = listSupportedJurisdictions();
    expect(rows.some((r) => r.countryCode === 'IN' && !r.subdivisionCode)).toBe(
      true,
    );
    expect(
      rows.some(
        (r) => r.subdivisionCode === 'IN-KL' && r.subdivisionName === 'Kerala',
      ),
    ).toBe(true);
  });

  it('lists UAE and Dubai emirate', () => {
    const rows = listSupportedJurisdictions();
    expect(rows.some((r) => r.countryCode === 'AE' && !r.subdivisionCode)).toBe(
      true,
    );
    expect(rows.some((r) => r.subdivisionCode === 'AE-DU')).toBe(true);
  });

  it('validates India state codes', () => {
    expect(isValidSubdivisionCode('IN', 'IN-KL')).toBe(true);
    expect(isValidSubdivisionCode('IN', 'IN-XX')).toBe(false);
    expect(
      assertSupportedImportGeography({
        countryCode: 'IN',
        subdivisionCode: 'IN-KL',
      }),
    ).toBeNull();
  });
});
