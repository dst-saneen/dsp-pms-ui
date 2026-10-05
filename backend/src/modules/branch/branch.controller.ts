import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { BranchService } from './branch.service';

import { CreateBranchDto } from './dto/create-branch.dto';

import { UpdateBranchDto } from './dto/update-branch.dto';
import { ReplaceBranchWorkingDaysDto } from './dto/replace-branch-working-days.dto';

@ApiTags('Branches')
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Branch',
  })
  create(
    @Body()
    dto: CreateBranchDto,
  ) {
    return this.branchService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Branches',
  })
  findAll(@Query('companyId') companyId?: string) {
    return this.branchService.findAll(companyId);
  }

  @Get(':id/working-days')
  @ApiOperation({ summary: 'Get branch working calendar' })
  getWorkingDays(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchService.getWorkingDays(id);
  }

  @Put(':id/working-days')
  @ApiOperation({ summary: 'Replace branch working calendar' })
  replaceWorkingDays(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceBranchWorkingDaysDto,
  ) {
    return this.branchService.replaceWorkingDays(id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Branch By Id',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Branch',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: UpdateBranchDto,
  ) {
    return this.branchService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Branch',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchService.remove(id);
  }
}
