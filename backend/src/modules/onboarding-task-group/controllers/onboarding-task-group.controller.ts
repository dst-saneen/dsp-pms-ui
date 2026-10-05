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
  UseGuards,
} from '@nestjs/common';

import {
  CreateOnboardingTaskGroupDto,
  UpdateOnboardingTaskGroupDto,
} from '../dto';

import { OnboardingTaskGroupService } from '../services';
import { VersionedDeleteDto } from '../../onboarding-template/dto';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('onboarding-task-group')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingTaskGroupController {
  constructor(private readonly service: OnboardingTaskGroupService) {}

  @Post()
  create(
    @Body()
    dto: CreateOnboardingTaskGroupDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('department-template/:departmentTemplateId')
  findByDepartmentTemplate(
    @Param('departmentTemplateId', ParseUUIDPipe)
    departmentTemplateId: string,
  ) {
    return this.service.findByDepartmentTemplate(departmentTemplateId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Body()
    dto: UpdateOnboardingTaskGroupDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe)
    id: string,
    @Query() query: VersionedDeleteDto,
  ) {
    return this.service.remove(id, query.expectedVersion);
  }
}
