import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { EmployeeDocumentTypeService } from './employee-document-type.service';
import { CreateEmployeeDocumentTypeDto } from './dto/create-employee-document-type.dto';
import { UpdateEmployeeDocumentTypeDto } from './dto/update-employee-document-type.dto';

@Controller('employee-document-types')
export class EmployeeDocumentTypeController {
  constructor(
    private readonly employeeDocumentTypeService: EmployeeDocumentTypeService,
  ) {}

  @Post()
  create(@Body() dto: CreateEmployeeDocumentTypeDto) {
    return this.employeeDocumentTypeService.create(dto);
  }

  @Get()
  findAll() {
    return this.employeeDocumentTypeService.findAll();
  }

  @Get('summary')
  summary() {
    return this.employeeDocumentTypeService.summary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeeDocumentTypeService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDocumentTypeDto) {
    return this.employeeDocumentTypeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeeDocumentTypeService.remove(id);
  }
}
