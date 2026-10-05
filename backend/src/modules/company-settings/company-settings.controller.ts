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
import { ApiTags } from '@nestjs/swagger';

import { CompanySettingsService } from './company-settings.service';
import { CreateCompanySettingDto } from './dto/create-company-setting.dto';
import { UpdateCompanySettingDto } from './dto/update-company-setting.dto';
import { RequirePermissions } from '../../common';

@ApiTags('Company Settings')
@Controller('company-settings')
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  @Post()
  @RequirePermissions('organization.companies.manage')
  create(@Body() dto: CreateCompanySettingDto) {
    return this.companySettingsService.create(dto);
  }

  @Get('company/:companyId')
  @RequirePermissions('organization.companies.read')
  findAllByCompany(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companySettingsService.findAllByCompany(companyId);
  }

  @Get('company/:companyId/key/:settingKey')
  @RequirePermissions('organization.companies.read')
  findByKey(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('settingKey') settingKey: string,
  ) {
    return this.companySettingsService.findByKey(companyId, settingKey);
  }

  @Get(':id')
  @RequirePermissions('organization.companies.read')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.companySettingsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('organization.companies.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanySettingDto,
  ) {
    return this.companySettingsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('organization.companies.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companySettingsService.remove(id);
  }
}
