import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';

import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';

import { ApprovalWorkflowService } from './approval-workflow.service';

import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';

import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';

@Controller('approval-workflows')
export class ApprovalWorkflowController {
  constructor(
    private readonly approvalWorkflowService: ApprovalWorkflowService,
  ) {}

  @Post()
  @RequireAnyPermissions(
    'organization.companies.manage',
    'workflow.workflow.manage',
    'hr.requests.manage',
  )
  create(@Body() dto: CreateApprovalWorkflowDto) {
    return this.approvalWorkflowService.create(dto);
  }

  @Get()
  @RequireAnyPermissions(
    'organization.companies.read',
    'workflow.workflow.read',
    'workflow.workflow.manage',
    'hr.requests.read',
    'hr.requests.manage',
  )
  findAll() {
    return this.approvalWorkflowService.findAll();
  }

  @Get(':id')
  @RequireAnyPermissions(
    'organization.companies.read',
    'workflow.workflow.read',
    'workflow.workflow.manage',
    'hr.requests.read',
    'hr.requests.manage',
  )
  findOne(@Param('id') id: string) {
    return this.approvalWorkflowService.findOne(id);
  }

  @Patch(':id')
  @RequireAnyPermissions(
    'organization.companies.manage',
    'workflow.workflow.manage',
    'hr.requests.manage',
  )
  update(@Param('id') id: string, @Body() dto: UpdateApprovalWorkflowDto) {
    return this.approvalWorkflowService.update(id, dto);
  }

  @Delete(':id')
  @RequireAnyPermissions(
    'organization.companies.manage',
    'workflow.workflow.manage',
    'hr.requests.manage',
  )
  remove(@Param('id') id: string) {
    return this.approvalWorkflowService.remove(id);
  }
}
