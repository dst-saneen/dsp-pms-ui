import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EmployeeOnboardingService } from './employee-onboarding.service';
import { UpdateEmployeeOnboardingDto } from './dto/update-employee-onboarding.dto';
import type { AuthenticatedRequest } from '../auth';
import {
  CancelEmployeeOnboardingDto,
  CompleteEmployeeOnboardingDto,
  StartEmployeeOnboardingDto,
} from '../onboarding-runtime/dto/onboarding-command.dto';
import { EmployeeOnboardingListQueryDto } from '../onboarding-runtime/dto/onboarding-query.dto';
import { EmployeeOnboardingRuntimeService } from '../onboarding-runtime/services/employee-onboarding-runtime.service';
import { OnboardingEnabledGuard } from '../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('employee-onboarding')
@UseGuards(OnboardingEnabledGuard)
export class EmployeeOnboardingController {
  constructor(
    private readonly employeeOnboardingService: EmployeeOnboardingService,
    private readonly runtimeService: EmployeeOnboardingRuntimeService,
  ) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: StartEmployeeOnboardingDto,
  ) {
    return this.runtimeService.start(request.user, body);
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: EmployeeOnboardingListQueryDto,
  ) {
    return this.runtimeService.findAll(request.user, query);
  }

  @Get('summary')
  getSummary() {
    return this.employeeOnboardingService.getSummary();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.employeeOnboardingService.findByEmployee(employeeId);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.runtimeService.findOne(request.user, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeOnboardingDto,
  ) {
    return this.employeeOnboardingService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelEmployeeOnboardingDto,
  ) {
    return this.runtimeService.cancel(request.user, id, dto);
  }

  @Post(':id/complete')
  completeOnboarding(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteEmployeeOnboardingDto,
  ) {
    return this.runtimeService.complete(request.user, id, body);
  }

  @Post(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelEmployeeOnboardingDto,
  ) {
    return this.runtimeService.cancel(request.user, id, dto);
  }
}
