import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { OnboardingRequirementService } from '../services/onboarding-requirement.service';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

import { CreateRequirementDto } from '../dto/create-requirement.dto';
import { UpdateRequirementDto } from '../dto/update-requirement.dto';

@ApiTags('Onboarding Requirements')
@Controller('onboarding-requirements')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingRequirementController {
  constructor(private readonly service: OnboardingRequirementService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Requirement',
  })
  create(
    @Body()
    dto: CreateRequirementDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Requirements',
  })
  findAll() {
    return this.service.findAll();
  }

  @Get('contribution/:contributionId')
  @ApiOperation({
    summary: 'Get Requirements by Contribution',
  })
  findByContribution(
    @Param('contributionId')
    contributionId: string,
  ) {
    return this.service.findByContribution(contributionId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Requirement',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Requirement',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateRequirementDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Requirement',
  })
  remove(
    @Param('id')
    id: string,
  ) {
    return this.service.remove(id);
  }
}
