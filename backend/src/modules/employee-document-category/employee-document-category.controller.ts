import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { EmployeeDocumentCategoryService } from './employee-document-category.service';

import { CreateEmployeeDocumentCategoryDto } from './dto/create-employee-document-category.dto';
import { UpdateEmployeeDocumentCategoryDto } from './dto/update-employee-document-category.dto';
import { EmployeeDocumentCategoryQueryDto } from './dto/employee-document-category-query.dto';

@Controller('employee-document-categories')
export class EmployeeDocumentCategoryController {
  constructor(
    private readonly employeeDocumentCategoryService: EmployeeDocumentCategoryService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateEmployeeDocumentCategoryDto,
  ) {
    return this.employeeDocumentCategoryService.create(dto);
  }

  @Get()
  findAll(
    @Query()
    query: EmployeeDocumentCategoryQueryDto,
  ) {
    return this.employeeDocumentCategoryService.findAll(query.companyId);
  }

  @Get('lookup')
  lookup(@Query('companyId') companyId?: string) {
    return this.employeeDocumentCategoryService.lookup(companyId);
  }

  @Get('summary')
  summary() {
    return this.employeeDocumentCategoryService.summary();
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.employeeDocumentCategoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateEmployeeDocumentCategoryDto,
  ) {
    return this.employeeDocumentCategoryService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id')
    id: string,
  ) {
    return this.employeeDocumentCategoryService.remove(id);
  }
}
