import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { EmployeeDocumentService } from './employee-document.service';

import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';
import { UpdateEmployeeDocumentDto } from './dto/update-employee-document.dto';
import { EmployeeDocumentQueryDto } from './dto/employee-document-query.dto';
import { DocumentExpiryFilterDto } from './dto/document-expiry-filter.dto';
import { VerifyEmployeeDocumentDto } from '../employee-document/dto/verify-employee-document.dto';
import { RejectEmployeeDocumentDto } from '../employee-document/dto/reject-employee-document.dto';

@Controller('employee-documents')
export class EmployeeDocumentController {
  constructor(
    private readonly employeeDocumentService: EmployeeDocumentService,
  ) {}

  @Post()
  @RequirePermissions('hr.documents.manage')
  async create(@Body() dto: CreateEmployeeDocumentDto) {
    return this.employeeDocumentService.toSafeDocument(
      await this.employeeDocumentService.create(dto),
    );
  }

  @Get()
  async findAll(@Query() query: EmployeeDocumentQueryDto) {
    const rows = await this.employeeDocumentService.findAll(query);
    return rows.map((row) => this.employeeDocumentService.toSafeDocument(row));
  }

  @Get('summary')
  summary() {
    return this.employeeDocumentService.summary();
  }

  @Get('expiry')
  async findByExpiry(@Query() filter: DocumentExpiryFilterDto) {
    const rows = await this.employeeDocumentService.findByExpiry(filter);
    return rows.map((row) => this.employeeDocumentService.toSafeDocument(row));
  }

  @Get('employee/:employeeId')
  async findByEmployee(@Param('employeeId') employeeId: string) {
    const rows = await this.employeeDocumentService.findByEmployee(employeeId);
    return rows.map((row) => this.employeeDocumentService.toSafeDocument(row));
  }

  @Get('employee/:employeeId/summary')
  employeeSummary(@Param('employeeId') employeeId: string) {
    return this.employeeDocumentService.employeeSummary(employeeId);
  }

  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeDocumentService.getHistory(id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeDocumentService.toSafeDocument(
      await this.employeeDocumentService.findOne(id),
    );
  }

  @Patch(':id')
  @RequirePermissions('hr.documents.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDocumentDto,
  ) {
    return this.employeeDocumentService.toSafeDocument(
      await this.employeeDocumentService.update(id, dto),
    );
  }

  @Patch(':id/verify')
  @RequirePermissions('hr.documents.manage')
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyEmployeeDocumentDto,
  ) {
    return this.employeeDocumentService.toSafeDocument(
      await this.employeeDocumentService.verify(id, dto),
    );
  }

  @Patch(':id/reject')
  @RequirePermissions('hr.documents.manage')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEmployeeDocumentDto,
  ) {
    return this.employeeDocumentService.toSafeDocument(
      await this.employeeDocumentService.reject(id, dto),
    );
  }

  @Patch(':id/reset')
  @RequirePermissions('hr.documents.manage')
  async resetVerification(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeDocumentService.toSafeDocument(
      await this.employeeDocumentService.resetVerification(id),
    );
  }

  @Delete(':id')
  @RequirePermissions('hr.documents.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeDocumentService.remove(id);
  }
}
