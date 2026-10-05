import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';

import { CreateHrRequestTypeDto } from './dto/create-hr-request-type.dto';
import { UpdateHrRequestTypeDto } from './dto/update-hr-request-type.dto';

@Injectable()
export class HrRequestTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateHrRequestTypeDto, actor: AuthenticatedUser) {
    const companyId = this.requireCompany();
    const workflowId = await this.assertWorkflow(companyId, dto);
    const requestName = dto.requestName.trim();
    if (!requestName) {
      throw new ConflictException({ code: 'HR_REQUEST_TYPE_INVALID' });
    }
    const providedCode = dto.requestCode?.trim().toUpperCase();
    const requestCode = providedCode
      ? await this.allocateUniqueCode(companyId, providedCode)
      : await this.generateRequestCode(companyId);
    const requestType = await this.prisma.hrRequestType.create({
      data: {
        companyId,
        requestCode,
        requestName,
        requiresApproval: dto.requiresApproval ?? true,
        autoGenerate: !providedCode,
        workflowId,
      },
    });
    await this.audit.log(
      'HrRequestType',
      requestType.id,
      'CREATE',
      null,
      requestType,
      actor.id,
    );
    return requestType;
  }

  async findAll(actor: AuthenticatedUser) {
    const items = await this.prisma.hrRequestType.findMany({
      where: { company: this.scope.companyWhere() },
      include: {
        workflow: {
          select: {
            id: true,
            workflowCode: true,
            workflowName: true,
            isActive: true,
          },
        },
      },
      orderBy: { requestName: 'asc' },
    });
    return {
      items: items.map((item) => this.decorate(item, actor)),
      total: items.length,
      page: 1,
      limit: 100,
      allowedActions: this.canManage(actor) ? ['CREATE'] : [],
    };
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    const requestType = await this.prisma.hrRequestType.findFirst({
      where: { id, company: this.scope.companyWhere() },
      include: {
        workflow: {
          select: {
            id: true,
            workflowCode: true,
            workflowName: true,
            isActive: true,
          },
        },
      },
    });
    if (!requestType) throw new NotFoundException('HR Request Type not found');
    return actor ? this.decorate(requestType, actor) : requestType;
  }

  async update(
    id: string,
    dto: UpdateHrRequestTypeDto,
    actor: AuthenticatedUser,
  ) {
    const current = await this.findOne(id);
    const workflowId = await this.assertWorkflow(
      current.companyId,
      dto,
      current.workflowId,
    );
    const updated = await this.prisma.hrRequestType.update({
      where: { id: current.id },
      data: {
        ...(dto.requestCode !== undefined
          ? { requestCode: dto.requestCode.trim().toUpperCase() }
          : {}),
        ...(dto.requestName !== undefined
          ? { requestName: dto.requestName.trim() }
          : {}),
        ...(dto.requiresApproval !== undefined
          ? { requiresApproval: dto.requiresApproval }
          : {}),
        autoGenerate: false,
        workflowId,
      },
    });
    await this.audit.log(
      'HrRequestType',
      id,
      'UPDATE',
      current,
      updated,
      actor.id,
    );
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const current = await this.findOne(id);
    const archived = await this.prisma.hrRequestType.update({
      where: { id },
      data: { isActive: false, autoGenerate: false },
    });
    await this.audit.log(
      'HrRequestType',
      id,
      'ARCHIVE',
      current,
      archived,
      actor.id,
    );
    return this.decorate(archived, actor);
  }

  async workflowCandidates() {
    const companyId = this.requireCompany();
    return this.prisma.approvalWorkflow.findMany({
      where: {
        isActive: true,
        workflowCode: 'HR_REQUEST',
        steps: { some: {} },
        companyId,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ companyId: 'desc' }, { workflowName: 'asc' }],
    });
  }

  private async assertWorkflow(
    companyId: string,
    dto: Pick<CreateHrRequestTypeDto, 'requiresApproval' | 'workflowId'>,
    fallback?: string | null,
  ) {
    const requiresApproval = dto.requiresApproval ?? true;
    const workflowId = dto.workflowId !== undefined ? dto.workflowId : fallback;
    if (!requiresApproval) return null;
    if (!workflowId) {
      const companyDefaults = await this.prisma.approvalWorkflow.findMany({
        where: {
          workflowCode: 'HR_REQUEST',
          isActive: true,
          companyId,
          steps: { some: {} },
        },
        select: { id: true },
        take: 2,
      });
      if (companyDefaults.length === 1) return companyDefaults[0].id;
      if (companyDefaults.length > 1) {
        throw new ConflictException({
          code: 'HR_REQUEST_WORKFLOW_NOT_CONFIGURED',
          message:
            'Configure exactly one active Company HR_REQUEST workflow before creating this request type.',
        });
      }
      throw new ConflictException({
        code: 'HR_REQUEST_WORKFLOW_NOT_CONFIGURED',
        message:
          'Configure one active Company HR_REQUEST workflow before creating this request type.',
      });
    }
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        id: workflowId,
        isActive: true,
        workflowCode: 'HR_REQUEST',
        steps: { some: {} },
        companyId,
      },
      select: { id: true },
    });
    if (!workflow)
      throw new NotFoundException({ code: 'HR_REQUEST_WORKFLOW_NOT_FOUND' });
    return workflow.id;
  }

  private requireCompany() {
    const companyId = this.scope.current().activeCompanyId;
    if (!companyId) throw new NotFoundException('Company scope is required');
    return companyId;
  }

  private async generateRequestCode(companyId: string) {
    const existing = await this.prisma.hrRequestType.findMany({
      where: { companyId },
      select: { requestCode: true },
    });
    const maxSequence = existing.reduce((highest, row) => {
      const match = row.requestCode.match(/^HRT-(\d+)$/i);
      const sequence = match ? Number(match[1]) : 0;
      return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
    }, 0);
    return `HRT-${(maxSequence + 1).toString().padStart(5, '0')}`;
  }

  private async allocateUniqueCode(companyId: string, preferred: string) {
    const base = preferred.replace(/[^A-Z0-9_-]/gi, '').toUpperCase() || 'HRT';
    const candidate = base.slice(0, 80);
    const existing = await this.prisma.hrRequestType.findFirst({
      where: { companyId, requestCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    for (let suffix = 2; suffix <= 99; suffix += 1) {
      const next = `${candidate.slice(0, 76)}-${suffix}`.slice(0, 80);
      const clash = await this.prisma.hrRequestType.findFirst({
        where: { companyId, requestCode: next },
        select: { id: true },
      });
      if (!clash) return next;
    }
    return this.generateRequestCode(companyId);
  }

  private decorate<T extends { isActive: boolean }>(
    row: T,
    actor: AuthenticatedUser,
  ) {
    const allowedActions =
      this.canManage(actor) && row.isActive ? ['UPDATE', 'ARCHIVE'] : [];
    return { ...row, allowedActions };
  }

  private canManage(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.requests.manage')
    );
  }
}
