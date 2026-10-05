import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { WorkScheduleItemService } from './work-schedule-item.service';

import { CreateWorkScheduleItemDto } from './dto/create-work-schedule-item.dto';
import { UpdateWorkScheduleItemDto } from './dto/update-work-schedule-item.dto';

@Controller('work-schedule-item')
export class WorkScheduleItemController {
  constructor(
    private readonly workScheduleItemService: WorkScheduleItemService,
  ) {}

  @Post()
  create(@Body() dto: CreateWorkScheduleItemDto) {
    return this.workScheduleItemService.create(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.workScheduleItemService.findById(id);
  }

  @Get('schedule/:workScheduleId')
  findBySchedule(
    @Param('workScheduleId')
    workScheduleId: string,
  ) {
    return this.workScheduleItemService.findBySchedule(workScheduleId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkScheduleItemDto) {
    return this.workScheduleItemService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workScheduleItemService.remove(id);
  }
}
