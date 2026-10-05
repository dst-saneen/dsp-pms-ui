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

import { OnboardingExecutionRuleService } from '../services/onboarding-execution-rule.service';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

import { CreateExecutionRuleDto } from '../dto/create-execution-rule.dto';
import { UpdateExecutionRuleDto } from '../dto/update-execution-rule.dto';

@ApiTags('Onboarding Execution Rules')
@Controller('onboarding-execution-rules')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingExecutionRuleController {
  constructor(private readonly service: OnboardingExecutionRuleService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Execution Rule',
  })
  create(
    @Body()
    dto: CreateExecutionRuleDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Execution Rules',
  })
  findAll() {
    return this.service.findAll();
  }

  @Get('execution-profile/:executionProfileId')
  @ApiOperation({
    summary: 'Get Rules by Execution Profile',
  })
  findByExecutionProfile(
    @Param('executionProfileId')
    executionProfileId: string,
  ) {
    return this.service.findByExecutionProfile(executionProfileId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Execution Rule',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Execution Rule',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateExecutionRuleDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Execution Rule',
  })
  remove(
    @Param('id')
    id: string,
  ) {
    return this.service.remove(id);
  }
}
