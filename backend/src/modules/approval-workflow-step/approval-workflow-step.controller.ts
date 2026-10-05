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

import { ApprovalWorkflowStepService } from './approval-workflow-step.service';

import { CreateApprovalWorkflowStepDto } from './dto/create-approval-workflow-step.dto';
import { UpdateApprovalWorkflowStepDto } from './dto/update-approval-workflow-step.dto';

@Controller('approval-workflow-steps')
export class ApprovalWorkflowStepController {
  constructor(
    private readonly approvalWorkflowStepService: ApprovalWorkflowStepService,
  ) {}

  @Post()
  @RequireAnyPermissions(
    'organization.companies.manage',
    'workflow.workflow.manage',
    'hr.requests.manage',
  )
  create(@Body() dto: CreateApprovalWorkflowStepDto) {
    return this.approvalWorkflowStepService.create(dto);
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
    return this.approvalWorkflowStepService.findAll();
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
    return this.approvalWorkflowStepService.findOne(id);
  }

  @Patch(':id')
  @RequireAnyPermissions(
    'organization.companies.manage',
    'workflow.workflow.manage',
    'hr.requests.manage',
  )
  update(@Param('id') id: string, @Body() dto: UpdateApprovalWorkflowStepDto) {
    return this.approvalWorkflowStepService.update(id, dto);
  }

  @Delete(':id')
  @RequireAnyPermissions(
    'organization.companies.manage',
    'workflow.workflow.manage',
    'hr.requests.manage',
  )
  remove(@Param('id') id: string) {
    return this.approvalWorkflowStepService.remove(id);
  }
}
