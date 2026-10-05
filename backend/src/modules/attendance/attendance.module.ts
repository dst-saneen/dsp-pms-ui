import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessCalendarModule } from '../business-calendar/business-calendar.module';
import { OvertimeRequestModule } from '../overtime-request/overtime-request.module';
import { WorkforceApprovalModule } from '../workforce-approval/workforce-approval.module';
import { WorkforcePolicyModule } from '../workforce-policy/workforce-policy.module';

import { AttendanceController } from './attendance.controller';
import { AttendanceExceptionService } from './attendance-exception.service';
import { AttendanceFinalizerService } from './attendance-finalizer.service';
import { AttendancePeriodController } from './attendance-period.controller';
import { AttendancePeriodService } from './attendance-period.service';
import { AttendanceRegularizationService } from './attendance-regularization.service';
import { AttendanceService } from './attendance.service';
import { BranchTimeService } from './branch-time.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BusinessCalendarModule,
    WorkforcePolicyModule,
    WorkforceApprovalModule,
    forwardRef(() => OvertimeRequestModule),
  ],
  controllers: [AttendanceController, AttendancePeriodController],
  providers: [
    AttendanceService,
    BranchTimeService,
    AttendanceExceptionService,
    AttendanceRegularizationService,
    AttendancePeriodService,
    AttendanceFinalizerService,
  ],
  exports: [
    AttendanceService,
    BranchTimeService,
    AttendanceExceptionService,
    AttendanceRegularizationService,
    AttendanceFinalizerService,
  ],
})
export class AttendanceModule {}
