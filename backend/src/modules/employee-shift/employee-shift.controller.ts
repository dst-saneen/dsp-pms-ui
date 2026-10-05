import { Controller, Post, Get, Body, Param } from '@nestjs/common';

import { EmployeeShiftService } from './employee-shift.service';

import { CreateEmployeeShiftDto } from './dto/create-employee-shift.dto';

@Controller('employee-shifts')
export class EmployeeShiftController {
  constructor(private readonly employeeShiftService: EmployeeShiftService) {}

  @Post()
  create(
    @Body()
    dto: CreateEmployeeShiftDto,
  ) {
    return this.employeeShiftService.create(dto);
  }

  @Get()
  findAll() {
    return this.employeeShiftService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.employeeShiftService.findOne(id);
  }
}
