import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { WorkScheduleService } from './work-schedule.service';
import { WorkScheduleController } from './work-schedule.controller';

@Module({
  imports: [PrismaModule],
  providers: [WorkScheduleService],
  controllers: [WorkScheduleController],
})
export class WorkScheduleModule {}
