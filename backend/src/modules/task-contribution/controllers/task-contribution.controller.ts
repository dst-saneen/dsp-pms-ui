import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CreateTaskContributionDto, UpdateTaskContributionDto } from '../dto';

import { TaskContributionService } from '../services';
import { OnboardingEnabledGuard } from '../../onboarding-runtime/guards/onboarding-enabled.guard';

@Controller('task-contribution')
@UseGuards(OnboardingEnabledGuard)
export class TaskContributionController {
  constructor(private readonly service: TaskContributionService) {}

  @Post()
  create(
    @Body()
    dto: CreateTaskContributionDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Get('task/:taskId')
  findByTask(
    @Param('taskId', ParseUUIDPipe)
    taskId: string,
  ) {
    return this.service.findByTask(taskId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Body()
    dto: UpdateTaskContributionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.service.remove(id);
  }
}
