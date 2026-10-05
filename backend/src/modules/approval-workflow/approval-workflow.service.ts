import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { buildWorkflowScopeKey } from '../workforce-approval/workforce-approval-resolver.service';

import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';

@Injectable()
export class ApprovalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scope: EmployeeDomainScopeService,
  ) {}

  async create(dto: CreateApprovalWorkflowDto) {
    const companyId = dto.companyId?.trim();
    if (!companyId) {
      throw new BadRequestException({
        code: 'APPROVAL_WORKFLOW_COMPANY_REQUIRED',
        message: 'Approval workflows must belong to the active company.',
      });
    }
    const workflowCode = dto.workflowCode.trim().toUpperCase();
    const scopeKey = buildWorkflowScopeKey(workflowCode, companyId);

    const existing = await this.prisma.approvalWorkflow.findUnique({
      where: { scopeKey },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Approval workflow already exists for scope ${scopeKey}`,
      });
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, ...this.scope.companyWhere() },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        workflowCode,
        workflowName: dto.workflowName.trim(),
        scopeKey,
        companyId,
      },
    });

    await this.auditService.log(
      'ApprovalWorkflow',
      workflow.id,
      'CREATE',
      null,
      workflow,
    );

    return workflow;
  }

  async findAll() {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        company: this.scope.companyWhere(),
      },
      include: {
        company: true,
        steps: true,
      },
      orderBy: {
        workflowName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        id,
        company: this.scope.companyWhere(),
      },
      include: {
        company: true,
        steps: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async update(id: string, dto: UpdateApprovalWorkflowDto) {
    const current = await this.findOne(id);

    if (dto.companyId && dto.companyId !== current.companyId) {
      throw new BadRequestException({
        code: 'APPROVAL_WORKFLOW_COMPANY_IMMUTABLE',
        message: 'Move a workflow by creating a new Company workflow instead.',
      });
    }

    const nextCode =
      dto.workflowCode?.trim().toUpperCase() ?? current.workflowCode;
    const nextScopeKey = buildWorkflowScopeKey(nextCode, current.companyId);

    if (nextScopeKey !== current.scopeKey) {
      const clash = await this.prisma.approvalWorkflow.findUnique({
        where: { scopeKey: nextScopeKey },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `Approval workflow already exists for scope ${nextScopeKey}`,
        });
      }
    }

    const workflow = await this.prisma.approvalWorkflow.update({
      where: { id },
      data: {
        ...(dto.workflowName !== undefined
          ? { workflowName: dto.workflowName.trim() }
          : {}),
        workflowCode: nextCode,
        companyId: current.companyId,
        scopeKey: nextScopeKey,
      },
    });

    await this.auditService.log(
      'ApprovalWorkflow',
      id,
      'UPDATE',
      null,
      workflow,
    );

    return workflow;
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.approvalWorkflow.delete({
      where: { id },
    });
  }
}
