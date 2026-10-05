import {
  buildBusinessCalendarScopeKey,
  parseBusinessCalendarScopeKey,
} from './business-calendar-scope.util';

describe('business-calendar-scope.util', () => {
  it('builds company and branch scope keys', () => {
    expect(buildBusinessCalendarScopeKey('COMPANY', 'co-1')).toBe(
      'COMPANY:co-1',
    );
    expect(buildBusinessCalendarScopeKey('BRANCH', 'br-1')).toBe('BRANCH:br-1');
  });

  it('parses scope keys', () => {
    expect(parseBusinessCalendarScopeKey('COMPANY:abc')).toEqual({
      scope: 'COMPANY',
      officeId: 'abc',
    });
    expect(parseBusinessCalendarScopeKey('BRANCH:xyz')).toEqual({
      scope: 'BRANCH',
      officeId: 'xyz',
    });
  });

  it('rejects empty office id', () => {
    expect(() => buildBusinessCalendarScopeKey('COMPANY', '  ')).toThrow(
      /officeId/,
    );
  });

  it('rejects invalid scope key', () => {
    expect(() => parseBusinessCalendarScopeKey('NOPE')).toThrow(/Invalid/);
  });
});
