import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { HolidayService } from './holiday.service';
import { HolidayController } from './holiday.controller';

@Module({
  imports: [PrismaModule],
  providers: [HolidayService],
  controllers: [HolidayController],
})
export class HolidayModule {}
