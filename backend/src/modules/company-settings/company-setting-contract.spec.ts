import { BadRequestException } from '@nestjs/common';

import { normalizeCompanySettingValue } from './company-setting-contract';

describe('company setting contract', () => {
  it('normalizes the configured projects week start', () => {
    expect(
      normalizeCompanySettingValue('projects.week_start', ' monday '),
    ).toBe('MONDAY');
  });

  it('rejects an invalid typed value', () => {
    expect(() =>
      normalizeCompanySettingValue('projects.week_start', 'someday'),
    ).toThrow(BadRequestException);
  });

  it('rejects unregistered settings instead of accepting arbitrary keys', () => {
    expect(() =>
      normalizeCompanySettingValue('tenant.currency', 'INR'),
    ).toThrow("Unsupported company setting 'tenant.currency'.");
  });
});
