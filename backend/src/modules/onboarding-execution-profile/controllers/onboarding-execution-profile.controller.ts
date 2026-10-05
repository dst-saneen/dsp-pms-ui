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

import { OnboardingExecutionProfileService } from '../services/onboarding-execution-profile.service';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

import { CreateExecutionProfileDto } from '../dto/create-execution-profile.dto';
import { UpdateExecutionProfileDto } from '../dto/update-execution-profile.dto';

@ApiTags('Onboarding Execution Profiles')
@Controller('onboarding-execution-profiles')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingExecutionProfileController {
  constructor(private readonly service: OnboardingExecutionProfileService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Execution Profile',
  })
  create(
    @Body()
    dto: CreateExecutionProfileDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Execution Profiles',
  })
  findAll() {
    return this.service.findAll();
  }

  @Get('contribution/:contributionId')
  @ApiOperation({
    summary: 'Get Execution Profiles by Contribution',
  })
  findByContribution(
    @Param('contributionId')
    contributionId: string,
  ) {
    return this.service.findByContribution(contributionId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Execution Profile',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Execution Profile',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateExecutionProfileDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Execution Profile',
  })
  remove(
    @Param('id')
    id: string,
  ) {
    return this.service.remove(id);
  }
}
