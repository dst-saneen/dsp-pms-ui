import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { EmployeeDeductionService } from './employee-deduction.service';
import { CreateEmployeeDeductionDto } from './dto/create-employee-deduction.dto';
import { UpdateEmployeeDeductionDto } from './dto/update-employee-deduction.dto';

@Controller('employee-deduction')
export class EmployeeDeductionController {
  constructor(
    private readonly employeeDeductionService: EmployeeDeductionService,
  ) {}

  @Post()
  create(@Body() createEmployeeDeductionDto: CreateEmployeeDeductionDto) {
    return this.employeeDeductionService.create(createEmployeeDeductionDto);
  }

  @Get()
  findAll() {
    return this.employeeDeductionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeDeductionService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDeductionDto,
  ) {
    return this.employeeDeductionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeDeductionService.remove(id);
  }
}
