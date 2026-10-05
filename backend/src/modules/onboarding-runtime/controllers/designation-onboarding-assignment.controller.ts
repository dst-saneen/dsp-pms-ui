import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../../auth';

import {
  DeactivateDesignationOnboardingAssignmentDto,
  DesignationOnboardingAssignmentQueryDto,
  WriteDesignationOnboardingAssignmentDto,
} from '../dto/designation-assignment.dto';
import { DesignationOnboardingAssignmentService } from '../services/designation-onboarding-assignment.service';
import { OnboardingEnabledGuard } from '../guards/onboarding-enabled.guard';

@Controller('designation-onboarding-assignments')
@UseGuards(OnboardingEnabledGuard)
export class DesignationOnboardingAssignmentController {
  constructor(
    private readonly service: DesignationOnboardingAssignmentService,
  ) {}

  @Get()
  findAll(@Query() query: DesignationOnboardingAssignmentQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: WriteDesignationOnboardingAssignmentDto,
  ) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WriteDesignationOnboardingAssignmentDto,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Post(':id/deactivate')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeactivateDesignationOnboardingAssignmentDto,
  ) {
    return this.service.deactivate(request.user, id, dto);
  }
}
