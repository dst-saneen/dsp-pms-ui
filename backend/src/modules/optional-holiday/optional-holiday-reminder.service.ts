import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LeaveRequestStatus } from '../employee-leave/constants';
import {
  addOneCalendarDay,
  isValidIanaTimeZone,
  toCalendarDate,
} from '../leave-policy/leave-calendar.util';
import { WorkforceNotificationEventCode } from '../notification/notification-event.catalog';
import { OutboxWriterService } from '../outbox/outbox-writer.service';

const BATCH_SIZE = 200;
const MAX_BATCHES = 50;

@Injectable()
export class OptionalHolidayReminderService {
  private readonly logger = new Logger(OptionalHolidayReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async runDueReminders(now = new Date()): Promise<{
    scanned: number;
    queued: number;
  }> {
    let scanned = 0;
    let queued = 0;
    let cursor: string | undefined;

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const rows = await this.prisma.leaveRequest.findMany({
        where: {
          optionalHolidayEventId: { not: null },
          status: LeaveRequestStatus.APPROVED,
          isActive: true,
        },
        select: {
          id: true,
          companyId: true,
          employeeId: true,
          fromDate: true,
          employee: {
            select: {
              id: true,
              branchId: true,
              branch: { select: { timezone: true } },
              user: { select: { id: true, status: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (rows.length === 0) {
        break;
      }

      cursor = rows[rows.length - 1]?.id;

      for (const row of rows) {
        scanned += 1;
        const user = row.employee.user;
        if (!user || user.status !== UserStatus.ACTIVE) {
          continue;
        }

        const timezone = row.employee.branch.timezone;
        if (!timezone || !isValidIanaTimeZone(timezone)) {
          continue;
        }

        const today = toCalendarDate(now, timezone);
        const tomorrow = addOneCalendarDay(today);
        const leaveDate = row.fromDate.toISOString().slice(0, 10);
        if (leaveDate !== tomorrow) {
          continue;
        }

        const eventCode =
          WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_TOMORROW;
        const result = await this.prisma.$transaction(async (tx) =>
          this.outboxWriter.write(tx, {
            aggregateType: 'LeaveRequest',
            aggregateId: row.id,
            eventType: eventCode,
            dedupeKey: `${eventCode}:${row.id}:${tomorrow}:${user.id}`,
            companyId: row.companyId,
            branchId: row.employee.branchId,
            payload: {
              leaveRequestId: row.id,
              employeeId: row.employeeId,
              companyId: row.companyId,
              branchId: row.employee.branchId,
              businessDate: tomorrow,
              eventCode,
              recipientUserIds: [user.id],
            },
          }),
        );

        if (result.created) {
          queued += 1;
        }
      }

      if (rows.length < BATCH_SIZE) {
        break;
      }
    }

    this.logger.log(
      `optional_holiday_reminders scanned=${scanned} queued=${queued}`,
    );
    return { scanned, queued };
  }
}
