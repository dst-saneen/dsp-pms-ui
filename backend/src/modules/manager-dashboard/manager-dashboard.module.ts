import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';

import { ManagerDashboardController } from './manager-dashboard.controller';
import { ManagerDashboardService } from './manager-dashboard.service';

@Module({
  imports: [PrismaModule, AttendanceModule],
  controllers: [ManagerDashboardController],
  providers: [ManagerDashboardService],
  exports: [ManagerDashboardService],
})
export class ManagerDashboardModule {}
