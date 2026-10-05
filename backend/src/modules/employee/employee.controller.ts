import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { EmployeeService } from './employee.service';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';

@ApiTags('Employees')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Employee',
  })
  create(
    @Body()
    dto: CreateEmployeeDto,
  ) {
    return this.employeeService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Employees',
  })
  findAll(
    @Query()
    query: SearchEmployeeDto,
  ) {
    return this.employeeService.findAll(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Employee Dashboard Summary',
  })
  summary() {
    return this.employeeService.summary();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Employee By Id',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Employee',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate Employee',
  })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.deactivate(id);
  }
}
