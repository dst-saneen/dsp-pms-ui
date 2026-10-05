import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { DepartmentService } from './department.service';

import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Department',
  })
  create(
    @Body()
    dto: CreateDepartmentDto,
  ) {
    return this.departmentService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Departments',
  })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.departmentService.findAll(branchId, companyId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Department By Id',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Department',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Department',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentService.remove(id);
  }
}
