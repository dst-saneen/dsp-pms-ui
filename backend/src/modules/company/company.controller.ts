import { Controller, Get, Post, Body, ParseUUIDPipe } from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { Param, Patch, Delete } from '@nestjs/common';

import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyModuleEntitlementsDto } from './dto/update-company-module-entitlements.dto';
import { RequirePermissions } from '../../common';

@ApiTags('Companies')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Company',
  })
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Companies',
  })
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Company By Id',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.findOne(id);
  }

  @Get(':id/module-entitlements')
  @RequirePermissions('organization.companies.read')
  @ApiOperation({
    summary: 'Get Company Modules and Features',
  })
  findModuleEntitlements(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.findModuleEntitlements(id);
  }

  @Patch(':id/module-entitlements')
  @RequirePermissions('organization.companies.manage')
  @ApiOperation({
    summary: 'Update Company Modules and Features',
  })
  updateModuleEntitlements(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyModuleEntitlementsDto,
  ) {
    return this.companyService.updateModuleEntitlements(id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Company',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Company',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.remove(id);
  }
}
