import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { WorkScheduleItemController } from './work-schedule-item.controller';
import { WorkScheduleItemService } from './work-schedule-item.service';

@Module({
  imports: [PrismaModule],

  providers: [WorkScheduleItemService],

  controllers: [WorkScheduleItemController],

  exports: [WorkScheduleItemService],
})
export class WorkScheduleItemModule {}
