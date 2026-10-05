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
  CreateOnboardingTemplateTaskDto,
  UpdateOnboardingTemplateTaskDto,
} from '../dto';

import { OnboardingTemplateTaskService } from '../services';
import { VersionedDeleteDto } from '../../onboarding-template/dto';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('onboarding-template-task')
@UseGuards(OnboardingEnabledGuard)
export class OnboardingTemplateTaskController {
  constructor(private readonly service: OnboardingTemplateTaskService) {}

  @Post()
  create(
    @Body()
    dto: CreateOnboardingTemplateTaskDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('task-group/:taskGroupId')
  findByTaskGroup(
    @Param('taskGroupId', ParseUUIDPipe)
    taskGroupId: string,
  ) {
    return this.service.findByTaskGroup(taskGroupId);
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
    dto: UpdateOnboardingTemplateTaskDto,
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
