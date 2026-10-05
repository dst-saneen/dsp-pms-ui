import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { CompanyGroupService } from './company-group.service';

import { CreateCompanyGroupDto } from './dto/create-company-group.dto';

import { UpdateCompanyGroupDto } from './dto/update-company-group.dto';

@ApiTags('Company Groups')
@Controller('company-groups')
export class CompanyGroupController {
  constructor(private readonly companyGroupService: CompanyGroupService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Company Group',
  })
  create(
    @Body()
    dto: CreateCompanyGroupDto,
  ) {
    return this.companyGroupService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Company Groups',
  })
  findAll() {
    return this.companyGroupService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Company Group By Id',
  })
  findOne(@Param('id') id: string) {
    return this.companyGroupService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Company Group',
  })
  update(
    @Param('id') id: string,
    @Body()
    dto: UpdateCompanyGroupDto,
  ) {
    return this.companyGroupService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Company Group',
  })
  remove(@Param('id') id: string) {
    return this.companyGroupService.remove(id);
  }
}
