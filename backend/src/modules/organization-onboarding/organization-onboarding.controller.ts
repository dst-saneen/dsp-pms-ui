import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth';
import { OwnerEmployeeSelectionDto } from './dto/owner-employee-selection.dto';
import { UpdateOnboardingStepDto } from './dto/update-onboarding-step.dto';
import { OrganizationOnboardingService } from './organization-onboarding.service';

@ApiBearerAuth()
@ApiTags('Organization Onboarding')
@Controller('organization-onboarding')
export class OrganizationOnboardingController {
  constructor(
    private readonly onboardingService: OrganizationOnboardingService,
  ) {}

  @Get()
  getStatus(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.getStatus(request.user.id);
  }

  @Patch('step')
  updateStep(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOnboardingStepDto,
  ) {
    return this.onboardingService.updateStep(request.user.id, dto.currentStep);
  }

  @Post('complete')
  complete(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OwnerEmployeeSelectionDto,
  ) {
    return this.onboardingService.complete(request.user.id, dto);
  }

  @Post('repair-owner-employee')
  repairOwnerEmployee(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OwnerEmployeeSelectionDto,
  ) {
    return this.onboardingService.repairOwnerEmployee(request.user.id, dto);
  }
}
