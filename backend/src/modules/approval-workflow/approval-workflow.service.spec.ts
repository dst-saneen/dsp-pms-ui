import { NotFoundException } from '@nestjs/common';

import { ApprovalWorkflowService } from './approval-workflow.service';

describe('ApprovalWorkflowService company scope', () => {
  const prisma = {
    company: { findFirst: jest.fn() },
    approvalWorkflow: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const scope = {
    companyWhere: jest.fn().mockReturnValue({ id: 'company-a' }),
  };

  function service() {
    return Reflect.construct(ApprovalWorkflowService, [
      prisma,
      audit,
      scope,
    ]) as ApprovalWorkflowService;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    scope.companyWhere.mockReturnValue({ id: 'company-a' });
  });

  it('lists only workflows owned by the active company scope', async () => {
    prisma.approvalWorkflow.findMany.mockResolvedValue([]);

    await service().findAll();

    expect(prisma.approvalWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company: { id: 'company-a' } } }),
    );
  });

  it('refuses to create a workflow for a company outside the active scope', async () => {
    prisma.company.findFirst.mockResolvedValue(null);

    await expect(
      service().create({
        companyId: 'company-other',
        workflowCode: 'HR_REQUEST',
        workflowName: 'Other company HR approvals',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.approvalWorkflow.create).not.toHaveBeenCalled();
  });

  it('does not reveal a workflow direct ID outside the active company scope', async () => {
    prisma.approvalWorkflow.findFirst.mockResolvedValue(null);

    await expect(service().findOne('workflow-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.approvalWorkflow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'workflow-other', company: { id: 'company-a' } },
      }),
    );
  });
});
