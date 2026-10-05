import { Module } from '@nestjs/common';

import { EmployeeShiftController } from './employee-shift.controller';
import { EmployeeShiftService } from './employee-shift.service';

import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeShiftController],
  providers: [EmployeeShiftService],
})
export class EmployeeShiftModule {}
