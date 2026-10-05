import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import {
  CreateOvertimePolicyDto,
  OvertimePolicyFilterDto,
  UpdateOvertimePolicyDto,
} from './dto';
import { OvertimePolicyService } from './overtime-policy.service';

@ApiTags('Overtime Policies')
@Controller('overtime-policies')
export class OvertimePolicyController {
  constructor(private readonly overtimePolicyService: OvertimePolicyService) {}

  @Get()
  @RequirePermissions('hr.overtime.read')
  findAll(@Query() filters: OvertimePolicyFilterDto) {
    return this.overtimePolicyService.findAll(filters);
  }

  @Post()
  @RequirePermissions('hr.overtime.manage')
  create(
    @Body() dto: CreateOvertimePolicyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.overtimePolicyService.create(dto, request.user);
  }

  @Get(':id')
  @RequirePermissions('hr.overtime.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.overtimePolicyService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('hr.overtime.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOvertimePolicyDto,
  ) {
    return this.overtimePolicyService.update(id, dto);
  }
}
