import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { WorkCategoryService } from './work-category.service';

import { CreateWorkCategoryDto } from './dto/create-work-category.dto';
import { UpdateWorkCategoryDto } from './dto/update-work-category.dto';

@Controller('work-category')
export class WorkCategoryController {
  constructor(private readonly workCategoryService: WorkCategoryService) {}

  @Post()
  create(@Body() dto: CreateWorkCategoryDto) {
    return this.workCategoryService.create(dto);
  }

  @Get()
  findAll() {
    return this.workCategoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workCategoryService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkCategoryDto) {
    return this.workCategoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workCategoryService.remove(id);
  }
}
