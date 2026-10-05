import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { BusinessCalendarModule } from '../business-calendar/business-calendar.module';

import { ReportingTeamScopeService } from './reporting-team-scope.service';
import { WorkforceCalendarController } from './workforce-calendar.controller';
import { WorkforceCalendarService } from './workforce-calendar.service';

@Module({
  imports: [PrismaModule, BusinessCalendarModule],
  controllers: [WorkforceCalendarController],
  providers: [ReportingTeamScopeService, WorkforceCalendarService],
  exports: [ReportingTeamScopeService, WorkforceCalendarService],
})
export class WorkforceCalendarModule {}
