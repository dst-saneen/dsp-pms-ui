import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { CreateHrRequestTypeDto } from './dto/create-hr-request-type.dto';
import { UpdateHrRequestTypeDto } from './dto/update-hr-request-type.dto';
import { HrRequestTypeService } from './hr-request-type.service';

@Controller('hr-request-types')
export class HrRequestTypeController {
  constructor(private readonly service: HrRequestTypeService) {}

  @Post()
  @RequirePermissions('hr.requests.manage')
  create(
    @Body() dto: CreateHrRequestTypeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, request.user);
  }

  @Get()
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.read',
    'hr.requests.manage',
  )
  findAll(@Req() request: AuthenticatedRequest) {
    return this.service.findAll(request.user);
  }

  @Get('workflow-candidates')
  @RequireAnyPermissions('hr.requests.read', 'hr.requests.manage')
  workflowCandidates() {
    return this.service.workflowCandidates();
  }

  @Get(':id')
  @RequireAnyPermissions('hr.requests.read', 'hr.requests.manage')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, request.user);
  }

  @Patch(':id')
  @RequirePermissions('hr.requests.manage')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateHrRequestTypeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, request.user);
  }

  @Delete(':id')
  @RequirePermissions('hr.requests.manage')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.remove(id, request.user);
  }
}
