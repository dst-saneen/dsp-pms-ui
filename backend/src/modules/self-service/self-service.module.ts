import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { CompOffModule } from '../comp-off/comp-off.module';
import { EmployeeAssetModule } from '../employee-asset/employee-asset.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';
import { EmployeeDocumentModule } from '../employee-document/employee-document.module';
import { EmployeeLeaveModule } from '../employee-leave';
import { EmployeeOnboardingModule } from '../employee-onboarding/employee-onboarding.module';
import { LeaveRequestModule } from '../leave-request/leave-request.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
import { OvertimeRequestModule } from '../overtime-request/overtime-request.module';
import { WorkforceCalendarModule } from '../workforce-calendar/workforce-calendar.module';
import { WorkScheduleItemModule } from '../work-schedule-item/work-schedule-item.module';
import { ModuleCapabilitiesModule } from '../module-capabilities';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

import { MeController } from './me.controller';
import { SelfServiceContextService } from './self-service-context.service';
import { SelfServiceService } from './self-service.service';

@Module({
  imports: [
    PrismaModule,
    EmployeeLeaveModule,
    LeaveRequestModule,
    LeavePolicyModule,
    AttendanceModule,
    EmployeeDocumentModule,
    EmployeeAssetModule,
    forwardRef(() => AssetDomainModule),
    forwardRef(() => EmployeeOnboardingModule),
    OvertimeRequestModule,
    CompOffModule,
    WorkforceCalendarModule,
    WorkScheduleItemModule,
    ModuleCapabilitiesModule,
    OnboardingRuntimeModule,
  ],
  controllers: [MeController],
  providers: [SelfServiceContextService, SelfServiceService],
  exports: [SelfServiceContextService, SelfServiceService],
})
export class SelfServiceModule {}
