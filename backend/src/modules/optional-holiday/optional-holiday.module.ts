import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessCalendarModule } from '../business-calendar/business-calendar.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WorkforceApprovalModule } from '../workforce-approval/workforce-approval.module';
import { OptionalHolidayController } from './optional-holiday.controller';
import { OptionalHolidayReminderService } from './optional-holiday-reminder.service';
import { OptionalHolidaySelectionService } from './optional-holiday-selection.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BusinessCalendarModule,
    OutboxModule,
    WorkforceApprovalModule,
  ],
  controllers: [OptionalHolidayController],
  providers: [OptionalHolidaySelectionService, OptionalHolidayReminderService],
  exports: [OptionalHolidaySelectionService, OptionalHolidayReminderService],
})
export class OptionalHolidayModule {}
