import { BadRequestException, Injectable } from '@nestjs/common';

import { WorkforceErrorCode } from '../../common/constants';
import {
  isValidIanaTimeZone,
  toCalendarDate,
} from '../leave-policy/leave-calendar.util';
import {
  calendarDateToUtcMidnight,
  calendarDateTimeToUtc,
} from './attendance-calendar.util';

@Injectable()
export class BranchTimeService {
  requireTimezone(timezone: string | null | undefined): string {
    const value = timezone?.trim() ?? '';
    if (!value || !isValidIanaTimeZone(value)) {
      throw new BadRequestException({
        code: WorkforceErrorCode.BRANCH_TIMEZONE_REQUIRED,
        message:
          'Branch timezone must be a valid IANA timezone before branch-local workflow dates can be calculated',
      });
    }
    return value;
  }

  businessDate(at: Date, timeZone: string): string {
    return toCalendarDate(at, timeZone);
  }

  businessDateAsUtcMidnight(at: Date, timeZone: string): Date {
    return calendarDateToUtcMidnight(this.businessDate(at, timeZone));
  }

  localDateTimeToUtc(
    calendarDate: string,
    timeHHmm: string,
    timeZone: string,
  ): Date {
    return calendarDateTimeToUtc(calendarDate, timeHHmm, timeZone);
  }
}
