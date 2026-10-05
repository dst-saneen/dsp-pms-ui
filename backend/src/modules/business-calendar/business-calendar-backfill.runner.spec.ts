import { effectiveYearStart } from './business-calendar-backfill.runner';

describe('Business Calendar backfill effective year', () => {
  it('uses the explicitly supplied year for migration draft dates', () => {
    expect(effectiveYearStart(2031).toISOString()).toBe(
      '2031-01-01T00:00:00.000Z',
    );
  });

  it.each([1999, 2101, 2026.5, Number.NaN])(
    'rejects invalid effective year %s',
    (year) => {
      expect(() => effectiveYearStart(year)).toThrow(
        /integer between 2000 and 2100/,
      );
    },
  );
});
