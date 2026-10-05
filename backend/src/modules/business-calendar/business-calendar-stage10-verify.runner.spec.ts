import { STAGE10_REQUIRED_TABLES } from './business-calendar-stage10-verify.runner';

describe('Stage 10 rollout helpers', () => {
  it('requires foundation tables for post-deploy verify', () => {
    expect(STAGE10_REQUIRED_TABLES).toEqual(
      expect.arrayContaining([
        'business_calendars',
        'business_calendar_runtime_days',
        'business_calendar_import_batches',
        'leave_request_calendar_days',
      ]),
    );
    expect(STAGE10_REQUIRED_TABLES).toHaveLength(11);
  });
});
