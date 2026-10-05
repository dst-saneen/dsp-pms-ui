import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CompanyModule } from './modules/company/company.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config';
import { AuditModule } from './modules/audit/audit.module';
import { CompanyGroupModule } from './modules/company-group/company-group.module';
import { BranchModule } from './modules/branch/branch.module';
import { DepartmentModule } from './modules/department/department.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { EmployeeAssignmentModule } from './modules/employee-assignment/employee-assignment.module';
import { DesignationModule } from './modules/designation/designation.module';
import { HrRequestTypeModule } from './modules/hr-request-type/hr-request-type.module';
import { HrRequestModule } from './modules/hr-request/hr-request.module';
import { ApprovalWorkflowModule } from './modules/approval-workflow/approval-workflow.module';
import { ApprovalWorkflowStepModule } from './modules/approval-workflow-step/approval-workflow-step.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CompanySettingsModule } from './modules/company-settings/company-settings.module';
import { HolidayModule } from './modules/holiday/holiday.module';
import { BusinessCalendarModule } from './modules/business-calendar/business-calendar.module';
import { LeaveTypeModule } from './modules/leave-type/leave-type.module';
import { LeavePolicyModule } from './modules/leave-policy/leave-policy.module';
import { EmployeeLeaveBalanceModule } from './modules/employee-leave-balance/employee-leave-balance.module';
import { LeaveRequestModule } from './modules/leave-request/leave-request.module';
import { OptionalHolidayModule } from './modules/optional-holiday/optional-holiday.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { WorkforcePolicyModule } from './modules/workforce-policy/workforce-policy.module';
import { WorkforceApprovalModule } from './modules/workforce-approval/workforce-approval.module';
import { CompOffModule } from './modules/comp-off/comp-off.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { OvertimeRequestModule } from './modules/overtime-request/overtime-request.module';
import { ShiftRosterModule } from './modules/shift-roster/shift-roster.module';
import { WorkforceCalendarModule } from './modules/workforce-calendar/workforce-calendar.module';
import { WorkforceJobsModule } from './modules/workforce-jobs/workforce-jobs.module';
import { EmployeeSeparationModule } from './modules/employee-separation/employee-separation.module';
import { ShiftModule } from './modules/shift/shift.module';
import { EmployeeShiftModule } from './modules/employee-shift/employee-shift.module';
import { AssetTypeModule } from './modules/asset-type/asset-type.module';
import { AssetModule } from './modules/asset/asset.module';
import { EmployeeAssetModule } from './modules/employee-asset/employee-asset.module';
import { EmployeeDocumentTypeModule } from './modules/employee-document-type/employee-document-type.module';
import { EmployeeDocumentModule } from './modules/employee-document/employee-document.module';
import { EmployeeClearanceModule } from './modules/employee-clearance/employee-clearance.module';
import { OnboardingTemplateModule } from './modules/onboarding-template/onboarding-template.module';
import { OnboardingTemplateTaskModule } from './modules/onboarding-template-task/onboarding-template-task.module';
import { EmployeeOnboardingModule } from './modules/employee-onboarding/employee-onboarding.module';
import { EmployeeOnboardingTaskModule } from './modules/employee-onboarding-task/employee-onboarding-task.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AssetCategoryModule } from './modules/asset-category/asset-category.module';
import { AssetDepartmentGrantModule } from './modules/asset-department-grant/asset-department-grant.module';
import { AssetLicenseAllocationModule } from './modules/asset-license-allocation/asset-license-allocation.module';
import { AssetTransferModule } from './modules/asset-transfer/asset-transfer.module';
import { AssetCustodyRequestModule } from './modules/asset-custody-request/asset-custody-request.module';
import { AssetClearanceModule } from './modules/asset-clearance/asset-clearance.module';
import { AssetDomainModule } from './modules/asset-domain/asset-domain.module';
import { EmployeeDocumentCategoryModule } from './modules/employee-document-category/employee-document-category.module';
import { EmployeeWorkspaceModule } from './modules/employee-workspace/employee-workspace.module';
import { EmployeeProfileModule } from './modules/employee/employee-profile/employee-profile.module';
import { EmployeeLeaveModule } from './modules/employee-leave';
import { OnboardingContributionModule } from './modules/onboarding-contribution/onboarding-contribution.module';
import { OnboardingRequirementModule } from './modules/onboarding-requirement/onboarding-requirement.module';
import { OnboardingDepartmentTemplateModule } from './modules/onboarding-department-template/onboarding-department-template.module';
import { OnboardingTaskGroupModule } from './modules/onboarding-task-group';
import { TaskContributionModule } from './modules/task-contribution';
import { OnboardingWorkspaceModule } from './modules/onboarding-workspace';
import { HealthModule } from './modules/health';
import { AuthModule } from './modules/auth';
import { NumberSeriesModule } from './modules/number-series';
import { OrganizationOnboardingModule } from './modules/organization-onboarding';
import { EmployeeLifecycleSummaryModule } from './modules/employee-lifecycle-summary';
import { SelfServiceModule } from './modules/self-service';
import { ManagerDashboardModule } from './modules/manager-dashboard';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { OnboardingRuntimeModule } from './modules/onboarding-runtime/onboarding-runtime.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { OfficeFinanceModule } from './modules/office-finance/office-finance.module';
import { ModuleCapabilitiesModule } from './modules/module-capabilities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      skipProcessEnv: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    NumberSeriesModule,
    AuthModule,
    OrganizationOnboardingModule,
    SelfServiceModule,
    ManagerDashboardModule,
    RecruitmentModule,
    OnboardingRuntimeModule,
    DeliveryModule,
    FileStorageModule,
    ModuleCapabilitiesModule,
    OfficeFinanceModule,
    HealthModule,
    CompanyModule,
    AuditModule,
    CompanyGroupModule,
    BranchModule,
    DepartmentModule,
    EmployeeModule,
    EmployeeAssignmentModule,
    DesignationModule,
    HrRequestTypeModule,
    HrRequestModule,
    ApprovalWorkflowModule,
    ApprovalWorkflowStepModule,
    ProjectsModule,
    CompanySettingsModule,
    HolidayModule,
    BusinessCalendarModule,
    LeaveTypeModule,
    LeavePolicyModule,
    EmployeeLeaveBalanceModule,
    LeaveRequestModule,
    OptionalHolidayModule,
    AttendanceModule,
    WorkforcePolicyModule,
    WorkforceApprovalModule,
    ShiftRosterModule,
    OvertimeRequestModule,
    CompOffModule,
    NotificationModule,
    OutboxModule,
    WorkforceJobsModule,
    WorkforceCalendarModule,
    EmployeeSeparationModule,
    ShiftModule,
    EmployeeShiftModule,
    AssetTypeModule,
    AssetModule,
    EmployeeAssetModule,
    EmployeeDocumentTypeModule,
    EmployeeDocumentModule,
    EmployeeClearanceModule,
    OnboardingTemplateModule,
    OnboardingTemplateTaskModule,
    EmployeeOnboardingModule,
    EmployeeLifecycleSummaryModule,
    EmployeeOnboardingTaskModule,
    PayrollModule,
    AssetCategoryModule,
    AssetDepartmentGrantModule,
    AssetLicenseAllocationModule,
    AssetTransferModule,
    AssetCustodyRequestModule,
    AssetClearanceModule,
    AssetDomainModule,
    EmployeeDocumentCategoryModule,
    EmployeeWorkspaceModule,
    EmployeeProfileModule,
    EmployeeLeaveModule,
    OnboardingContributionModule,
    OnboardingRequirementModule,
    OnboardingDepartmentTemplateModule,
    OnboardingTaskGroupModule,
    TaskContributionModule,
    OnboardingWorkspaceModule,
  ],
})
export class AppModule {}
