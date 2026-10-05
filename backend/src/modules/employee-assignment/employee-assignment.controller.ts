import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { EmployeeAssignmentService } from './employee-assignment.service';

import { CreateEmployeeAssignmentDto } from './dto/create-employee-assignment.dto';
import { UpdateEmployeeAssignmentDto } from './dto/update-employee-assignment.dto';

@ApiTags('Employee Assignments')
@Controller('employee-assignments')
export class EmployeeAssignmentController {
  constructor(
    private readonly employeeAssignmentService: EmployeeAssignmentService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create Employee Assignment',
  })
  create(
    @Body()
    dto: CreateEmployeeAssignmentDto,
  ) {
    return this.employeeAssignmentService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Employee Assignments',
  })
  findAll() {
    return this.employeeAssignmentService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Assignment By Id',
  })
  findOne(@Param('id') id: string) {
    return this.employeeAssignmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Assignment',
  })
  update(
    @Param('id') id: string,
    @Body()
    dto: UpdateEmployeeAssignmentDto,
  ) {
    return this.employeeAssignmentService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate Assignment',
  })
  deactivate(@Param('id') id: string) {
    return this.employeeAssignmentService.deactivate(id);
  }
}
