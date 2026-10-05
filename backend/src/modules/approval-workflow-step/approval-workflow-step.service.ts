import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';

import { CreateApprovalWorkflowStepDto } from './dto/create-approval-workflow-step.dto';

import { UpdateApprovalWorkflowStepDto } from './dto/update-approval-workflow-step.dto';

@Injectable()
export class ApprovalWorkflowStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateApprovalWorkflowStepDto) {
    await this.findWorkflowInScope(dto.workflowId);
    const step = await this.prisma.approvalWorkflowStep.create({
      data: dto,
    });

    await this.auditService.log(
      'ApprovalWorkflowStep',
      step.id,
      'CREATE',
      null,
      step,
    );

    return step;
  }

  async findAll() {
    return this.prisma.approvalWorkflowStep.findMany({
      where: {
        workflow: { company: this.scope.companyWhere() },
      },
      include: {
        workflow: true,
      },
      orderBy: [
        {
          workflowId: 'asc',
        },
        {
          stepNo: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const step = await this.prisma.approvalWorkflowStep.findFirst({
      where: {
        id,
        workflow: { company: this.scope.companyWhere() },
      },
      include: {
        workflow: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Workflow Step not found');
    }

    return step;
  }

  async update(id: string, dto: UpdateApprovalWorkflowStepDto) {
    const current = await this.findOne(id);
    if (dto.workflowId && dto.workflowId !== current.workflowId) {
      throw new BadRequestException({
        code: 'APPROVAL_WORKFLOW_STEP_WORKFLOW_IMMUTABLE',
        message: 'Move a step by creating it in the target Company workflow.',
      });
    }

    const updated = await this.prisma.approvalWorkflowStep.update({
      where: { id },
      data: {
        stepNo: dto.stepNo,
        approverType: dto.approverType,
        approverRole: dto.approverRole,
      },
    });

    await this.auditService.log(
      'ApprovalWorkflowStep',
      id,
      'UPDATE',
      null,
      updated,
    );

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.approvalWorkflowStep.delete({
      where: { id },
    });
  }

  private async findWorkflowInScope(workflowId: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        id: workflowId,
        company: this.scope.companyWhere(),
      },
      select: { id: true },
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    return workflow;
  }
}
