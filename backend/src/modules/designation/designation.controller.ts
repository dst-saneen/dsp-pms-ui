import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { DesignationService } from './designation.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { AddDesignationDepartmentDto } from './dto/add-designation-department.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OnboardingEnabledGuard } from '../onboarding-runtime/guards/onboarding-enabled.guard';

@ApiTags('Designations')
@Controller('designations')
export class DesignationController {
  constructor(private readonly designationService: DesignationService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create Designation (optionally link onboarding departments atomically)',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body()
    createDesignationDto: CreateDesignationDto,
  ) {
    return this.designationService.create(createDesignationDto, request.user);
  }

  @Post(':designationId/departments')
  @ApiOperation({
    summary: 'Add Department To Designation Onboarding',
  })
  addDepartment(
    @Req() request: AuthenticatedRequest,
    @Param('designationId', ParseUUIDPipe)
    designationId: string,
    @Body()
    dto: AddDesignationDepartmentDto,
  ) {
    return this.designationService.addDepartment(
      designationId,
      dto.departmentId,
      dto.branchId,
      request.user,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get All Designations',
  })
  findAll(
    @Query('companyId')
    companyId?: string,
  ) {
    return this.designationService.findAll(companyId);
  }

  @Get('onboarding-workspace')
  @UseGuards(OnboardingEnabledGuard)
  getOnboardingWorkspace(@Query('companyId') companyId?: string) {
    return this.designationService.getOnboardingWorkspace(companyId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Designation By Id',
  })
  findOne(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.designationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update Designation (optionally sync onboarding departments atomically)',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    updateDesignationDto: UpdateDesignationDto,
  ) {
    return this.designationService.update(
      id,
      updateDesignationDto,
      request.user,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete Designation',
  })
  remove(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.designationService.remove(id);
  }
}
