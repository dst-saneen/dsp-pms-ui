import {
  Body,
  Controller,
  Param,
  Post,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth';
import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';
import {
  AssignOnboardingTaskDto,
  CompleteOnboardingTaskCommandDto,
  ReopenOnboardingTaskCommandDto,
  SkipOnboardingTaskCommandDto,
  StartOnboardingTaskCommandDto,
  UnassignOnboardingTaskDto,
} from '../onboarding-runtime/dto/task-command.dto';
import { EmployeeOnboardingTaskRuntimeService } from '../onboarding-runtime/services/employee-onboarding-task-runtime.service';
import { ONBOARDING_TASK_RUNTIME_ACT_ANY } from '../onboarding-runtime/constants/onboarding-permissions';
import { OnboardingEnabledGuard } from '../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('employee-onboarding-task')
@UseGuards(OnboardingEnabledGuard)
export class EmployeeOnboardingTaskController {
  constructor(
    private readonly taskRuntime: EmployeeOnboardingTaskRuntimeService,
  ) {}

  @Post(':id/start')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_ACT_ANY)
  startTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartOnboardingTaskCommandDto,
  ) {
    return this.taskRuntime.startTask(request.user, id, dto);
  }

  @Post(':id/complete')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_ACT_ANY)
  completeTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteOnboardingTaskCommandDto,
  ) {
    return this.taskRuntime.completeTask(request.user, id, dto);
  }

  @Post(':id/skip')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_ACT_ANY)
  skipTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkipOnboardingTaskCommandDto,
  ) {
    return this.taskRuntime.skipTask(request.user, id, dto);
  }

  @Post(':id/reopen')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_ACT_ANY)
  reopenTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenOnboardingTaskCommandDto,
  ) {
    return this.taskRuntime.reopenTask(request.user, id, dto);
  }

  @Post(':id/assign')
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignOnboardingTaskDto,
  ) {
    return this.taskRuntime.assign(request.user, id, dto);
  }

  @Post(':id/unassign')
  unassign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnassignOnboardingTaskDto,
  ) {
    return this.taskRuntime.unassign(request.user, id, dto);
  }
}
