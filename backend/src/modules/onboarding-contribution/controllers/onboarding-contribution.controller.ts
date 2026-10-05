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

import { OnboardingContributionService } from '../services/onboarding-contribution.service';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

import { CreateContributionDto } from '../dto/create-contribution.dto';
import { UpdateContributionDto } from '../dto/update-contribution.dto';

@ApiTags('Onboarding Contributions')
@Controller('onboarding-contributions')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingContributionController {
  constructor(private readonly service: OnboardingContributionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Contribution',
  })
  create(
    @Body()
    dto: CreateContributionDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Contributions',
  })
  findAll() {
    return this.service.findAll();
  }

  @Get('department-template/:departmentTemplateId')
  @ApiOperation({
    summary: 'Get Contributions by Department Template',
  })
  findByDepartmentTemplate(
    @Param('departmentTemplateId')
    departmentTemplateId: string,
  ) {
    return this.service.findByDepartmentTemplate(departmentTemplateId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Contribution',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Contribution',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateContributionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Contribution',
  })
  remove(
    @Param('id')
    id: string,
  ) {
    return this.service.remove(id);
  }
}
