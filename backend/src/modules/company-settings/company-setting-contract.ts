import { BadRequestException } from '@nestjs/common';

export const COMPANY_SETTING_KEYS = ['projects.week_start'] as const;

export type CompanySettingKey = (typeof COMPANY_SETTING_KEYS)[number];

const WEEKDAYS = new Set([
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);

export function normalizeCompanySettingValue(
  settingKey: string,
  settingValue: string,
): string {
  const value = settingValue.trim();

  if (settingKey === 'projects.week_start') {
    const weekday = value.toUpperCase();
    if (!WEEKDAYS.has(weekday)) {
      throw new BadRequestException(
        'projects.week_start must be a weekday name.',
      );
    }
    return weekday;
  }

  throw new BadRequestException(`Unsupported company setting '${settingKey}'.`);
}
