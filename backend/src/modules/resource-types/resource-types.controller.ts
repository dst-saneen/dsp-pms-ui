import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
} from '@nestjs/common';

import { ResourceTypesService } from './resource-types.service';

import { CreateResourceTypeDto } from './dto/create-resource-type.dto';
import { UpdateResourceTypeDto } from './dto/update-resource-type.dto';

@Controller('resource-types')
export class ResourceTypesController {
  constructor(private readonly resourceTypesService: ResourceTypesService) {}

  @Post()
  create(@Body() dto: CreateResourceTypeDto) {
    return this.resourceTypesService.create(dto);
  }

  @Get()
  findAll() {
    return this.resourceTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourceTypesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResourceTypeDto) {
    return this.resourceTypesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourceTypesService.remove(id);
  }
}
