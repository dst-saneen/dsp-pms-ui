import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../auth';
import { RequireAnyPermissions } from '../../../common/decorators/require-permissions.decorator';
import { OverrideStartEmployeeOnboardingDto } from '../dto/onboarding-command.dto';
import { OnboardingPreflightQueryDto } from '../dto/onboarding-query.dto';
import {
  AssignOnboardingTaskDto,
  FulfillOnboardingAssetTaskDto,
  UnassignOnboardingTaskDto,
  WaiveOnboardingTaskDto,
} from '../dto/task-command.dto';
import {
  AssigneeCandidatesQueryDto,
  AssetCandidatesQueryDto,
  DepartmentQueueQueryDto,
  MyOnboardingTasksQueryDto,
  TaskHistoryQueryDto,
} from '../dto/task-query.dto';
import { EmployeeOnboardingRuntimeService } from '../services/employee-onboarding-runtime.service';
import { EmployeeOnboardingTaskRuntimeService } from '../services/employee-onboarding-task-runtime.service';
import {
  ONBOARDING_TASK_RUNTIME_ACT_ANY,
  ONBOARDING_TASK_RUNTIME_READ_ANY,
} from '../constants/onboarding-permissions';
import { OnboardingEnabledGuard } from '../guards/onboarding-enabled.guard';

@ApiTags('Onboarding')
@Controller()
@UseGuards(OnboardingEnabledGuard)
export class OnboardingRuntimeController {
  constructor(
    private readonly onboardingRuntime: EmployeeOnboardingRuntimeService,
    private readonly taskRuntime: EmployeeOnboardingTaskRuntimeService,
  ) {}

  @Get('employee-onboarding/preflight')
  preflight(
    @Req() request: AuthenticatedRequest,
    @Query() query: OnboardingPreflightQueryDto,
  ) {
    return this.onboardingRuntime.preflight(request.user, query);
  }

  @Post('employee-onboarding/override-start')
  overrideStart(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OverrideStartEmployeeOnboardingDto,
  ) {
    return this.onboardingRuntime.overrideStart(request.user, dto);
  }

  @Get('employee-onboarding/:id/completion-preflight')
  completionPreflight(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.onboardingRuntime.completionPreflight(request.user, id);
  }

  @Get('me/onboarding/workspace-capabilities')
  workspaceCapabilities(@Req() request: AuthenticatedRequest) {
    return this.taskRuntime.workspaceCapabilities(request.user);
  }

  @Get('me/onboarding-tasks')
  myTasks(
    @Req() request: AuthenticatedRequest,
    @Query() query: MyOnboardingTasksQueryDto,
  ) {
    return this.taskRuntime.myTasks(request.user, query);
  }

  @Get('employee-onboarding-task/department-queue')
  departmentQueue(
    @Req() request: AuthenticatedRequest,
    @Query() query: DepartmentQueueQueryDto,
  ) {
    return this.taskRuntime.departmentQueue(request.user, query);
  }

  @Get('employee-onboarding-task/:id')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_READ_ANY)
  getTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskRuntime.getTask(request.user, id);
  }

  @Get('employee-onboarding-task/:id/assignee-candidates')
  assigneeCandidates(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AssigneeCandidatesQueryDto,
  ) {
    return this.taskRuntime.assigneeCandidates(request.user, id, query);
  }

  @Get('employee-onboarding-task/:id/reopen-preflight')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_READ_ANY)
  reopenPreflight(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskRuntime.reopenPreflight(request.user, id);
  }

  @Get('employee-onboarding-task/:id/history')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_READ_ANY)
  taskHistory(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskHistoryQueryDto,
  ) {
    return this.taskRuntime.getTaskHistory(request.user, id, query);
  }

  @Get('employee-onboarding-task/:id/asset-candidates')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_READ_ANY)
  assetCandidates(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AssetCandidatesQueryDto,
  ) {
    return this.taskRuntime.assetCandidates(request.user, id, query);
  }

  @Post('employee-onboarding-task/:id/fulfill-asset')
  @RequireAnyPermissions(...ONBOARDING_TASK_RUNTIME_ACT_ANY)
  fulfillAsset(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FulfillOnboardingAssetTaskDto,
  ) {
    return this.taskRuntime.fulfillAssetTask(request.user, id, dto);
  }

  @Post('employee-onboarding-task/:id/assign')
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignOnboardingTaskDto,
  ) {
    return this.taskRuntime.assign(request.user, id, dto);
  }

  @Post('employee-onboarding-task/:id/unassign')
  unassign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnassignOnboardingTaskDto,
  ) {
    return this.taskRuntime.unassign(request.user, id, dto);
  }

  @Post('employee-onboarding-task/:id/waive')
  waive(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WaiveOnboardingTaskDto,
  ) {
    return this.taskRuntime.waiveTask(request.user, id, dto);
  }
}
