import { resolveRoutePermissions } from '../auth/route-policy';
import { BusinessCalendarPermission } from './business-calendar.permissions';

describe('Stage 9 route permission mapping', () => {
  it('maps business calendar read paths', () => {
    expect(resolveRoutePermissions('business-calendars', 'GET')).toEqual([
      BusinessCalendarPermission.READ,
    ]);
    expect(resolveRoutePermissions('business-calendar-imports', 'GET')).toEqual(
      [BusinessCalendarPermission.READ],
    );
    expect(resolveRoutePermissions('business-calendar/impacts', 'GET')).toEqual(
      [BusinessCalendarPermission.READ],
    );
  });

  it('maps manage for POST create paths', () => {
    expect(
      resolveRoutePermissions('business-calendars/company', 'POST'),
    ).toEqual([BusinessCalendarPermission.MANAGE]);
  });

  it('maps publish action for publish endpoints', () => {
    expect(
      resolveRoutePermissions('business-calendar-versions/v1/publish', 'POST'),
    ).toEqual([BusinessCalendarPermission.PUBLISH]);
  });
});
