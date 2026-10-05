import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';

import { HolidayService } from './holiday.service';

import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidayFilterDto } from './dto/holiday-filter.dto';

@ApiTags('Holiday')
@Controller('holidays')
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post()
  create(@Body() dto: CreateHolidayDto) {
    return this.holidayService.create(dto);
  }

  @Get()
  findAll(@Query() filters: HolidayFilterDto) {
    return this.holidayService.findAll(filters);
  }

  @Get('directory')
  listDirectory(@Query() filters: HolidayFilterDto) {
    return this.holidayService.listDirectory(filters);
  }

  @Get('source')
  listSources() {
    return this.holidayService.listSources();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.holidayService.findOne(id);
  }
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidayService.update(id, dto);
  }
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.holidayService.remove(id);
  }
}
