import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';

import { LeavePolicyMatrixService } from './leave-policy-matrix.service';
import { LeavePolicyService } from './leave-policy.service';

import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import {
  LeavePolicyMatrixQueryDto,
  ReplaceLeavePolicyMatrixDto,
} from './dto/leave-policy-matrix.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { LeavePolicyFilterDto } from './dto/leave-policy-filter.dto';

@ApiTags('Leave Policy')
@Controller('leave-policies')
export class LeavePolicyController {
  constructor(
    private readonly leavePolicyService: LeavePolicyService,
    private readonly leavePolicyMatrixService: LeavePolicyMatrixService,
  ) {}

  @Get('matrix')
  getMatrix(@Query() query: LeavePolicyMatrixQueryDto) {
    return this.leavePolicyMatrixService.getMatrix(query);
  }

  @Put('matrix')
  replaceMatrix(@Body() dto: ReplaceLeavePolicyMatrixDto) {
    return this.leavePolicyMatrixService.replaceMatrix(dto);
  }

  @Post()
  create(@Body() dto: CreateLeavePolicyDto) {
    return this.leavePolicyService.create(dto);
  }

  @Get()
  findAll(@Query() filters: LeavePolicyFilterDto) {
    return this.leavePolicyService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavePolicyService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeavePolicyDto,
  ) {
    return this.leavePolicyService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leavePolicyService.remove(id);
  }
}
