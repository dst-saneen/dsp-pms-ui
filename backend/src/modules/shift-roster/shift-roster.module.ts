import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessCalendarModule } from '../business-calendar/business-calendar.module';
import { OutboxModule } from '../outbox/outbox.module';

import { ShiftRosterController } from './shift-roster.controller';
import { ShiftRosterGenerationService } from './shift-roster-generation.service';
import { ShiftRosterOutboxService } from './shift-roster-outbox.service';
import { ShiftRosterService } from './shift-roster.service';

@Module({
  imports: [PrismaModule, AuditModule, OutboxModule, BusinessCalendarModule],
  controllers: [ShiftRosterController],
  providers: [
    ShiftRosterService,
    ShiftRosterGenerationService,
    ShiftRosterOutboxService,
  ],
  exports: [ShiftRosterService, ShiftRosterGenerationService],
})
export class ShiftRosterModule {}
